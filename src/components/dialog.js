(function() {
    'use strict';

    function showDialog(options) {
        return new Promise((resolve) => {
            let overlay = document.getElementById('dialogOverlay');
            
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'dialogOverlay';
                overlay.className = 'dialog-overlay';
                overlay.innerHTML = `
                    <div class="dialog-box">
                        <div class="dialog-header">
                            <h3 class="dialog-title"></h3>
                        </div>
                        <div class="dialog-body">
                            <p class="dialog-message"></p>
                        </div>
                        <div class="dialog-footer">
                            <button class="dialog-btn dialog-btn-cancel">取消</button>
                            <button class="dialog-btn dialog-btn-confirm">确定</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);
            }

            const title = overlay.querySelector('.dialog-title');
            const message = overlay.querySelector('.dialog-message');
            const cancelBtn = overlay.querySelector('.dialog-btn-cancel');
            const confirmBtn = overlay.querySelector('.dialog-btn-confirm');

            title.textContent = options.title || '提示';
            message.textContent = options.message || '';
            
            if (options.type === 'confirm') {
                cancelBtn.style.display = 'block';
                cancelBtn.textContent = options.cancelText || '取消';
                confirmBtn.textContent = options.confirmText || '确定';
                
                if (options.danger) {
                    confirmBtn.classList.add('danger');
                } else {
                    confirmBtn.classList.remove('danger');
                }
            } else {
                cancelBtn.style.display = 'none';
                confirmBtn.textContent = options.confirmText || '确定';
                confirmBtn.classList.remove('danger');
            }

            overlay.classList.add('show');

            const handleCancel = () => {
                overlay.classList.remove('show');
                cancelBtn.removeEventListener('click', handleCancel);
                confirmBtn.removeEventListener('click', handleConfirm);
                overlay.removeEventListener('click', handleOverlayClick);
                resolve(false);
            };

            const handleConfirm = () => {
                overlay.classList.remove('show');
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

            cancelBtn.addEventListener('click', handleCancel);
            confirmBtn.addEventListener('click', handleConfirm);
            overlay.addEventListener('click', handleOverlayClick);
        });
    }

    window.showDialog = showDialog;

    window.showConfirm = (message, title = '确认', options = {}) => {
        return showDialog({
            type: 'confirm',
            title: title,
            message: message,
            ...options
        });
    };

    window.showAlert = (message, title = '提示') => {
        return showDialog({
            type: 'alert',
            title: title,
            message: message
        });
    };
})();

