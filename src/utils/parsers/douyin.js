const { ipcRenderer } = require('electron');
const { logInfo, logError } = require('../logger.js');

async function parseDouyin(txt) {
    try {
        logInfo(`[抖音] 开始解析`);
        
        const url = extractUrl(txt);
        if (!url) {
            return null;
        }

        logInfo(`[抖音] 提取到URL: ${url}`);

        const redirectUrl = await getRedirectUrl(url);
        if (!redirectUrl) {
            return null;
        }

        logInfo(`[抖音] 重定向URL: ${redirectUrl}`);

        const html = await fetchHtml(redirectUrl);
        if (!html) {
            return null;
        }

        logInfo(`[抖音] HTML长度: ${html.length}`);
        
        if (!html.includes('window._ROUTER_DATA') && !html.includes('window["_ROUTER_DATA"]')) {
            logError('[抖音] 未找到_ROUTER_DATA标记', new Error('不是抖音页面'));
            return null;
        }

        const respJson = {};
        parseRouterData(html, respJson);

        if (Object.keys(respJson).length > 0) {
            logInfo(`[抖音] 解析成功`);
            return respJson;
        }
        
        return null;
    } catch (error) {
        logError('[抖音] 解析失败', error);
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
        const response = await ipcRenderer.invoke('fetch-url', url, {
            method: 'GET',
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        return response.data;
    } catch (error) {
        logError('[抖音] HTML请求失败', error);
        return null;
    }
}

async function getRedirectUrl(redirectUrl) {
    try {
        logInfo(`[抖音] 开始获取重定向: ${redirectUrl}`);
        
        const response = await ipcRenderer.invoke('fetch-url', redirectUrl, {
            method: 'GET',
            redirect: 'manual',
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
            }
        });

        logInfo(`[抖音] 重定向响应状态: ${response.statusCode}`);
        
        if (response.isRedirect && response.url) {
            logInfo(`[抖音] 重定向到: ${response.url}`);
            return response.url;
        }
        
        logInfo(`[抖音] 无重定向，使用原URL`);
        return redirectUrl;
    } catch (error) {
        logError('[抖音] 重定向请求失败', error);
        return redirectUrl;
    }
}

function parseRouterData(html, respJson) {
    try {
        const jsonData = extractJsonData(html, 'window._ROUTER_DATA');
        
        if (jsonData === '{}') {
            return;
        }

        const jsonObject = JSON.parse(jsonData);
        const loaderDataJson = jsonObject.loaderData;

        if (loaderDataJson) {
            parsePageInfo(loaderDataJson, respJson);
        }
    } catch (error) {
        logError('[抖音] 解析RouterData失败', error);
    }
}

function parsePageInfo(loaderDataJson, respJson) {
    let pageInfoJson = null;
    let notePageInfoJson = null;

    for (const key in loaderDataJson) {
        if (key.includes('video_') && key.includes('/page')) {
            pageInfoJson = loaderDataJson[key];
            break;
        } else if (key.includes('note_') && key.includes('/page')) {
            notePageInfoJson = loaderDataJson[key];
            break;
        }
    }

    if (pageInfoJson) {
        parseVideoInfo(pageInfoJson, respJson);
    } else if (notePageInfoJson) {
        parseNoteInfo(notePageInfoJson, respJson);
    }
}

function parseVideoInfo(pageInfoJson, respJson) {
    try {
        const videoInfoRes = pageInfoJson.videoInfoRes;
        if (!videoInfoRes || !videoInfoRes.item_list || videoInfoRes.item_list.length === 0) {
            return;
        }

        const itemList = videoInfoRes.item_list[0];
        populateVideoResponse(itemList, respJson);
    } catch (error) {
        logError('[抖音] 解析视频信息失败', error);
    }
}

function populateVideoResponse(itemList, respJson) {
    try {
        const desc = itemList.desc || itemList.title || '无标题';
        const nickName = itemList.author?.nickname || itemList.author?.nick_name || '未知作者';
        
        let videoUrl = '';
        if (itemList.video?.play_addr?.url_list && itemList.video.play_addr.url_list.length > 0) {
            videoUrl = itemList.video.play_addr.url_list[0];
        } else if (itemList.video?.playAddr?.url_list && itemList.video.playAddr.url_list.length > 0) {
            videoUrl = itemList.video.playAddr.url_list[0];
        } else if (itemList.video?.playApi) {
            videoUrl = itemList.video.playApi;
        }

        if (videoUrl) {
            videoUrl = videoUrl.replace('playwm', 'play').replace('720p', '1080p');
            
            respJson.title = desc;
            respJson.nickName = nickName;
            respJson.type = 1;
            respJson.videoUrl = videoUrl;
            
            logInfo(`[抖音] 解析成功 - 标题: ${desc.substring(0, 20)}...`);
        }
    } catch (error) {
        logError('[抖音] 填充视频响应失败', error);
    }
}

function parseNoteInfo(notePageInfoJson, respJson) {
    try {
        const videoInfoRes = notePageInfoJson.videoInfoRes;
        if (!videoInfoRes || !videoInfoRes.item_list || videoInfoRes.item_list.length === 0) {
            return;
        }

        const itemList = videoInfoRes.item_list[0];
        const desc = itemList.desc || itemList.title || '无标题';
        const nickName = itemList.author?.nickname || itemList.author?.nick_name || '未知作者';

        if (!itemList.images || itemList.images.length === 0) {
            return;
        }

        const imageList = itemList.images.map(img => img.url_list[0]);

        respJson.title = desc;
        respJson.nickName = nickName;
        respJson.type = 2;
        respJson.imageList = imageList;
        
        logInfo(`[抖音] 解析图文成功 - 图片数: ${imageList.length}`);
    } catch (error) {
        logError('[抖音] 解析图文信息失败', error);
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
    parseDouyin
};

