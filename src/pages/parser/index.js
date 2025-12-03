(function() {
    'use strict';

    const path = require('path');
    const fs = require('fs');
    const { parseVideoUrl } = require(path.join(__dirname, '../../utils/parser.js'));
    const { downloadVideo, downloadImages } = require(path.join(__dirname, '../../utils/downloader.js'));

    const parseBtn = document.getElementById('parseBtn');
    const videoUrlInput = document.getElementById('videoUrl');
    const resultCard = document.getElementById('resultCard');
    const resultContent = document.getElementById('resultContent');

    videoUrlInput.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        const { ipcRenderer, clipboard } = require('electron');
        
        const menuItems = [
            {
                label: '粘贴',
                enabled: true,
                action: 'paste'
            }
        ];
        
        if (videoUrlInput.value) {
            menuItems.push({ type: 'separator' });
            menuItems.push({
                label: '全选',
                enabled: true,
                action: 'selectAll'
            });
            menuItems.push({
                label: '清空',
                enabled: true,
                action: 'clear'
            });
        }
        
        const selectedAction = await ipcRenderer.invoke('show-context-menu', menuItems);
        
        if (selectedAction === 'paste') {
            const text = clipboard.readText();
            if (text) {
                const start = videoUrlInput.selectionStart;
                const end = videoUrlInput.selectionEnd;
                const currentValue = videoUrlInput.value;
                videoUrlInput.value = currentValue.substring(0, start) + text + currentValue.substring(end);
                videoUrlInput.selectionStart = videoUrlInput.selectionEnd = start + text.length;
            }
        } else if (selectedAction === 'selectAll') {
            videoUrlInput.select();
        } else if (selectedAction === 'clear') {
            videoUrlInput.value = '';
        }
    });

    parseBtn.addEventListener('click', async () => {
        const url = videoUrlInput.value.trim();
        if (!url) {
            showError('请输入视频链接');
            return;
        }

        parseBtn.disabled = true;
        parseBtn.textContent = '解析中...';
        resultCard.style.display = 'none';

        try {
            const result = await parseVideoUrl(url);
            
            if (result) {
                displayResult(result);
            } else {
                showError('解析失败，请检查链接是否正确');
            }
        } catch (error) {
            showError('解析出错：' + error.message);
        } finally {
            parseBtn.disabled = false;
            parseBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="margin-right: 8px;">
                    <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                开始解析
            `;
        }
    });

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeJs(text) {
        return text.replace(/\\/g, '\\\\')
                   .replace(/'/g, "\\'")
                   .replace(/"/g, '\\"')
                   .replace(/\n/g, '\\n')
                   .replace(/\r/g, '\\r')
                   .replace(/\t/g, '\\t');
    }

    async function displayResult(result) {
        resultCard.style.display = 'block';
        let html = '';

        html += `
            <div class="result-item">
                <div class="result-label">标题</div>
                <div class="result-value">${escapeHtml(result.title || '无标题')}</div>
            </div>
        `;

        html += `
            <div class="result-item">
                <div class="result-label">作者</div>
                <div class="result-value">${escapeHtml(result.nickName || '未知')}</div>
            </div>
        `;

        const config = await ipcRenderer.invoke('load-config');

        window._currentResult = result;

        if (result.type === 1 && result.videoUrl) {
            html += `
                <div class="result-item full-width">
                    <div class="result-label">视频链接</div>
                    <div class="result-value" style="margin-bottom: 10px;">${escapeHtml(result.videoUrl)}</div>
                    <button class="btn-download" onclick="handleDownload('${escapeJs(result.videoUrl)}', '${escapeJs(result.title)}', 'video')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        下载视频
                    </button>
                </div>
            `;
        } else if (result.type === 2 && result.imageList) {
            html += `
                <div class="result-item full-width">
                    <div class="result-label">图片 (${result.imageList.length}张)</div>
                    <div class="image-grid">
                        ${result.imageList.map((img, idx) => `
                            <div class="image-item">
                                <img src="${escapeHtml(img)}" alt="图片${idx + 1}">
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn-download" onclick="handleDownloadImagesClick()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        下载全部图片
                    </button>
                </div>
            `;
        }

        resultContent.innerHTML = html;

        if (config.autoDownload) {
            if (result.type === 1 && result.videoUrl) {
                setTimeout(() => {
                    const downloadBtn = resultContent.querySelector('.btn-download');
                    if (downloadBtn) {
                        downloadBtn.click();
                    }
                }, 500);
            }
        }
    }

    function showError(message) {
        resultCard.style.display = 'block';
        resultContent.innerHTML = `<div class="error">${message}</div>`;
    }

    window.handleDownload = async (url, title, type) => {
        const btn = event.target.closest('.btn-download');
        if (btn.disabled) return;
        
        try {
            btn.disabled = true;
            btn.textContent = '检查中...';
            
            const config = await ipcRenderer.invoke('load-config');
            const downloadPath = config.downloadPath;

            const folderName = title.substring(0, Math.min(3, title.length)).replace(/[<>:"/\\|?*]/g, '_');
            const targetDir = path.join(downloadPath, folderName);
            const ext = type === 'video' ? '.mp4' : '.jpg';
            const fileName = `${title.replace(/[<>:"/\\|?*]/g, '_')}${ext}`;
            const filePath = path.join(targetDir, fileName);

            if (fs.existsSync(filePath)) {
                showToast('文件已存在，无需重复下载', 'info');
                btn.disabled = false;
                btn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    下载视频
                `;
                return;
            }

            btn.textContent = '下载中...';
            
            let platform = '未知';
            if (url.includes('douyin.com') || 
                url.includes('douyinvod.com') || 
                url.includes('snssdk.com') || 
                url.includes('aweme.snssdk.com') ||
                url.includes('iesdouyin.com')) {
                platform = '抖音';
            } else if (url.includes('xiaohongshu.com') || url.includes('xhscdn.com')) {
                platform = '小红书';
            } else if (url.includes('kuaishou.com') || url.includes('kwcdn.com')) {
                platform = '快手';
            } else if (url.includes('bilibili.com') || url.includes('bilivideo.com') || url.includes('hdslb.com')) {
                platform = 'B站';
            }
            
            await downloadVideo(url, title, type, platform);
            showToast('下载完成', 'success');
            btn.textContent = '已下载';
        } catch (error) {
            showToast('下载失败：' + error.message, 'error');
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                下载视频
            `;
        }
    };

    window.handleDownloadImagesClick = async () => {
        if (!window._currentResult || !window._currentResult.imageList) {
            showToast('数据丢失，请重新解析', 'error');
            return;
        }

        const result = window._currentResult;
        const btn = event.target.closest('.btn-download');
        if (btn.disabled) return;
        
        try {
            btn.disabled = true;
            btn.textContent = `下载中 (0/${result.imageList.length})...`;
            
            let platform = '未知';
            const firstUrl = result.imageList[0] || '';
            if (firstUrl.includes('douyin.com') || 
                firstUrl.includes('douyinvod.com') || 
                firstUrl.includes('snssdk.com') || 
                firstUrl.includes('aweme.snssdk.com') ||
                firstUrl.includes('iesdouyin.com')) {
                platform = '抖音';
            } else if (firstUrl.includes('xiaohongshu.com') || firstUrl.includes('xhscdn.com')) {
                platform = '小红书';
            } else if (firstUrl.includes('kuaishou.com') || firstUrl.includes('kwcdn.com')) {
                platform = '快手';
            } else if (firstUrl.includes('bilibili.com') || firstUrl.includes('bilivideo.com') || firstUrl.includes('hdslb.com')) {
                platform = 'B站';
            }
            
            const results = await downloadImages(
                result.imageList, 
                result.title,
                result.title,
                result.nickName,
                platform
            );
            
            const successCount = results.filter(r => r.success && !r.skipped).length;
            const skippedCount = results.filter(r => r.skipped).length;
            const failedCount = results.filter(r => !r.success).length;
            
            let message = '';
            if (failedCount === 0) {
                if (skippedCount > 0) {
                    message = `下载完成！新增${successCount}张，跳过${skippedCount}张已存在`;
                } else {
                    message = `全部下载完成！共${successCount}张`;
                }
                showToast(message, 'success');
                btn.textContent = '已下载';
            } else {
                message = `部分失败：成功${successCount}张，失败${failedCount}张`;
                showToast(message, 'warning');
                btn.disabled = false;
                btn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    重试下载
                `;
            }
        } catch (error) {
            showToast('下载失败：' + error.message, 'error');
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                下载全部图片
            `;
        }
    };
})();

