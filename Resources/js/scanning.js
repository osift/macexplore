function showLoadingState(estimatedCount) {
    const loadingState = document.getElementById('loadingState');
    if (!loadingState) return;

    const skeletonCount = Math.min(estimatedCount || 8, 50);

    let html = '';
    for (let i = 0; i < skeletonCount; i++) {
        html += '<div class="skeleton-card"><div class="skeleton-icon"></div><div class="skeleton-text"></div><div class="skeleton-text small"></div></div>';
    }

    loadingState.innerHTML = html;
    loadingState.style.display = 'grid'; 
    loadingState.classList.add('show');
}

function hideLoadingState() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.classList.remove('show');

        loadingState.style.display = 'none';
    }
}

function resetEmptyState() {
    const emptyStateEl = document.getElementById('emptyState');
    emptyStateEl.innerHTML = `
        <div class="empty-icon">📦</div>
        <div class="empty-title">All Clean</div>
        <div class="empty-text">No items found</div>
    `;
    emptyStateEl.style.display = 'none';
}

function showEmptyState() {
    resetEmptyState();
    document.getElementById('emptyState').style.display = 'flex';
}

async function scanSystem() {

    if (curTab === 'browsers') {
        await loadBrowsers();
        return;
    }

    const cacheKey = curTab + (curPath || '');
    delete scanCache[cacheKey];

    const searchInput = document.getElementById('searchInput');
    const currentSearchQuery = searchInput ? searchInput.value : '';

    const existingPaths = new Set(allItems.map(item => item.path));
    const hasExistingItems = allItems.length > 0;

    scanId++;
    const myScanId = scanId;
    runningId = myScanId;
    isScanning = true;

    const myContextId = ++activeContextId;

    updateStats();

    if (!hasExistingItems && !currentSearchQuery) {
        showLoadingState(8);
        document.getElementById('itemsContainer').style.display = 'none';
        const browsersView = document.getElementById('browsersView');
        if (browsersView) browsersView.style.display = 'none';
    }

    try {
        const startData = await pywebview.api.start_scan(curTab);

        if (runningId !== myScanId || activeContextId !== myContextId) {
            console.log('Scan cancelled - context switched');
            return;
        }

        if (!startData || !startData.started) {
            hideLoadingState();
            if (curTab === 'trash') {
                showPermissionNotice();
            } else {
                showEmptyState();
            }
            isScanning = false;
            return;
        }

        if (startData.total !== undefined) {
            showLoadingState(startData.total);
        }

        let scannedItems = [];
        await loadItemsProgressively(myScanId, myContextId, scannedItems);

        if (runningId === myScanId && activeContextId === myContextId) {

            if (hasExistingItems && scannedItems.length > 0) {
                const scannedPaths = new Set(scannedItems.map(item => item.path));

                const pathsToRemove = Array.from(existingPaths).filter(path => !scannedPaths.has(path));

                const pathsToAdd = scannedItems.filter(item => !existingPaths.has(item.path));

                let updatedItems = [...allItems];

                if (pathsToRemove.length > 0) {
                    updatedItems = updatedItems.filter(item => !pathsToRemove.includes(item.path));
                    console.log(`Removed ${pathsToRemove.length} deleted files from display`);
                }

                if (pathsToAdd.length > 0) {
                    updatedItems.push(...pathsToAdd);
                    console.log(`Added ${pathsToAdd.length} new files to display`);
                }

                items = updatedItems;
                allItems = updatedItems;

                if (pathsToAdd.length > 0) {

                    loadIcons(pathsToAdd, myScanId, myContextId);
                }
            } else if (scannedItems.length > 0) {

                items = scannedItems;
                allItems = scannedItems;

                loadIcons(scannedItems, myScanId, myContextId);
            } else {

                items = [];
                allItems = [];
            }

            if (allItems.length > 0) {
                scanCache[cacheKey] = [...allItems];
                dirtyCache.delete(cacheKey);
            }

            hideLoadingState();

            if (currentSearchQuery && currentSearchQuery.trim() !== '') {
                await performSearch(currentSearchQuery);
            }

            if (items.length > 0) {
                resetEmptyState();
                const container = document.getElementById('itemsContainer');

                container.style.opacity = '0';
                container.style.display = 'grid';
                renderItems();
                updateStats();

                requestAnimationFrame(() => {
                    container.style.opacity = '1';
                });
            } else {
                document.getElementById('itemsContainer').style.display = 'none';
                showEmptyState();
            }
        }

        await updateCounts();

        if (activeContextId === myContextId) {
            startMonitoringForPreset();
            await updateStorageBar();
        }
    } catch (error) {
        console.error('Scan error:', error);

        if (runningId === myScanId && activeContextId === myContextId) {
            hideLoadingState();
            document.getElementById('itemsContainer').style.display = 'none';
            showEmptyState();
        }
    } finally {

        if (runningId === myScanId && activeContextId === myContextId) {
            isScanning = false;

            hideLoadingState();

            updateStats();
        }
    }
}

