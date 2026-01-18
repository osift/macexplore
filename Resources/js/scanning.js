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

    const searchInput = document.getElementById('searchInput');
    const currentSearchQuery = searchInput ? searchInput.value : '';

    scanId++;
    const myScanId = scanId;
    runningId = myScanId;
    isScanning = true;

    const myContextId = ++activeContextId;

    updateStats();


    showLoadingState(8);
    document.getElementById('itemsContainer').style.display = 'none';
    const browsersView = document.getElementById('browsersView');
    if (browsersView) browsersView.style.display = 'none';

    try {

        const startData = await pywebview.api.start_scan(curTab);

        if (runningId !== myScanId || activeContextId !== myContextId) {
            console.log('Scan cancelled - context switched');
            return;
        }


        if (!startData || !startData.started) {
            hideLoadingState();
            delete scanCache[cacheKey];

            if (curTab === 'trash') {
                showPermissionNotice();
            } else {
                showEmptyState();
            }

            isScanning = false;
            return;
        }


        const cachedItems = scanCache[cacheKey];
        let showedCache = false;

        if (cachedItems && cachedItems.length > 0) {
            items = [...cachedItems];
            allItems = [...cachedItems];

            hideLoadingState();
            resetEmptyState();
            const container = document.getElementById('itemsContainer');
            container.style.display = 'grid';
            renderItems();
            updateStats();
            showedCache = true;
            console.log(`[Cache] Showing ${cachedItems.length} cached items for ${cacheKey}`);


            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        } else if (startData.total !== undefined) {
            showLoadingState(startData.total);
        }

        let scannedItems = [];
        await loadItemsProgressively(myScanId, myContextId, scannedItems);

        if (runningId === myScanId && activeContextId === myContextId) {


            const currentPaths = new Set(allItems.map(item => item.path));
            const scannedPaths = new Set(scannedItems.map(item => item.path));


            const pathsToRemove = Array.from(currentPaths).filter(path => !scannedPaths.has(path));


            const itemsToAdd = scannedItems.filter(item => !currentPaths.has(item.path));

            let needsUpdate = false;

            if (pathsToRemove.length > 0) {

                const cardsToRemove = pathsToRemove.map(path =>
                    document.querySelector(`[data-path="${CSS.escape(path)}"]`)
                ).filter(Boolean);

                cardsToRemove.forEach(card => card.classList.add('removing'));


                if (cardsToRemove.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                items = items.filter(item => !pathsToRemove.includes(item.path));
                allItems = allItems.filter(item => !pathsToRemove.includes(item.path));
                console.log(`[Sync] Removed ${pathsToRemove.length} deleted items`);
                needsUpdate = true;
            }

            if (itemsToAdd.length > 0) {
                items.push(...itemsToAdd);
                allItems.push(...itemsToAdd);
                console.log(`[Sync] Added ${itemsToAdd.length} new items`);
                loadIcons(itemsToAdd, myScanId, myContextId);
                loadFolderSizes(itemsToAdd, myScanId, myContextId);
                needsUpdate = true;
            }


            if (!showedCache && scannedItems.length > 0) {
                items = scannedItems;
                allItems = scannedItems;
                loadIcons(scannedItems, myScanId, myContextId);
                loadFolderSizes(scannedItems, myScanId, myContextId);
                needsUpdate = true;
            }


            if (allItems.length > 0) {
                scanCache[cacheKey] = [...allItems];
                dirtyCache.delete(cacheKey);
                saveScanCacheToDisk();
            } else {
                delete scanCache[cacheKey];
            }

            hideLoadingState();

            if (currentSearchQuery && currentSearchQuery.trim() !== '') {
                await performSearch(currentSearchQuery);
            }


            const container = document.getElementById('itemsContainer');
            if (items.length > 0) {
                resetEmptyState();
                document.getElementById('emptyState').style.display = 'none';
                container.style.display = 'grid';
                if (needsUpdate || !showedCache) {
                    renderItems();
                }
                updateStats();
            } else {
                container.style.display = 'none';
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
    let needsSave = false;

    for (let item of itemBatch) {
        if (runningId !== myScanId || activeContextId !== myContextId) {
            console.log('Icon loading cancelled - context switched');
            if (needsSave) saveIconCacheToDisk();
            return;
        }

        try {
            let icon;


            if (iconCacheData[item.path]) {
                icon = iconCacheData[item.path];
            } else {

                if (item.is_app) {
                    icon = await pywebview.api.extract_app_icon(item.path);
                } else if (item.type === 'Folder') {
                    icon = await pywebview.api.get_folder_icon(item.path);
                } else {
                    icon = await pywebview.api.get_file_icon(item.path);
                }


                iconCacheData[item.path] = icon;
                needsSave = true;
            }

            if (runningId !== myScanId || activeContextId !== myContextId) {
                console.log('Icon loaded but context switched - discarding');
                if (needsSave) saveIconCacheToDisk();
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

    if (needsSave) {
        saveIconCacheToDisk();
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


async function loadFolderSizes(itemBatch, myScanId, myContextId) {
    let needsSave = false;

    for (let item of itemBatch) {

        if (runningId !== myScanId || activeContextId !== myContextId) {
            if (needsSave) saveSizeCache();
            return;
        }


        if (!item.needs_size && item.size_str !== 'Loading...') continue;

        try {

            const cachedSize = getCachedSize(item.path);
            let sizeData;

            if (cachedSize) {
                sizeData = cachedSize;
            } else {

                const result = await pywebview.api.get_item_size(item.path);
                sizeData = typeof result === 'string' ? JSON.parse(result) : result;


                sizeCache[item.path] = sizeData;
                needsSave = true;
            }


            item.size = sizeData.size;
            item.size_str = sizeData.size_str;
            item.needs_size = false;


            const card = document.querySelector(`[data-path="${CSS.escape(item.path)}"]`);
            if (card) {
                const metaEl = card.querySelector('.card-meta');
                if (metaEl) {
                    metaEl.textContent = sizeData.size_str;
                }
            }
        } catch (error) {
            console.error(`Error loading size for ${item.name}:`, error);
        }
    }

    if (needsSave) {
        saveSizeCache();
    }
}
