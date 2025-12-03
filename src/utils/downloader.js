const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const { logInfo, logError } = require('./logger.js');

async function downloadVideo(url, title, type, platform) {
    try {
        logInfo(`开始下载: ${title} - ${url}`);
        
        const config = await ipcRenderer.invoke('load-config');
        const downloadPath = config.downloadPath;

        const platformTag = getPlatformTag(url, platform);
        const shortTitle = getShortTitle(title, 6); // 目录名扩充到6字符
        const folderName = `[${platformTag}]${shortTitle}`;
        const targetDir = path.join(downloadPath, folderName);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const ext = type === 'video' ? '.mp4' : '.jpg';
        // 硬编码文件名：[平台标识]+视频文件
        const fileName = `[${platformTag}]视频文件${ext}`;
        const filePath = path.join(targetDir, fileName);

        ipcRenderer.send('download-start', { url, title, filePath, targetDir });

        let referer = 'https://www.douyin.com/';
        if (url.includes('xiaohongshu.com') || url.includes('xhscdn.com')) {
            referer = 'https://www.xiaohongshu.com/';
        } else if (url.includes('bilibili.com') || url.includes('bilivideo.com')) {
            referer = 'https://www.bilibili.com/';
        }

        const response = await ipcRenderer.invoke('fetch-url', url, {
            method: 'GET',
            redirect: 'follow',
            onProgress: true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'Referer': referer
            }
        });

        fs.writeFileSync(filePath, response.data);
        logInfo(`下载完成: ${filePath}`);
        
        ipcRenderer.send('download-complete', { url, filePath, targetDir });
        
        return filePath;
    } catch (error) {
        logError('下载失败', error);
        ipcRenderer.send('download-error', { url, error: error.message });
        throw error;
    }
}