async function recheckPermissions() {
    try {
        const result = await pywebview.api.check_full_disk_access();
        if (result.has_access) {
            await scanSystem();
        } else {
            showAlert('Permission Denied', 'Full Disk Access is still not granted. Please enable it in System Settings and try again.', 'warning');
        }
    } catch (error) {
        showAlert('Error', 'Failed to check permissions: ' + error.message, 'error');
    }
}

function showPermissionNotice() {
    document.getElementById('emptyState').style.display = 'flex';
    document.getElementById('emptyState').innerHTML = `
        <div class="permission-notice">
            <div class="permission-icon"></div>
            <div class="permission-content">
                <div class="permission-title">Full Disk Access Required</div>
                <div class="permission-message">Grant Full Disk Access permission to view trash data.</div>
                <div class="permission-steps">
                    <ol>
                        <li>Open System Settings → Privacy & Security</li>
                        <li>Click "Full Disk Access"</li>
                        <li>Enable access for MacExplore</li>
                    </ol>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button class="btn btn-primary" onclick="openSystemSettings()">Open System Settings</button>
                </div>
            </div>
        </div>
    `;
}

async function loadItemsProgressively(myScanId, myContextId, targetArray = null) {
    let complete = false;
    let batchCount = 0;
    let firstBatch = true;

    const isIncremental = targetArray !== null;
    const loadedItems = targetArray || [];

    while (!complete && runningId === myScanId && activeContextId === myContextId) {
        try {

            const batch = await pywebview.api.get_next_batch(5);

            if (runningId !== myScanId || activeContextId !== myContextId) {
                console.log('Batch loading cancelled - context switched');
                hideLoadingState(); 
                return;
            }

            if (!batch || !batch.items) {
                break;
            }

            batchCount++;

            if (batch.items.length > 0) {
                batch.items.forEach(item => {
                    item.icon = getDefaultIcon(item.type);
                    item.protected = isSysPath(item.path);
                });

                if (activeContextId !== myContextId) {
                    console.log('Context switched - discarding batch');
                    hideLoadingState(); 
                    return;
                }

                const existingPaths = new Set(loadedItems.map(i => i.path));
                const newItems = batch.items.filter(item => !existingPaths.has(item.path));

                if (newItems.length < batch.items.length) {
                    console.warn(`[loadItemsProgressively] Filtered ${batch.items.length - newItems.length} duplicate items`);
                }

                loadedItems.push(...newItems);

                if (!isIncremental) {
                    items.push(...newItems);
                    allItems.push(...newItems);

                    if (firstBatch) {
                        hideLoadingState();
                        resetEmptyState();
                        const container = document.getElementById('itemsContainer');
                        container.style.opacity = '0';
                        container.style.display = 'grid';
                        firstBatch = false;

                        requestAnimationFrame(() => {
                            container.style.opacity = '1';
                        });
                    }

                    renderItems();
                    updateStats();

                    loadIcons(batch.items, myScanId, myContextId);
                } else if (firstBatch) {

                    hideLoadingState();
                    firstBatch = false;
                }
            }

            complete = batch.complete === true;

            if (batchCount > 10000) {
                console.error('Batch limit exceeded');
                break;
            }
        } catch (error) {
            console.error('Batch error:', error);
            break;
        }
    }

    if (runningId === myScanId && activeContextId === myContextId) {
        hideLoadingState();
        renderItems();
        updateStats();

        if (items.length === 0) {
            document.getElementById('itemsContainer').style.display = 'none';
            showEmptyState();
        } else {
            const container = document.getElementById('itemsContainer');
            if (container.style.display !== 'grid') {
                container.style.opacity = '0';
                container.style.display = 'grid';
                requestAnimationFrame(() => {
                    container.style.opacity = '1';
                });
            }
            resetEmptyState();
        }
    }
}

