(function() {
    'use strict';
    
    const { ipcRenderer } = require('electron');
    const progressFill = document.querySelector('.progress-fill');
    const loadingText = document.querySelector('.loading-text');
    
    ipcRenderer.on('loading-progress', (event, data) => {
        const { progress, message } = data;
        
        progressFill.style.width = `${progress}%`;
        loadingText.textContent = `${message}... ${progress}%`;
    });
})();

