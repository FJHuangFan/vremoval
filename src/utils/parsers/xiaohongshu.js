const { ipcRenderer } = require('electron');
const { logInfo, logError } = require('../logger.js');

async function parseXiaohongshu(txt) {
    try {
        logInfo(`[小红书] 开始解析`);
        
        const url = extractUrl(txt);
        if (!url) {
            return null;
        }

        logInfo(`[小红书] 提取到URL: ${url}`);

        const html = await fetchHtml(url);
        if (!html) {
            return null;
        }

        logInfo(`[小红书] HTML长度: ${html.length}`);
        
        if (!html.includes('window.__INITIAL_STATE__') && !html.includes('window["__INITIAL_STATE__"]')) {
            logError('[小红书] 未找到__INITIAL_STATE__标记', new Error('不是小红书页面'));
            return null;
        }

        const respJson = {};
        parseInitialState(html, respJson);

        if (Object.keys(respJson).length > 0) {
            logInfo(`[小红书] 解析成功`);
            return respJson;
        }
        
        return null;
    } catch (error) {
        logError('[小红书] 解析失败', error);
        return null;
    }
}

function extractUrl(msg) {
    const regex = /(https?:\/\/\S+)/;
    const match = msg.match(regex);
    return match ? match[1] : null;
}

async function fetchHtml(url) {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cache-Control': 'max-age=0',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        };
        
        const response = await ipcRenderer.invoke('fetch-url', url, {
            method: 'GET',
            redirect: 'follow',
            headers: headers
        });

        if (response.data && response.data.length > 0) {
            if (response.data.includes('验证码') || response.data.includes('captcha')) {
                logError('[小红书] 遇到验证码页面', new Error('需要验证'));
                return null;
            }
            
            return response.data;
        }
        
        return null;
    } catch (error) {
        logError('[小红书] HTML请求失败', error);
        return null;
    }
}

function parseInitialState(html, respJson) {
    try {
        const jsonData = extractJsonData(html, 'window.__INITIAL_STATE__').replace(/undefined/g, '"undefined"');
        
        const jsonObject = JSON.parse(jsonData);
        
        let noteDataJson = null;
        
        if (jsonObject.note && jsonObject.note.noteDetailMap) {
            const noteDetailMap = jsonObject.note.noteDetailMap;
            const firstNoteId = Object.keys(noteDetailMap)[0];
            if (firstNoteId) {
                const noteDetail = noteDetailMap[firstNoteId];
                if (noteDetail.note) {
                    noteDataJson = noteDetail.note;
                }
            }
        } else if (jsonObject.noteData) {
            const noteData = jsonObject.noteData;
            if (noteData.data && Object.keys(noteData.data).length > 0) {
                noteDataJson = noteData.data.noteData || noteData.data.note;
            }
        }
        
        if (!noteDataJson) {
            return;
        }
        
        const desc = noteDataJson.desc || noteDataJson.title || '无标题';
        const type = noteDataJson.type;
        const nickName = noteDataJson.user?.nickName || noteDataJson.user?.nickname || noteDataJson.user?.name || '未知作者';

        if (type === 'video') {
            let videoUrl = null;
            
            if (noteDataJson.video?.media?.stream?.h265 && noteDataJson.video.media.stream.h265.length > 0) {
                videoUrl = noteDataJson.video.media.stream.h265[0].masterUrl;
            } else if (noteDataJson.video?.media?.stream?.h264 && noteDataJson.video.media.stream.h264.length > 0) {
                videoUrl = noteDataJson.video.media.stream.h264[0].masterUrl;
            } else if (noteDataJson.video?.consumer?.originVideoKey) {
                videoUrl = `https://sns-video-bd.xhscdn.com/${noteDataJson.video.consumer.originVideoKey}`;
            }
            
            if (videoUrl) {
                respJson.title = desc;
                respJson.nickName = nickName;
                respJson.type = 1;
                respJson.videoUrl = videoUrl;
                logInfo(`[小红书] 视频解析成功`);
            }
        } else if (type === 'normal' || noteDataJson.imageList) {
            const imageList = [];
            const jsonArray = noteDataJson.imageList || [];

            if (jsonArray.length === 0) {
                return;
            }

            for (const imageJson of jsonArray) {
                let urlList = null;
                
                if (imageJson.urlDefault) {
                    urlList = imageJson.urlDefault;
                } else if (imageJson.url) {
                    urlList = imageJson.url;
                } else if (imageJson.infoList && imageJson.infoList.length > 0) {
                    urlList = imageJson.infoList[0].url;
                } else if (imageJson.stream) {
                    const stream = imageJson.stream;
                    if (stream.h264 && stream.h264.length > 0) {
                        urlList = stream.h264[0].masterUrl;
                    } else if (stream.h265 && stream.h265.length > 0) {
                        urlList = stream.h265[0].masterUrl;
                    }
                }
                
                if (urlList) {
                    imageList.push(urlList);
                }
            }

            if (imageList.length > 0) {
                respJson.title = desc;
                respJson.nickName = nickName;
                respJson.type = 2;
                respJson.imageList = imageList;
                logInfo(`[小红书] 图文解析成功 - 图片数: ${imageList.length}`);
            }
        }
    } catch (error) {
        logError('[小红书] 解析InitialState失败', error);
    }
}

function extractJsonData(html, marker) {
    let startIndex = html.indexOf(marker);
    
    if (startIndex === -1) {
        const bracketMarker = `window["${marker.replace('window.', '').replace('__', '')}"]`;
        startIndex = html.indexOf(bracketMarker);
        
        if (startIndex === -1) {
            return '{}';
        }
    }

    const scriptStart = startIndex;
    const scriptEnd = html.indexOf('</script>', scriptStart);
    const scriptContent = html.substring(scriptStart, scriptEnd > 0 ? scriptEnd : html.length);
    
    const firstBrace = scriptContent.indexOf('{');
    if (firstBrace === -1) {
        return '{}';
    }

    const lastBrace = scriptContent.lastIndexOf('}');
    if (lastBrace === -1 || lastBrace <= firstBrace) {
        return '{}';
    }

    return scriptContent.substring(firstBrace, lastBrace + 1);
}

module.exports = {
    parseXiaohongshu
};