async function loadIcons(itemBatch, myScanId, myContextId) {
    for (let item of itemBatch) {

        if (runningId !== myScanId || activeContextId !== myContextId) {
            console.log('Icon loading cancelled - context switched');
            return;
        }

        try {
            let icon;
            if (item.is_app) {
                icon = await pywebview.api.extract_app_icon(item.path);
            } else if (item.type === 'Folder') {
                icon = await pywebview.api.get_folder_icon(item.path);
            } else {
                icon = await pywebview.api.get_file_icon(item.path);
            }

            if (runningId !== myScanId || activeContextId !== myContextId) {
                console.log('Icon loaded but context switched - discarding');
                return;
            }

            const itemInItems = items.find(i => i.path === item.path);
            if (itemInItems) itemInItems.icon = icon;

            const itemInAll = allItems.find(i => i.path === item.path);
            if (itemInAll) itemInAll.icon = icon;

            const cardElement = document.querySelector(`[data-path="${item.path.replace(/"/g, '&quot;')}"]`);
            if (cardElement) {
                const iconImg = cardElement.querySelector('.card-icon img');
                if (iconImg) iconImg.src = icon;
            }
        } catch (error) {
            console.error(`Error loading icon for ${item.name}:`, error);
        }
    }
}

async function updateCounts() {
    try {
        const counts = await pywebview.api.get_counts();
        document.getElementById('count-all').textContent = counts.all || 0;
        document.getElementById('count-applications').textContent = counts.applications || 0;
        document.getElementById('count-desktop').textContent = counts.desktop || 0;
        document.getElementById('count-documents').textContent = counts.documents || 0;
        document.getElementById('count-downloads').textContent = counts.downloads || 0;
        document.getElementById('count-launch_agents').textContent = counts.launch_agents || 0;
        document.getElementById('count-binaries').textContent = counts.binaries || 0;
        document.getElementById('count-trash').textContent = counts.trash || 0;

        const browsers = await pywebview.api.scan_browsers();
        document.getElementById('count-browsers').textContent = browsers.length || 0;

        await updateStorageBar();
    } catch (error) {
        console.error('Error updating counts:', error);
    }
}

function startMonitoringForPreset() {
    if (monitoringEnabled) return;

    const pathsToMonitor = [
        '/Applications',
        NSHomeDirectory() + '/Applications',
        NSHomeDirectory() + '/Desktop',
        NSHomeDirectory() + '/Documents',
        NSHomeDirectory() + '/Downloads',
        NSHomeDirectory() + '/.Trash'
    ];

    pywebview.api.start_monitoring(pathsToMonitor).then(() => {
        monitoringEnabled = true;
        monitoredPaths = pathsToMonitor;
    }).catch(error => {
        console.error('Monitoring error:', error);
    });
}

async function onFileSystemChange(changedPath) {

    dirtyCache.add('all');
    dirtyCache.add('desktop');
    dirtyCache.add('documents');
    dirtyCache.add('downloads');
    dirtyCache.add('applications');
    dirtyCache.add('trash');

    Object.keys(scanCache).forEach(key => delete scanCache[key]);

    await updateCounts();

    if (!isScanning) {
        await scanSystem();
    }
}

window.onFileSystemChange = onFileSystemChange;

function NSHomeDirectory() {
    return '/Users/' + (window.location.pathname.split('/')[2] || 'user');
}
