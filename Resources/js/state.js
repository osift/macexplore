let items = [];
let allItems = [];
let selected = new Set();
let curTab = 'applications';
let scanId = 0;
let runningId = null;
let isScanning = false;

let currentContextType = null;
let activeContextId = 0;

let menuTarget = null;
let menuIsFolder = false;
let lastIdx = -1;
let confirmCallback = null;
let allSelected = false;
let alertCallback = null;
var inSearch = false;

let navHistory = [];
let curPath = null;
let cooldowns = {};
let userFolders = [];

let monitoringEnabled = false;
let monitoredPaths = [];

let scanCache = {};
let dirtyCache = new Set();


let sizeCache = {};
let iconCacheData = {};

async function loadSizeCache() {
    try {
        const result = await pywebview.api.load_size_cache();
        if (result.found && result.data) {
            sizeCache = result.data;
            console.log('[SizeCache] Loaded', Object.keys(sizeCache).length, 'cached sizes');
        }
    } catch (e) {
        console.warn('[SizeCache] Failed to load:', e);
    }
}

async function saveSizeCache() {
    try {
        await pywebview.api.save_size_cache(JSON.stringify(sizeCache));
    } catch (e) {
        console.warn('[SizeCache] Failed to save:', e);
    }
}

function getCachedSize(path) {
    return sizeCache[path] || null;
}

async function loadIconCacheFromDisk() {
    try {
        const result = await pywebview.api.load_icon_cache();
        if (result.found && result.data) {
            iconCacheData = result.data;
            console.log('[IconCache] Loaded', Object.keys(iconCacheData).length, 'cached icons');
        }
    } catch (e) {
        console.warn('[IconCache] Failed to load:', e);
    }
}

async function saveIconCacheToDisk() {
    try {
        await pywebview.api.save_icon_cache(JSON.stringify(iconCacheData));
    } catch (e) {
        console.warn('[IconCache] Failed to save:', e);
    }
}

async function loadScanCacheFromDisk() {
    try {
        const result = await pywebview.api.load_cache();
        if (result.found && result.data) {
            scanCache = result.data;
            console.log('[ScanCache] Loaded', Object.keys(scanCache).length, 'cached tabs');
        }
    } catch (e) {
        console.warn('[ScanCache] Failed to load:', e);
    }
}

async function saveScanCacheToDisk() {
    try {
        await pywebview.api.save_cache(JSON.stringify(scanCache));
    } catch (e) {
        console.warn('[ScanCache] Failed to save:', e);
    }
}

async function checkDeleteResult(results, isTrashOperation) {

    Object.keys(scanCache).forEach(key => delete scanCache[key]);

    if (isTrashOperation) {
        dirtyCache.add('trash');
        dirtyCache.add('desktop');
        dirtyCache.add('documents');
        dirtyCache.add('all');

        await doRescan();
    } else {

        dirtyCache.add('trash');
        dirtyCache.add(curTab);
        dirtyCache.add('all');

        const allSuccessful = [
            ...(results.success || []),
            ...(results.permanently_deleted || [])
        ];

        if (allSuccessful.length > 0) {

            const successPaths = new Set(allSuccessful);
            const successBasenames = new Set(allSuccessful.map(p => p.split('/').pop()));


            const cardsToRemove = allSuccessful.map(path =>
                document.querySelector(`[data-path="${CSS.escape(path)}"]`)
            ).filter(Boolean);

            cardsToRemove.forEach(card => card.classList.add('removing'));


            if (cardsToRemove.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            items = items.filter(item => {
                const basename = item.path.split('/').pop();
                return !successPaths.has(item.path) && !successBasenames.has(basename);
            });

            allItems = allItems.filter(item => {
                const basename = item.path.split('/').pop();
                return !successPaths.has(item.path) && !successBasenames.has(basename);
            });

            selected.clear();

            if (items.length === 0) {
                document.getElementById('itemsContainer').style.display = 'none';
                showEmptyState();
            } else {
                renderItems();
            }
            updateStats();
        }
    }

    const allDeleted = [
        ...(results.success || []),
        ...(results.permanently_deleted || [])
    ];
    for (const path of allDeleted) {
        const stillPresent = items.find(item => item.path === path);
        if (stillPresent) {
            return `File still present after deletion: ${path.split('/').pop()}`;
        }
    }

    return null;
}

async function checkRestoreResult(restoredPaths, results) {
    Object.keys(scanCache).forEach(key => delete scanCache[key]);
    dirtyCache.add('trash');
    dirtyCache.add('desktop');
    dirtyCache.add('all');

    await doRescan();

    if (results.success) {
        for (const path of results.success) {
            const stillInTrash = items.find(item => item.path === path);
            if (stillInTrash) {
                return `File still in trash after successful restore: ${path}`;
            }
        }
    }

    return null;
}

async function doRescan() {
    const myContextId = resetState('force_rescan');

    try {
        if (curTab === 'browsers') {
            await loadBrowsers();
            return;
        }

        if (curTab === 'trash') {
            const trashItems = await pywebview.api.scan_trash();
            if (activeContextId !== myContextId) return;

            const seenPaths = new Set();
            const deduped = (trashItems || []).filter(item => {
                if (seenPaths.has(item.path)) {
                    return false;
                }
                seenPaths.add(item.path);
                return true;
            });

            deduped.forEach(item => {
                item.icon = getDefaultIcon(item.type);
                item.protected = isSysPath(item.path);
            });

            items = deduped;
            allItems = deduped;
            selected.clear();

            if (items.length === 0) {
                document.getElementById('itemsContainer').style.display = 'none';
                showEmptyState();
            } else {
                document.getElementById('emptyState').style.display = 'none';
                document.getElementById('itemsContainer').style.display = 'grid';
                renderItems();

                loadIcons(deduped, null, myContextId);
            }

            updateStats();
            return;
        }

        const startData = await pywebview.api.start_scan(curTab);
        if (activeContextId !== myContextId) return;

        if (!startData || !startData.started) {
            items = [];
            allItems = [];
            selected.clear();
            document.getElementById('itemsContainer').style.display = 'none';
            showEmptyState();
            updateStats();
            return;
        }

        items = [];
        allItems = [];
        selected.clear();

        let complete = false;
        let firstBatch = true;

        while (!complete && activeContextId === myContextId) {
            const batch = await pywebview.api.get_next_batch(5);
            if (activeContextId !== myContextId) return;

            if (!batch || !batch.items || batch.items.length === 0) {
                complete = true;
                break;
            }

            const existingPaths = new Set(items.map(i => i.path));
            const newItems = batch.items.filter(item => !existingPaths.has(item.path));

            items.push(...newItems);
            allItems.push(...newItems);

            if (firstBatch && items.length > 0) {
                document.getElementById('emptyState').style.display = 'none';
                document.getElementById('itemsContainer').style.display = 'grid';
                firstBatch = false;
            }

            if (items.length > 0) {
                renderItems();
                updateStats();
            }
        }

        if (items.length === 0) {
            document.getElementById('itemsContainer').style.display = 'none';
            showEmptyState();
        }

    } catch (error) {
        console.error('Force disk rescan failed:', error);
        items = [];
        allItems = [];
        selected.clear();
        document.getElementById('itemsContainer').style.display = 'none';
        showEmptyState();
        updateStats();
    }
}
