const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

(function() {
    'use strict';

    document.getElementById('minimizeBtn').addEventListener('click', () => {
        ipcRenderer.send('window-minimize');
    });

    document.getElementById('maximizeBtn').addEventListener('click', () => {
        ipcRenderer.send('window-maximize');
    });

    document.getElementById('closeBtn').addEventListener('click', () => {
        ipcRenderer.send('window-close');
    });

    const verPath = path.join(__dirname, '../../../ver.json');
    if (fs.existsSync(verPath)) {
        const verData = JSON.parse(fs.readFileSync(verPath, 'utf-8'));
        document.getElementById('versionText').textContent = `v${verData.version}`;
    }

    const menuItems = document.querySelectorAll('.menu-item');
    const contentFrame = document.getElementById('contentFrame');
    const pageCache = new Map();
    let currentPage = null;

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(mi => mi.classList.remove('active'));
            item.classList.add('active');

            const page = item.getAttribute('data-page');
            showPage(page);
        });
    });

    function showPage(page) {
        if (currentPage === page) return;

        if (currentPage && pageCache.has(currentPage)) {
            const currentContainer = pageCache.get(currentPage);
            currentContainer.style.display = 'none';
        }

        if (pageCache.has(page)) {
            const pageContainer = pageCache.get(page);
            pageContainer.style.display = 'block';
            currentPage = page;
        } else {
            loadPage(page);
        }
    }

    function loadPage(page) {
        const pagePath = path.join(__dirname, `../${page}/index.html`);
        if (fs.existsSync(pagePath)) {
            const content = fs.readFileSync(pagePath, 'utf-8');
            
            const pageContainer = document.createElement('div');
            pageContainer.className = 'page-container';
            pageContainer.setAttribute('data-page', page);
            pageContainer.innerHTML = content;
            
            if (currentPage && pageCache.has(currentPage)) {
                const currentContainer = pageCache.get(currentPage);
                currentContainer.style.display = 'none';
            }
            
            contentFrame.appendChild(pageContainer);
            pageCache.set(page, pageContainer);
            currentPage = page;

            const cssPath = path.join(__dirname, `../${page}/index.css`);
            if (fs.existsSync(cssPath)) {
                const existingLink = document.querySelector(`link[data-page-style="${page}"]`);
                if (!existingLink) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = `../${page}/index.css`;
                    link.setAttribute('data-page-style', page);
                    document.head.appendChild(link);
                }
            }

            setTimeout(() => {
                const scriptPath = path.join(__dirname, `../${page}/index.js`);
                if (fs.existsSync(scriptPath)) {
                    const existingScript = document.querySelector(`script[data-page-script="${page}"]`);
                    if (!existingScript) {
                        const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
                        const script = document.createElement('script');
                        script.setAttribute('data-page-script', page);
                        script.textContent = scriptContent;
                        document.body.appendChild(script);
                    }
                }
            }, 50);
        }
    }

    loadPage('parser');
})();

