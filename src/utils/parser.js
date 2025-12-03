const path = require('path');
const { logInfo, logError } = require('./logger.js');
const { parseDouyin } = require(path.join(__dirname, 'parsers/douyin.js'));
const { parseXiaohongshu } = require(path.join(__dirname, 'parsers/xiaohongshu.js'));
const { parseKuaishou } = require(path.join(__dirname, 'parsers/kuaishou.js'));
const { parse: parseBilibili } = require(path.join(__dirname, 'parsers/bilibili.js'));

async function parseVideoUrl(txt) {
    try {
        logInfo(`开始解析: ${txt.substring(0, 100)}...`);
        
        const url = extractUrl(txt);
        if (!url) {
            logError('未找到有效URL', new Error('URL提取失败'));
            return null;
        }

        logInfo(`提取到URL: ${url}`);

        let result = null;

        if (url.includes('douyin.com') || url.includes('v.douyin.com')) {
            logInfo('识别为抖音链接');
            result = await parseDouyin(txt);
        } else if (url.includes('xiaohongshu.com') || url.includes('xhslink.com')) {
            logInfo('识别为小红书链接');
            result = await parseXiaohongshu(txt);
        } else if (url.includes('kuaishou.com') || url.includes('v.kuaishou.com')) {
            logInfo('识别为快手链接');
            result = await parseKuaishou(txt);
        } else if (url.includes('bilibili.com') || url.includes('b23.tv') || url.match(/BV[a-zA-Z0-9]{10}/)) {
            logInfo('识别为B站链接');
            result = await parseBilibili(url);
            if (result) {
                result.platform = 'B站';
            }
        } else {
            logError('未识别的平台', new Error('不支持的平台'));
            return null;
        }

        if (result && Object.keys(result).length > 0) {
            logInfo(`解析成功: ${JSON.stringify(result).substring(0, 200)}...`);
            return result;
        }
        
        return null;
    } catch (error) {
        logError('解析失败', error);
        return null;
    }
}

function extractUrl(msg) {
    const regex = /(https?:\/\/\S+)/;
    const match = msg.match(regex);
    return match ? match[1] : null;
}

module.exports = {
    parseVideoUrl
};