async function downloadImages(imageList, title, desc, author, platform) {
    const batchId = `batch_${Date.now()}`;
    
    try {
        logInfo(`开始批量下载: ${title}, 共${imageList.length}张图片`);
        
        const config = await ipcRenderer.invoke('load-config');
        const downloadPath = config.downloadPath;

        const platformTag = getPlatformTag(imageList[0], platform);
        const shortTitle = getShortTitle(title, 6); // 目录名扩充到6字符
        const folderName = `[${platformTag}]${shortTitle}`.replace(/[<>:"/\\|?*]/g, '_');
        const targetDir = path.join(downloadPath, folderName);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // 硬编码文件名：[平台标识]+文本内容
        const txtFileName = `[${platformTag}]文本内容.txt`;
        const txtFilePath = path.join(targetDir, txtFileName);
        
        if (!fs.existsSync(txtFilePath)) {
            const txtContent = `标题：${title}\n作者：${author}\n\n内容：\n${desc}`;
            fs.writeFileSync(txtFilePath, txtContent, 'utf-8');
            logInfo(`文字内容已保存: ${txtFilePath}`);
        }

        ipcRenderer.send('download-batch-start', { 
            batchId,
            title: shortTitle,
            total: imageList.length + 1,
            targetDir,
            thumbnail: imageList[0]
        });

        const results = [];
        let completedCount = 0;
        
        completedCount++;
        ipcRenderer.send('download-batch-progress', {
            batchId,
            current: completedCount,
            total: imageList.length + 1,
            message: '文字内容已保存'
        });
        
        for (let i = 0; i < imageList.length; i++) {
            const url = imageList[i];
            const fileName = `${i + 1}.jpg`;
            const filePath = path.join(targetDir, fileName);

            try {
                if (fs.existsSync(filePath)) {
                    logInfo(`图片已存在，跳过: ${fileName}`);
                    results.push({ success: true, filePath, skipped: true });
                    completedCount++;
                    ipcRenderer.send('download-batch-progress', {
                        batchId,
                        current: completedCount,
                        total: imageList.length + 1,
                        message: `图片 ${i + 1}/${imageList.length} (已存在)`
                    });
                    continue;
                }

                ipcRenderer.send('download-batch-progress', {
                    batchId,
                    current: completedCount,
                    total: imageList.length + 1,
                    message: `正在下载图片 ${i + 1}/${imageList.length}`
                });

                const response = await ipcRenderer.invoke('fetch-url', url, {
                    method: 'GET',
                    redirect: 'follow',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                        'Accept-Language': 'zh-CN,zh;q=0.9',
                        'Sec-Fetch-Dest': 'image',
                        'Sec-Fetch-Mode': 'no-cors',
                        'Sec-Fetch-Site': 'cross-site'
                    }
                });

                const convertedData = await ipcRenderer.invoke('convert-image-to-jpg', response.data);
                fs.writeFileSync(filePath, convertedData);
                logInfo(`图片下载完成 (${i + 1}/${imageList.length}): ${filePath}`);
                
                completedCount++;
                ipcRenderer.send('download-batch-progress', {
                    batchId,
                    current: completedCount,
                    total: imageList.length + 1,
                    message: `图片 ${i + 1}/${imageList.length} 下载完成`
                });
                
                results.push({ success: true, filePath });
            } catch (error) {
                logError(`图片下载失败 (${i + 1}/${imageList.length})`, error);
                results.push({ success: false, error: error.message });
            }
        }

        const successCount = results.filter(r => r.success && !r.skipped).length;
        logInfo(`批量下载完成: 成功${successCount}/${imageList.length}张`);
        
        ipcRenderer.send('download-batch-complete', {
            batchId,
            targetDir,
            successCount,
            totalCount: imageList.length
        });
        
        return results;
    } catch (error) {
        logError('批量下载失败', error);
        ipcRenderer.send('download-batch-error', {
            batchId,
            error: error.message
        });
        throw error;
    }
}

function getShortTitle(title, maxLength = 5) {
    if (!title) return '未命名';
    
    let cleanTitle = title.replace(/[\r\n\t]/g, ' ')
                          .replace(/\s+/g, ' ')
                          .replace(/[#@\[\]【】]/g, '')
                          .trim();
    
    let charCount = 0;
    let result = '';
    
    for (let i = 0; i < cleanTitle.length && charCount < maxLength; i++) {
        const char = cleanTitle[i];
        if (/[\u4e00-\u9fa5]/.test(char)) {
            charCount++;
            result += char;
        } else if (/[a-zA-Z0-9]/.test(char)) {
            charCount += 0.5;
            result += char;
        }
    }
    
    return result || '未命名';
}

function getSafeFileName(title, targetDir, ext) {
    const MAX_PATH_LENGTH = 260;
    const RESERVED_LENGTH = 14 + ext.length;
    
    const maxFileNameLength = MAX_PATH_LENGTH - targetDir.length - RESERVED_LENGTH;
    
    let cleanTitle = title
        .replace(/[\r\n\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/[#@【】]/g, '')
        .trim();
    
    if (cleanTitle.length > maxFileNameLength) {
        let byteCount = 0;
        let result = '';
        
        for (let i = 0; i < cleanTitle.length; i++) {
            const char = cleanTitle[i];
            const charBytes = /[\u4e00-\u9fa5]/.test(char) ? 3 : 1;
            
            if (byteCount + charBytes > maxFileNameLength) {
                break;
            }
            
            byteCount += charBytes;
            result += char;
        }
        
        cleanTitle = result || '视频';
    }
    
    if (!cleanTitle || cleanTitle.length === 0) {
        cleanTitle = `视频_${Date.now()}`;
    }
    
    return `${cleanTitle}${ext}`;
}

function getPlatformTag(url, platform) {
    if (platform) {
        return platform;
    }
    
    if (!url) return '未知';
    
    if (url.includes('douyin.com') || 
        url.includes('douyinvod.com') || 
        url.includes('snssdk.com') || 
        url.includes('aweme.snssdk.com') ||
        url.includes('iesdouyin.com')) {
        return '抖音';
    } else if (url.includes('xiaohongshu.com') || url.includes('xhscdn.com')) {
        return '小红书';
    } else if (url.includes('kuaishou.com') || url.includes('kwcdn.com')) {
        return '快手';
    } else if (url.includes('bilibili.com') || url.includes('bilivideo.com') || url.includes('hdslb.com')) {
        return 'B站';
    }
    
    return '未知';
}

module.exports = {
    downloadVideo,
    downloadImages
};

