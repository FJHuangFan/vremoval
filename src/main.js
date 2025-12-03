const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadConfig, saveConfig, getConfigPath } = require(path.join(__dirname, 'utils/config.js'));

let mainWindow = null;
let splashWindow = null;
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        createSplashWindow();
        
        await initializeApp();
        
        createMainWindow();
    });
}

async function initializeApp() {
    const tasks = [
        { name: '加载配置文件', delay: 200, action: () => {
            const config = loadConfig();
            if (!fs.existsSync(config.downloadPath)) {
                fs.mkdirSync(config.downloadPath, { recursive: true });
            }
        }},
        { name: '初始化资源', delay: 300, action: () => {} },
        { name: '检查更新', delay: 400, action: () => {} },
        { name: '准备就绪', delay: 300, action: () => {} }
    ];
    
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const progress = Math.round(((i + 1) / tasks.length) * 100);
        
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.webContents.send('loading-progress', {
                progress,
                message: task.name
            });
        }
        
        task.action();
        await new Promise(resolve => setTimeout(resolve, task.delay));
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
}

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 400,
        height: 300,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    splashWindow.loadFile(path.join(__dirname, 'components/splash.html'));
    splashWindow.center();
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 1024,
        minHeight: 576,
        frame: false,
        show: false,
        icon: path.join(__dirname, 'assets/image/logo.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'pages/home/index.html'));

    mainWindow.once('ready-to-show', () => {
        if (splashWindow) {
            splashWindow.close();
            splashWindow = null;
        }
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result;
});

ipcMain.handle('get-config-path', () => {
    return getConfigPath();
});

ipcMain.handle('load-config', () => {
    return loadConfig();
});

ipcMain.handle('save-config', (event, config) => {
    return saveConfig(config);
});

ipcMain.handle('show-context-menu', async (event, menuItems) => {
    const { Menu } = require('electron');
    
    return new Promise((resolve) => {
        const menu = Menu.buildFromTemplate(
            menuItems.map(item => {
                if (item.type === 'separator') {
                    return { type: 'separator' };
                }
                return {
                    label: item.label,
                    enabled: item.enabled !== false,
                    click: () => resolve(item.action)
                };
            })
        );
        
        menu.popup({
            callback: () => resolve(null)
        });
    });
});

ipcMain.handle('convert-image-to-jpg', async (event, imageBuffer) => {
    try {
        const sharp = require('sharp');
        
        const jpgBuffer = await sharp(imageBuffer)
            .jpeg({
                quality: 90,
                mozjpeg: true
            })
            .toBuffer();
        
        return jpgBuffer;
    } catch (error) {
        console.error('图片转换失败:', error);
        return imageBuffer;
    }
});

ipcMain.handle('fetch-url', async (event, url, options = {}) => {
    const { net } = require('electron');
    
    return new Promise((resolve, reject) => {
        const request = net.request({
            method: options.method || 'GET',
            url: url,
            redirect: options.redirect === 'manual' ? 'manual' : 'follow'
        });

        if (options.headers) {
            for (const [key, value] of Object.entries(options.headers)) {
                request.setHeader(key, value);
            }
        }

        let finalUrl = url;
        let isRedirected = false;

        request.on('redirect', (statusCode, method, redirectUrl, responseHeaders) => {
            finalUrl = redirectUrl;
            isRedirected = true;
            
            if (options.redirect === 'manual') {
                request.abort();
                resolve({
                    statusCode: statusCode,
                    headers: responseHeaders,
                    data: Buffer.alloc(0),
                    url: redirectUrl,
                    isRedirect: true
                });
            }
        });

        request.on('response', (response) => {
            let data = Buffer.alloc(0);
            const contentLength = parseInt(response.headers['content-length'] || '0');
            let receivedLength = 0;

            response.on('data', (chunk) => {
                data = Buffer.concat([data, chunk]);
                receivedLength += chunk.length;
                
                if (options.onProgress && contentLength > 0) {
                    const progress = Math.round((receivedLength / contentLength) * 100);
                    event.sender.send('download-progress', { 
                        url, 
                        progress, 
                        receivedLength, 
                        contentLength 
                    });
                }
            });

            response.on('end', () => {
                if (options.onProgress && contentLength > 0) {
                    event.sender.send('download-progress', { 
                        url, 
                        progress: 100, 
                        receivedLength: contentLength, 
                        contentLength 
                    });
                }
                
                const contentType = response.headers['content-type'] || '';
                let resultData = data;
                
                if (contentType.includes('text/html') || contentType.includes('application/json')) {
                    resultData = data.toString('utf-8');
                }
                
                resolve({
                    statusCode: response.statusCode,
                    headers: response.headers,
                    data: resultData,
                    url: finalUrl,
                    isRedirect: isRedirected
                });
            });

            response.on('error', (error) => {
                reject(error);
            });
        });

        request.on('error', (error) => {
            reject(error);
        });

        request.end();
    });
});

const downloadCache = {
    tasks: new Map(),
    addTask(url, data) {
        this.tasks.set(url, { ...data, status: 'downloading', progress: 0 });
    },
    updateProgress(url, progress, receivedLength, contentLength) {
        const task = this.tasks.get(url);
        if (task) {
            task.progress = progress;
            task.receivedLength = receivedLength;
            task.contentLength = contentLength;
        }
    },
    completeTask(url, filePath, targetDir) {
        const task = this.tasks.get(url);
        if (task) {
            task.status = 'completed';
            task.filePath = filePath;
            task.targetDir = targetDir;
            task.progress = 100;
        }
    },
    errorTask(url, error) {
        const task = this.tasks.get(url);
        if (task) {
            task.status = 'error';
            task.error = error;
        }
    },
    getAllTasks() {
        return Array.from(this.tasks.entries()).map(([url, data]) => ({ url, ...data }));
    }
};

ipcMain.handle('get-download-tasks', () => {
    return downloadCache.getAllTasks();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

ipcMain.on('download-start', (event, data) => {
    downloadCache.addTask(data.url, data);
    if (mainWindow) {
        mainWindow.webContents.send('download-start', data);
    }
});

ipcMain.on('download-progress', (event, data) => {
    downloadCache.updateProgress(data.url, data.progress, data.receivedLength, data.contentLength);
});

ipcMain.on('download-complete', (event, data) => {
    downloadCache.completeTask(data.url, data.filePath, data.targetDir);
    if (mainWindow) {
        mainWindow.webContents.send('download-complete', data);
    }
});

ipcMain.on('download-error', (event, data) => {
    downloadCache.errorTask(data.url, data.error);
    if (mainWindow) {
        mainWindow.webContents.send('download-error', data);
    }
});

ipcMain.on('download-batch-start', (event, data) => {
    downloadCache.addTask(data.batchId, { ...data, isBatch: true });
    if (mainWindow) {
        mainWindow.webContents.send('download-batch-start', data);
    }
});

ipcMain.on('download-batch-progress', (event, data) => {
    const progress = Math.round((data.current / data.total) * 100);
    downloadCache.updateProgress(data.batchId, progress, data.current, data.total);
    if (mainWindow) {
        mainWindow.webContents.send('download-batch-progress', data);
    }
});

ipcMain.on('download-batch-complete', (event, data) => {
    downloadCache.completeTask(data.batchId, data.targetDir, data.targetDir);
    if (mainWindow) {
        mainWindow.webContents.send('download-batch-complete', data);
    }
});

ipcMain.on('download-batch-error', (event, data) => {
    downloadCache.errorTask(data.batchId, data.error);
    if (mainWindow) {
        mainWindow.webContents.send('download-batch-error', data);
    }
});

app.on('before-quit', () => {
    const { exec } = require('child_process');
    if (process.platform === 'win32') {
        exec('taskkill /F /IM electron.exe /T', (err) => {
            if (err) console.error('清理进程失败:', err);
        });
    }
});

