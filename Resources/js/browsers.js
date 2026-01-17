let extensionsLoading = false;

async function recheckBrowserPermissions() {
    try {
        const result = await pywebview.api.check_full_disk_access();
        if (result.has_access) {
            await loadBrowsers();
        } else {
            showAlert('Permission Denied', 'Full Disk Access is still not granted. Please enable it in System Settings and try again.', 'warning');
        }
    } catch (error) {
        showAlert('Error', 'Failed to check permissions: ' + error.message, 'error');
    }
}

async function loadBrowsers() {

    const myContextId = resetState('browser');

    const browsersView = document.getElementById('browsersView');
    const emptyState = document.getElementById('emptyState');
    const itemsContainer = document.getElementById('itemsContainer');

    if (itemsContainer) itemsContainer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';

    try {
        const browsers = await pywebview.api.scan_browsers();

        if (activeContextId !== myContextId) {
            console.log('Browser load cancelled - context switched');
            return;
        }

        if (!browsers || browsers.length === 0) {
            browsersView.style.display = 'none';
            if (emptyState) {
                emptyState.innerHTML = `
                    <div class="empty-icon">🌐</div>
                    <div class="empty-title">No Browsers Found</div>
                    <div class="empty-text">No supported browsers are currently installed</div>
                `;
                emptyState.style.display = 'flex';
            }
            document.getElementById('totalItems').textContent = 0;
            document.getElementById('selectedCount').textContent = 0;
            document.getElementById('totalSize').textContent = '0 B';
            return;
        }

        browsersView.style.display = 'block';

        document.getElementById('totalItems').textContent = browsers.length;
        document.getElementById('selectedCount').textContent = 0;
        document.getElementById('totalSize').textContent = '0 B';

        const container = document.getElementById('browsersView');
        let html = '';

        html += browsers.map(browser => {
            const needsPermission = browser.needs_permission === true;

            return `
                <div class="browser-card">
                    <div class="browser-header" style="margin-bottom: 24px;">
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <img src="${browser.icon}" style="width: 64px; height: 64px; border-radius: 14px; ${needsPermission ? 'opacity: 0.5;' : ''}" alt="">
                            <div style="flex: 1;">
                                <div class="browser-name" style="font-size: 22px; margin-bottom: 6px;">${browser.name}</div>
                                <div style="font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 12px;">
                                    ${needsPermission ? '<span style="color: rgba(255, 193, 7, 0.9);">Full Disk Access Required</span>' : browser.total_size + ' total'}
                                    ${needsPermission ? '<button class="btn" style="padding: 0 16px; height: 32px; font-size: 12px;" onclick="openSystemSettings()">Open System Settings</button>' : ''}
                                </div>
                            </div>
                            ${!needsPermission && browser.name !== 'Safari' ? `<button class="btn btn-danger" onclick="uninstallBrowser('${browser.name}', '${browser.icon}')">Uninstall</button>` : ''}
                        </div>
                    </div>
                    <div class="browser-stats">
                        <div class="browser-stat">
                            <div class="browser-stat-value">${browser.history_size}</div>
                            <div class="browser-stat-label">History</div>
                        </div>
                        <div class="browser-stat">
                            <div class="browser-stat-value">${browser.cookies_count}</div>
                            <div class="browser-stat-label">Cookies</div>
                        </div>
                        <div class="browser-stat">
                            <div class="browser-stat-value">${browser.extensions}</div>
                            <div class="browser-stat-label">Extensions</div>
                        </div>
                        <div class="browser-stat">
                            <div class="browser-stat-value">${browser.cache_size}</div>
                            <div class="browser-stat-label">Cache</div>
                        </div>
                        <div class="browser-stat">
                            <div class="browser-stat-value">${browser.passwords_count}</div>
                            <div class="browser-stat-label">Passwords</div>
                        </div>
                        <div class="browser-stat">
                            <div class="browser-stat-value">${browser.autofill_count}</div>
                            <div class="browser-stat-label">Autofill</div>
                        </div>
                    </div>
                    ${!needsPermission ? `<div class="browser-actions">
                            <button class="btn btn-action" onclick="clearBrowserData('${browser.name}', ['history'], '${browser.icon}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                                Clear History
                            </button>
                            <button class="btn btn-action" onclick="clearBrowserData('${browser.name}', ['cache'], '${browser.icon}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46C10.21 6.23 11.08 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3 0 1.13-.64 2.11-1.56 2.62l1.45 1.45C23.16 18.16 24 16.68 24 15c0-2.64-2.05-4.78-4.65-4.96zM3 5.27l2.75 2.74C2.56 8.15 0 10.77 0 14c0 3.31 2.69 6 6 6h11.73l2 2L21 20.73 4.27 4 3 5.27zM7.73 10l8 8H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h1.73z"/></svg>
                                Clear Cache
                            </button>
                            <button class="btn btn-action" onclick="clearBrowserData('${browser.name}', ['cookies'], '${browser.icon}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                                Clear Cookies
                            </button>
                            <button class="btn btn-action" onclick="viewExtensions('${browser.name}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/></svg>
                                Extensions
                            </button>
                            <button class="btn btn-action" onclick="clearAllBrowserData('${browser.name}', '${browser.icon}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                                Clear All Data
                            </button>
                        </div>` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = html;

        if (emptyState) emptyState.style.display = 'none';

    } catch (error) {

        if (activeContextId === myContextId) {
            browsersView.style.display = 'none';
            if (emptyState) {
                emptyState.innerHTML = `
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-title">Scan Failed</div>
                    <div class="empty-text">Could not scan browsers: ${error.message || 'Unknown error'}</div>
                `;
                emptyState.style.display = 'flex';
            }
        }
    }
}

async function uninstallBrowser(browserName, browserIcon) {
    const confirmed = await confirm(`Uninstall ${browserName}? This will move the app to trash.`);
    if (!confirmed) return;

    const browserPaths = {
        "Brave": "/Applications/Brave Browser.app",
        "Chrome": "/Applications/Google Chrome.app",
        "Firefox": "/Applications/Firefox.app",
        "Arc": "/Applications/Arc.app",
        "Edge": "/Applications/Microsoft Edge.app"
    };

    const appPath = browserPaths[browserName];
    if (appPath) {
        try {
            showProgressAlert('Uninstalling', `Removing ${browserName}...`);
            await pywebview.api.deep_clean([appPath], true);
            closeProgressAlert();

            showAlert('Success', `${browserName} has been moved to trash`, 'success', null, browserIcon);
            await loadBrowsers();
            await updateCounts();
        } catch (error) {
            closeProgressAlert();
            showAlert('Error', error.message, 'error');
        }
    }
}

function shouldShowBrowserWarning(browserName) {
    const cooldownKey = `browser_${browserName}`;
    const now = Date.now();

    if (cooldowns[cooldownKey] && (now - cooldowns[cooldownKey]) < 600000) {
        return false;
    }

    return true;
}

async function clearAllBrowserData(browserName, browserIcon) {
    if (shouldShowBrowserWarning(browserName)) {
        const confirmed = await confirm(`Clear all data for ${browserName}?\n\nThis will remove:\n• History\n• Cache\n• Cookies\n• Passwords\n• Autofill data\n\nThis action cannot be undone.`);
        if (!confirmed) return;

        cooldowns[`browser_${browserName}`] = Date.now();
    }

    await clearBrowserData(browserName, ['history', 'cache', 'cookies'], browserIcon);
}

async function clearBrowserData(browser, dataTypes, browserIcon) {
    if (shouldShowBrowserWarning(browser)) {
        const typeStr = dataTypes.join(', ');
        const confirmed = await confirm(`Clear ${typeStr} for ${browser}?\n\nThis action cannot be undone.`);
        if (!confirmed) return;

        cooldowns[`browser_${browser}`] = Date.now();
    }

    try {
        showProgressAlert('Clearing Data', `Clearing ${dataTypes.join(', ')} for ${browser}...`);

        const results = await pywebview.api.clear_browser_data(browser, dataTypes);
        const isRunning = await pywebview.api.is_app_running(browser);

        closeProgressAlert();

        const clearedItems = results.success.length > 0 ? results.success.join(', ') : 'No items';

        if (isRunning) {

            const message = `Cleared: ${clearedItems}\n\n${browser} is currently running. Please restart ${browser} for changes to take effect.`;
            showAlert('Success', message, 'success', null, browserIcon);
        } else {

            showAlert('Success', `Cleared: ${clearedItems}`, 'success', null, browserIcon);
        }

        await loadBrowsers();
    } catch (error) {
        closeProgressAlert();
        showAlert('Error', error.message, 'error');
    }
}

async function viewExtensions(browser) {
    if (extensionsLoading) return;

    extensionsLoading = true;

    try {
        const modal = document.getElementById('associatedModal');
        document.getElementById('associatedModalTitle').textContent = `${browser} Extensions`;

        const body = document.getElementById('associatedModalBody');
        body.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="spinner"></div>
                <div style="margin-top: 16px; color: var(--text-secondary);">Loading extensions...</div>
            </div>
        `;

        modal.classList.add('show');

        const extensions = await pywebview.api.get_browser_extensions(browser);

        if (extensions.length === 0) {
            body.innerHTML = `<div class="modal-note">No extensions installed</div>`;
        } else {
            body.innerHTML = `
                <div class="extension-list">
                    ${extensions.map(ext => `
                        <div class="extension-item">
                            <div>
                                <div class="extension-name">${ext.name}</div>
                                <div class="extension-meta">${ext.version} • ${ext.size}</div>
                            </div>
                            <button class="btn btn-danger" onclick="removeExtension('${browser}', '${ext.id}', '${ext.path.replace(/'/g, "\\'")}', '${ext.name.replace(/'/g, "\\'")}')" style="height: 28px; padding: 0 12px; font-size: 11px;">Remove</button>
                        </div>
                    `).join('')}
                </div>
            `;
        }

    } catch (error) {
        document.getElementById('associatedModalBody').innerHTML = `<div class="modal-note">Error loading extensions</div>`;
    } finally {
        extensionsLoading = false;
    }
}

async function removeExtension(browser, extId, extPath, extName) {
    // Check if browser is running
    const isRunning = await pywebview.api.is_app_running(browser) === 'true';

    let confirmMsg = `Remove ${extName}?`;
    if (isRunning) {
        confirmMsg += `\n\n${browser} is running. Restart required after removal.`;
    }

    const confirmed = await confirm(confirmMsg);
    if (!confirmed) return;

    try {
        showProgressAlert('Removing Extension', `Removing ${extName}...`);
        await pywebview.api.deep_clean([extPath], false);
        closeProgressAlert();

        if (isRunning) {
            const message = `Extension removed successfully.\n\n${browser} is running. Please restart ${browser} for changes to take effect.`;
            showAlert('Success', message, 'success');
            viewExtensions(browser);
        } else {
            showAlert('Success', 'Extension removed successfully.', 'success');
            viewExtensions(browser);
        }
    } catch (error) {
        closeProgressAlert();
        showAlert('Error', error.message, 'error');
    }
}

