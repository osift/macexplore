function showAlert(title, message, type = 'info', callback = null, browserIcon = null, customActions = null) {
    const overlay = document.getElementById('alertOverlay');
    const iconEl = document.getElementById('alertIcon');
    const titleEl = document.getElementById('alertTitle');
    const messageEl = document.getElementById('alertMessage');
    const actionsEl = document.getElementById('alertActions');

    if (browserIcon) {
        iconEl.innerHTML = `<img src="${browserIcon}" style="width: 56px; height: 56px; border-radius: 12px;">`;
    } else {
        const icons = {
            'info': `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 32px; height: 32px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
            'success': `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 32px; height: 32px; color: #4caf50;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
            'warning': `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 32px; height: 32px; color: #ff9800;"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
            'error': `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 32px; height: 32px; color: #f44336;"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>`,
            'question': `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 32px; height: 32px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>`
        };
        iconEl.innerHTML = icons[type] || icons['info'];
    }

    titleEl.textContent = title;
    messageEl.innerHTML = message; 
    alertCallback = callback;

    if (customActions) {
        actionsEl.innerHTML = customActions;
    } else if (type === 'question') {
        actionsEl.innerHTML = `
            <button class="alert-btn" onclick="closeAlert(false)">Cancel</button>
            <button class="alert-btn alert-btn-primary" onclick="closeAlert(true)">Confirm</button>
        `;
    } else {
        actionsEl.innerHTML = `
            <button class="alert-btn alert-btn-primary" onclick="closeAlert(true)">OK</button>
        `;
    }

    overlay.classList.add('show');
}

function closeAlert(result = true) {
    const overlay = document.getElementById('alertOverlay');
    overlay.classList.remove('show');

    if (alertCallback) {
        alertCallback(result);
        alertCallback = null;
    }
}

function showConfirm(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmDialog').classList.add('show');
    document.getElementById('confirmDialog').style.display = 'block';
    confirmCallback = callback;
}

function closeConfirm() {
    document.getElementById('confirmDialog').classList.remove('show');
    document.getElementById('confirmDialog').style.display = 'none';
    confirmCallback = null;
}

function confirmAction() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeConfirm();
}

function openSystemSettings() {
    pywebview.api.open_system_settings('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
}

window.alert = (msg) => showAlert('Notice', msg, 'info');
window.confirm = (msg) => {
    return new Promise(resolve => {
        showAlert('Confirm', msg, 'question', resolve);
    });
};

function showProgressAlert(title, message) {
    const overlay = document.getElementById('alertOverlay');
    const iconEl = document.getElementById('alertIcon');
    const titleEl = document.getElementById('alertTitle');
    const messageEl = document.getElementById('alertMessage');
    const actionsEl = document.getElementById('alertActions');

    iconEl.innerHTML = '<div class="spinner"></div>';
    titleEl.textContent = title;
    messageEl.textContent = message;
    actionsEl.innerHTML = '';

    overlay.classList.add('show');
}

function updateProgressAlert(message) {
    const messageEl = document.getElementById('alertMessage');
    messageEl.textContent = message;
}

function closeProgressAlert() {
    const overlay = document.getElementById('alertOverlay');
    overlay.classList.remove('show');
}

function closeAssociatedModal() {
    document.getElementById('associatedModal').classList.remove('show');
}
