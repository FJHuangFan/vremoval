(function() {
    'use strict';

    function showToast(message, type = 'info', duration = 3000) {
        let container = document.getElementById('toastContainer');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg class="toast-icon success" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            error: '<svg class="toast-icon error" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            info: '<svg class="toast-icon info" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 16V12M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
            warning: '<svg class="toast-icon warning" viewBox="0 0 24 24" fill="none"><path d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64 18.3 1.54 18.63 1.53 18.97C1.52 19.31 1.6 19.65 1.77 19.95C1.93 20.25 2.17 20.5 2.46 20.68C2.75 20.86 3.08 20.96 3.42 20.97H20.58C20.92 20.96 21.25 20.86 21.54 20.68C21.83 20.5 22.07 20.25 22.23 19.95C22.4 19.65 22.48 19.31 22.47 18.97C22.46 18.63 22.36 18.3 22.18 18L13.71 3.86C13.53 3.57 13.28 3.33 12.99 3.16C12.7 3 12.36 2.91 12.02 2.91C11.68 2.91 11.34 3 11.05 3.16C10.76 3.33 10.51 3.57 10.33 3.86H10.29Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        };

        toast.innerHTML = `
            ${icons[type] || icons.info}
            <div class="toast-message">${message}</div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => {
                container.removeChild(toast);
                if (container.children.length === 0) {
                    document.body.removeChild(container);
                }
            }, 300);
        }, duration);
    }

    window.showToast = showToast;
})();

