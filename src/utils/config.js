const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function getConfigPath() {
    const isDev = !app.isPackaged;
    const userDataPath = isDev ? process.cwd() : app.getPath('userData');
    return path.join(userDataPath, 'config.json');
}

function getDefaultConfig() {
    const isDev = !app.isPackaged;
    const defaultPath = isDev 
        ? path.join(process.cwd(), '下载的视频')
        : path.join(app.getPath('downloads'), '视频解析工具');
    
    return {
        downloadPath: defaultPath,
        autoDownload: false
    };
}

function loadConfig() {
    const configPath = getConfigPath();
    
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            return { ...getDefaultConfig(), ...config };
        } catch (error) {
            console.error('读取配置失败:', error);
            return getDefaultConfig();
        }
    }
    
    return getDefaultConfig();
}

function saveConfig(config) {
    const configPath = getConfigPath();
    
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('保存配置失败:', error);
        return false;
    }
}

module.exports = {
    getConfigPath,
    getDefaultConfig,
    loadConfig,
    saveConfig
};

