(function() {
    'use strict';

    const path = require('path');
    const fs = require('fs');
    const { ipcRenderer } = require('electron');

    const downloadPathInput = document.getElementById('downloadPath');
    const selectPathBtn = document.getElementById('selectPathBtn');
    const autoDownloadInput = document.getElementById('autoDownload');
    const saveBtn = document.getElementById('saveBtn');
    const aboutVersion = document.getElementById('aboutVersion');

    async function loadConfig() {
        const config = await ipcRenderer.invoke('load-config');
        
        downloadPathInput.value = config.downloadPath;
        autoDownloadInput.checked = config.autoDownload;
    }

    async function saveConfigHandler() {
        const config = {
            downloadPath: downloadPathInput.value,
            autoDownload: autoDownloadInput.checked
        };

        const success = await ipcRenderer.invoke('save-config', config);
        
        if (success) {
            showToast('保存成功', 'success');
        } else {
            showToast('保存失败', 'error');
        }
    }

    selectPathBtn.addEventListener('click', async () => {
        const result = await ipcRenderer.invoke('select-directory');

        if (!result.canceled && result.filePaths.length > 0) {
            downloadPathInput.value = result.filePaths[0];
        }
    });

    saveBtn.addEventListener('click', saveConfigHandler);

    const verPath = path.join(__dirname, '../../../ver.json');
    if (fs.existsSync(verPath)) {
        const verData = JSON.parse(fs.readFileSync(verPath, 'utf-8'));
        aboutVersion.textContent = `版本 ${verData.version}`;
    }

    loadConfig();
})();

