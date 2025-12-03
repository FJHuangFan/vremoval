const { ipcRenderer } = require('electron');
const { logInfo, logError } = require('../logger.js');

async function parseKuaishou(txt) {
    try {
        logInfo(`[快手] 开始解析`);
        
        const url = extractUrl(txt);
        if (!url) {
            return null;
        }

        logInfo(`[快手] 提取到URL: ${url}`);

        const redirectUrl = await getRedirectUrl(url);
        if (!redirectUrl) {
            return null;
        }

        logInfo(`[快手] 重定向URL: ${redirectUrl}`);

        const html = await fetchHtml(redirectUrl);
        if (!html) {
            return null;
        }

        logInfo(`[快手] HTML长度: ${html.length}`);
        
        if (!html.includes('window.INIT_STATE') && !html.includes('window["INIT_STATE"]')) {
            logError('[快手] 未找到INIT_STATE标记', new Error('不是快手页面'));
            return null;
        }

        const respJson = {};
        parseInitState(html, respJson);

        if (Object.keys(respJson).length > 0) {
            logInfo(`[快手] 解析成功`);
            return respJson;
        }
        
        return null;
    } catch (error) {
        logError('[快手] 解析失败', error);
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
        logError('[快手] HTML请求失败', error);
        return null;
    }
}

async function getRedirectUrl(redirectUrl) {
    try {
        const response = await ipcRenderer.invoke('fetch-url', redirectUrl, {
            method: 'GET',
            redirect: 'manual',
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
            }
        });
        
        if (response.isRedirect && response.url) {
            return response.url;
        }
        
        return redirectUrl;
    } catch (error) {
        logError('[快手] 重定向请求失败', error);
        return redirectUrl;
    }
}

function parseInitState(html, respJson) {
    try {
        const jsonData = extractJsonData(html, 'window.INIT_STATE');
        const jsonObject = JSON.parse(jsonData);
        const prefix = 'tusjoh.0sftu0xe0vhI6Bqq0qipup0tjnqmf0jogp@lqo';
        const object = findJSONObjectByPrefix(jsonObject, prefix);

        if (object) {
            const photo = object.photo;
            const userName = photo.userName;
            const caption = photo.caption;
            const jsonArray = photo.mainMvUrls;

            if (jsonArray && jsonArray.length > 0) {
                const videoUrl = jsonArray[0].url;
                respJson.title = caption;
                respJson.nickName = userName;
                respJson.type = 1;
                respJson.videoUrl = videoUrl;
                logInfo(`[快手] 视频解析成功`);
            } else {
                parseAtlasPhoto(photo, respJson, caption, userName);
            }
        }
    } catch (error) {
        logError('[快手] 解析InitState失败', error);
    }
}

function parseAtlasPhoto(photo, respJson, caption, userName) {
    try {
        const atlasJson = photo.ext_params.atlas;
        const http = atlasJson.cdn[0];
        const atlasJsonArray = atlasJson.list;
        const imageList = atlasJsonArray.map(item => `https://${http}${item}`);

        respJson.title = caption;
        respJson.nickName = userName;
        respJson.type = 2;
        respJson.imageList = imageList;
        
        logInfo(`[快手] 图集解析成功 - 图片数: ${imageList.length}`);
    } catch (error) {
        logError('[快手] 解析图集失败', error);
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

function findJSONObjectByPrefix(jsonObject, prefix) {
    for (const key in jsonObject) {
        if (key.startsWith(prefix)) {
            return jsonObject[key];
        }
    }
    return null;
}

module.exports = {
    parseKuaishou
};

