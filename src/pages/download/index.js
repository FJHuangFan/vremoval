(function() {
    'use strict';

    const { ipcRenderer, shell } = require('electron');
    const fs = require('fs');
    const path = require('path');
    
    const downloadList = document.querySelector('#downloadList') || document.getElementById('downloadList');
    const downloadTasks = new Map();
    
    function showToast(message, type = 'info', duration = 3000) {
        try {
            if (window.showToast && typeof window.showToast === 'function') {
                window.showToast(message, type, duration);
                return;
            }
        } catch (e) {
            console.error('调用window.showToast失败:', e);
        }
        
        console.log(`[Toast] ${type}: ${message}`);
        
        try {
            let container = document.getElementById('toastContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toastContainer';
                container.className = 'toast-container';
                container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000;';
                document.body.appendChild(container);
            }

            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.style.cssText = 'padding: 12px 20px; margin-bottom: 10px; border-radius: 4px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15);';
            toast.innerHTML = `<div class="toast-message" style="color: #333;">${message}</div>`;
            container.appendChild(toast);

            setTimeout(() => {
                try {
                    if (toast.parentNode === container) {
                        container.removeChild(toast);
                    }
                } catch (e) {
                    console.error('移除toast失败:', e);
                }
            }, duration);
        } catch (e) {
            console.error('创建toast失败:', e);
        }
    }
    
    async function showConfirm(message, title = '确认', options = {}) {
        return new Promise((resolve) => {
            try {
                let overlay = document.getElementById('downloadDialogOverlay');
                
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'downloadDialogOverlay';
                    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 9999;';
                    overlay.innerHTML = `
                        <div class="dialog-box" style="background: #fff; border-radius: 8px; padding: 24px; min-width: 300px; max-width: 500px;">
                            <div class="dialog-header" style="margin-bottom: 16px;">
                                <h3 class="dialog-title" style="margin: 0; font-size: 18px; color: #333;"></h3>
                            </div>
                            <div class="dialog-body" style="margin-bottom: 24px;">
                                <p class="dialog-message" style="margin: 0; color: #666; line-height: 1.5;"></p>
                            </div>
                            <div class="dialog-footer" style="display: flex; justify-content: flex-end; gap: 12px;">
                                <button class="dialog-btn-cancel" style="padding: 8px 16px; border: 1px solid #ddd; border-radius: 4px; background: #fff; cursor: pointer;">取消</button>
                                <button class="dialog-btn-confirm" style="padding: 8px 16px; border: none; border-radius: 4px; background: #4299e1; color: #fff; cursor: pointer;">确定</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(overlay);
                }

                const dialogBox = overlay.querySelector('.dialog-box');
                const titleEl = overlay.querySelector('.dialog-title');
                const messageEl = overlay.querySelector('.dialog-message');
                const cancelBtn = overlay.querySelector('.dialog-btn-cancel');
                const confirmBtn = overlay.querySelector('.dialog-btn-confirm');

                if (!titleEl || !messageEl || !cancelBtn || !confirmBtn) {
                    console.error('Dialog元素未找到');
                    resolve(confirm(message));
                    return;
                }

                titleEl.textContent = title || '确认';
                messageEl.textContent = message || '';
                cancelBtn.textContent = options.cancelText || '取消';
                confirmBtn.textContent = options.confirmText || '确定';
                
                if (options.danger) {
                    confirmBtn.style.background = '#f56565';
                } else {
                    confirmBtn.style.background = '#4299e1';
                }

                overlay.style.display = 'flex';

                const handleCancel = () => {
                    overlay.style.display = 'none';
                    cancelBtn.removeEventListener('click', handleCancel);
                    confirmBtn.removeEventListener('click', handleConfirm);
                    overlay.removeEventListener('click', handleOverlayClick);
                    resolve(false);
                };

                const handleConfirm = () => {
                    overlay.style.display = 'none';
                    cancelBtn.removeEventListener('click', handleCancel);
                    confirmBtn.removeEventListener('click', handleConfirm);
                    overlay.removeEventListener('click', handleOverlayClick);
                    resolve(true);
                };

                const handleOverlayClick = (e) => {
                    if (e.target === overlay) {
                        handleCancel();
                    }
                };

                const newCancelBtn = cancelBtn.cloneNode(true);
                const newConfirmBtn = confirmBtn.cloneNode(true);
                cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
                confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                
                newCancelBtn.addEventListener('click', handleCancel);
                newConfirmBtn.addEventListener('click', handleConfirm);
                overlay.addEventListener('click', handleOverlayClick);
            } catch (e) {
                console.error('创建dialog失败:', e);
                resolve(false);
            }
        });
    }

    function addDownloadTask(data) {
        const { url, title, isText, thumbnail } = data;
        
        if (downloadTasks.has(url)) {
            return;
        }
        
        let thumbnailHtml = '';
        if (isText) {
            thumbnailHtml = `
                <div class="download-thumbnail" style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M14 2V8H20" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M16 13H8" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M16 17H8" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M10 9H8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            `;
        } else if (thumbnail) {
            thumbnailHtml = `
                <div class="download-thumbnail" style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: #f7fafc;">
                    <img src="${thumbnail}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;\\'>📷</div>'">
                </div>
            `;
        }
        
        const taskHtml = `
            <div class="download-item" data-url="${url}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px;">
                ${thumbnailHtml}
                <div class="download-info" style="flex: 1; min-width: 0;">
                    <div class="download-name" style="font-size: 14px; color: #2d3748; margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</div>
                    <div class="download-progress" style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-bottom: 6px;">
                        <div class="download-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #4299e1 0%, #667eea 100%); transition: width 0.3s;"></div>
                    </div>
                    <div class="download-status" style="font-size: 12px; color: #718096;">准备下载...</div>
                </div>
                <div class="download-actions" style="display: none; gap: 8px;">
                    <button class="btn-icon btn-open" title="打开目录" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4299e1" stroke-width="2">
                            <path d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H13L11 5H5C3.89543 5 3 5.89543 3 7Z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="btn-icon btn-delete" title="删除" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f56565" stroke-width="2">
                            <path d="M3 6H5H21" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6H19Z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        const emptyState = downloadList.querySelector('.empty-state');
        if (emptyState) {
            downloadList.innerHTML = '';
        }
        
        downloadList.insertAdjacentHTML('beforeend', taskHtml);
        downloadTasks.set(url, data);
    }

    async function loadCachedTasks() {
        try {
            const tasks = await ipcRenderer.invoke('get-download-tasks');
            // console.log('加载缓存任务:', tasks.length);
            
            for (const task of tasks) {
                addDownloadTask(task);
                
                if (task.status === 'completed') {
                    const taskElement = downloadList.querySelector(`[data-url="${task.url}"]`);
                    if (taskElement) {
                        const progressBar = taskElement.querySelector('.download-progress-bar');
                        const statusText = taskElement.querySelector('.download-status');
                        const actions = taskElement.querySelector('.download-actions');
                        
                        progressBar.style.width = '100%';
                        statusText.textContent = '下载完成';
                        actions.style.display = 'flex';
                        
                        setupDownloadActions(taskElement, task.url, task.filePath, task.targetDir);
                    }
                } else if (task.status === 'downloading' && task.progress > 0) {
                    const taskElement = downloadList.querySelector(`[data-url="${task.url}"]`);
                    if (taskElement) {
                        const progressBar = taskElement.querySelector('.download-progress-bar');
                        const statusText = taskElement.querySelector('.download-status');
                        
                        progressBar.style.width = `${task.progress}%`;
                        statusText.textContent = `${task.progress}% - ${formatBytes(task.receivedLength || 0)} / ${formatBytes(task.contentLength || 0)}`;
                    }
                } else if (task.status === 'error') {
                    const taskElement = downloadList.querySelector(`[data-url="${task.url}"]`);
                    if (taskElement) {
                        const statusText = taskElement.querySelector('.download-status');
                        statusText.textContent = '下载失败';
                        statusText.style.color = '#f56565';
                    }
                }
            }
        } catch (error) {
            console.error('加载缓存任务失败:', error);
        }
    }

    ipcRenderer.on('download-start', (event, data) => {
        addDownloadTask(data);
    });

    ipcRenderer.on('download-batch-start', (event, data) => {
        const { batchId, title, total, targetDir, thumbnail } = data;
        addDownloadTask({
            url: batchId,
            title: `${title} (共${total}项)`,
            targetDir,
            thumbnail,
            isBatch: true
        });
    });

    ipcRenderer.on('download-batch-progress', (event, data) => {
        const { batchId, current, total, message } = data;
        
        const taskElement = downloadList.querySelector(`[data-url="${batchId}"]`);
        if (taskElement) {
            const progressBar = taskElement.querySelector('.download-progress-bar');
            const statusText = taskElement.querySelector('.download-status');
            
            const progress = Math.round((current / total) * 100);
            progressBar.style.width = `${progress}%`;
            statusText.textContent = `${progress}% - ${message}`;
        }
    });

    ipcRenderer.on('download-batch-complete', (event, data) => {
        const { batchId, targetDir, successCount, totalCount } = data;
        
        const taskElement = downloadList.querySelector(`[data-url="${batchId}"]`);
        if (taskElement) {
            const progressBar = taskElement.querySelector('.download-progress-bar');
            const statusText = taskElement.querySelector('.download-status');
            const actionsDiv = taskElement.querySelector('.download-actions');
            
            progressBar.style.width = '100%';
            statusText.textContent = `下载完成 (${successCount}/${totalCount})`;
            statusText.style.color = '#48bb78';
            actionsDiv.style.display = 'flex';
            
            setupDownloadActions(taskElement, batchId, targetDir, targetDir);
        }
    });

    ipcRenderer.on('download-batch-error', (event, data) => {
        const { batchId, error } = data;
        
        const taskElement = downloadList.querySelector(`[data-url="${batchId}"]`);
        if (taskElement) {
            const statusText = taskElement.querySelector('.download-status');
            statusText.textContent = '下载失败：' + error;
            statusText.style.color = '#f56565';
        }
    });

    ipcRenderer.on('download-progress', (event, data) => {
        const { url, progress, receivedLength, contentLength } = data;
        
        const taskElement = downloadList.querySelector(`[data-url="${url}"]`);
        if (taskElement) {
            const progressBar = taskElement.querySelector('.download-progress-bar');
            const statusText = taskElement.querySelector('.download-status');
            
            progressBar.style.width = `${progress}%`;
            statusText.textContent = `${progress}% - ${formatBytes(receivedLength)} / ${formatBytes(contentLength)}`;
        }
    });

    function setupDownloadActions(taskElement, url, filePath, targetDir) {
        const taskData = downloadTasks.get(url);
        if (taskData) {
            taskData.filePath = filePath;
            taskData.targetDir = targetDir;
        }
        
        const openBtn = taskElement.querySelector('.btn-open');
        const deleteBtn = taskElement.querySelector('.btn-delete');
        
        const newOpenBtn = openBtn.cloneNode(true);
        const newDeleteBtn = deleteBtn.cloneNode(true);
        openBtn.replaceWith(newOpenBtn);
        deleteBtn.replaceWith(newDeleteBtn);
        
        newOpenBtn.addEventListener('click', () => {
            shell.showItemInFolder(filePath);
        });
        
        newDeleteBtn.addEventListener('click', async () => {
            try {
                const confirmed = await showConfirm(
                    '删除后将无法恢复，确定要删除此内容吗？',
                    '确认删除',
                    { danger: true, confirmText: '删除', cancelText: '取消' }
                );
                
                if (confirmed) {
                    try {
                        const taskData = downloadTasks.get(url);
                        const isBatch = taskData && taskData.isBatch;
                        
                        if (isBatch) {
                            if (targetDir && fs.existsSync(targetDir)) {
                                fs.rmSync(targetDir, { recursive: true, force: true });
                                // console.log('删除整个目录:', targetDir);
                            }
                        } else {
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                            }
                            
                            if (targetDir && fs.existsSync(targetDir)) {
                                const files = fs.readdirSync(targetDir);
                                if (files.length === 0) {
                                    fs.rmdirSync(targetDir);
                                    // console.log('目录已清空，删除目录:', targetDir);
                                }
                            }
                        }
                        
                        downloadTasks.delete(url);
                        taskElement.remove();
                        
                        showToast('删除成功', 'success');
                        
                        if (downloadTasks.size === 0) {
                            loadDownloadList();
                        }
                    } catch (deleteError) {
                        console.error('文件删除错误:', deleteError);
                        showToast('删除失败：' + deleteError.message, 'error');
                    }
                }
            } catch (error) {
                console.error('删除操作错误:', error);
                showToast('操作失败：' + error.message, 'error');
            }
        });
    }

    ipcRenderer.on('download-complete', (event, data) => {
        const { url, filePath, targetDir } = data;
        
        const taskElement = downloadList.querySelector(`[data-url="${url}"]`);
        if (taskElement) {
            const progressBar = taskElement.querySelector('.download-progress-bar');
            const statusText = taskElement.querySelector('.download-status');
            const actionsDiv = taskElement.querySelector('.download-actions');
            
            progressBar.style.width = '100%';
            statusText.textContent = '下载完成';
            statusText.style.color = '#48bb78';
            actionsDiv.style.display = 'flex';
            
            setupDownloadActions(taskElement, url, filePath, targetDir);
        }
    });

    ipcRenderer.on('download-error', (event, data) => {
        const { url, error } = data;
        
        const taskElement = downloadList.querySelector(`[data-url="${url}"]`);
        if (taskElement) {
            const statusText = taskElement.querySelector('.download-status');
            statusText.textContent = '下载失败：' + error;
            statusText.style.color = '#f56565';
        }
    });

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    function loadDownloadList() {
        if (downloadTasks.size === 0) {
            downloadList.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="opacity: 0.3;">
                        <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <p>暂无下载任务</p>
                </div>
            `;
        }
    }

    loadCachedTasks();
})();

