const { ipcRenderer } = require('electron');
const { logInfo, logError } = require('../logger.js');

async function parse(url) {
    try {
        logInfo('[B站] 开始解析B站视频');
        
        const bvid = extractBVID(url);
        if (!bvid) {
            logError('[B站] 未找到BV号', new Error('BV号提取失败'));
            return null;
        }
        
        logInfo(`[B站] 提取到BV号: ${bvid}`);
        
        const videoInfo = await getVideoInfo(bvid);
        if (!videoInfo) {
            logError('[B站] 获取视频信息失败', new Error('API返回为空'));
            return null;
        }
        
        const { aid, cid, title, pic, owner, pages } = videoInfo;
        logInfo(`[B站] 视频信息: ${title}, 作者: ${owner.name}, 分P数: ${pages.length}`);
        
        const videoUrl = await getPlayUrl(aid, cid);
        if (!videoUrl) {
            logError('[B站] 获取播放地址失败', new Error('playurl API返回为空'));
            return null;
        }
        
        logInfo(`[B站] 获取到视频地址: ${videoUrl.substring(0, 80)}...`);
        
        const result = {
            title: title,
            nickName: owner.name,
            type: 1,
            videoUrl: videoUrl,
            cover: pic,
            bvid: bvid,
            aid: aid,
            cid: cid,
            pages: pages
        };
        
        logInfo(`[B站] 解析成功`);
        return result;
        
    } catch (error) {
        logError('[B站] 解析失败', error);
        return null;
    }
}

function extractBVID(url) {
    const bvRegex = /(BV[a-zA-Z0-9]{10})/;
    const match = url.match(bvRegex);
    
    if (match) {
        return match[1];
    }
    
    if (url.includes('b23.tv')) {
        logInfo('[B站] 检测到短链接，需要获取重定向');
        return null;
    }
    
    return null;
}

async function getVideoInfo(bvid) {
    try {
        const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
        logInfo(`[B站] 请求视频信息: ${apiUrl}`);
        
        const response = await ipcRenderer.invoke('fetch-url', apiUrl, {
            method: 'GET',
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.bilibili.com/',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Origin': 'https://www.bilibili.com'
            }
        });
        
        if (response.statusCode !== 200) {
            logError('[B站] API请求失败', new Error(`状态码: ${response.statusCode}`));
            return null;
        }
        
        const jsonData = JSON.parse(response.data);
        logInfo(`[B站] API响应: code=${jsonData.code}, message=${jsonData.message}`);
        
        if (jsonData.code !== 0 || !jsonData.data) {
            logError('[B站] API返回错误', new Error(`code: ${jsonData.code}, message: ${jsonData.message}`));
            return null;
        }
        
        return jsonData.data;
        
    } catch (error) {
        logError('[B站] 获取视频信息失败', error);
        return null;
    }
}

async function getPlayUrl(aid, cid, quality = 80) {
    try {
        const apiUrl = `https://api.bilibili.com/x/player/playurl?avid=${aid}&cid=${cid}&qn=${quality}&fnval=0&fourk=1`;
        logInfo(`[B站] 请求播放地址: ${apiUrl}`);
        
        const response = await ipcRenderer.invoke('fetch-url', apiUrl, {
            method: 'GET',
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.bilibili.com/',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Origin': 'https://www.bilibili.com'
            }
        });
        
        if (response.statusCode !== 200) {
            logError('[B站] 播放地址请求失败', new Error(`状态码: ${response.statusCode}`));
            return null;
        }
        
        const jsonData = JSON.parse(response.data);
        logInfo(`[B站] 播放地址API响应: code=${jsonData.code}`);
        
        if (jsonData.code !== 0 || !jsonData.data) {
            logError('[B站] 播放地址API返回错误', new Error(`code: ${jsonData.code}, message: ${jsonData.message}`));
            return null;
        }
        
        if (jsonData.data.durl && jsonData.data.durl.length > 0) {
            const videoUrl = jsonData.data.durl[0].url;
            logInfo(`[B站] 成功获取播放地址`);
            return videoUrl;
        } else if (jsonData.data.dash) {
            logInfo('[B站] 检测到DASH格式，暂不支持');
            logError('[B站] DASH格式需要音视频合并', new Error('暂不支持DASH格式'));
            return null;
        }
        
        logError('[B站] 未找到可用的视频地址', new Error('durl为空'));
        return null;
        
    } catch (error) {
        logError('[B站] 获取播放地址失败', error);
        return null;
    }
}

module.exports = {
    parse
};

