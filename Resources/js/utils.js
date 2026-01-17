const sysFiles = [
    '/System',
    '/Library',
    '/usr',
    '/bin',
    '/sbin',
    '/private',
    '/Applications/Safari.app',
    '/Applications/System Settings.app',
    '/Applications/Finder.app'
];

function isSysPath(path) {
    return sysFiles.some(protected => path.startsWith(protected));
}

function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes, i = 0;
    while (size >= 1024 && i < 3) { size /= 1024; i++; }
    return `${size.toFixed(1)} ${units[i]}`;
}

function getDefaultIcon(type) {
    const icons = {
        "Application": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect fill='%23607D8B' x='8' y='8' width='48' height='48' rx='8'/%3E%3Crect fill='%23455A64' x='16' y='16' width='32' height='32' rx='4'/%3E%3C/svg%3E",
        "Folder": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%2390CAF9' d='M54 14H30l-4-6H10c-2.2 0-4 1.8-4 4v40c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V18c0-2.2-1.8-4-4-4z'/%3E%3Cpath fill='%2364B5F6' d='M54 18H10c-2.2 0-4 1.8-4 4v30c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V22c0-2.2-1.8-4-4-4z'/%3E%3C/svg%3E",
        "File": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%2378909C' d='M42 4H14c-2.2 0-4 1.8-4 4v48c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V16L42 4z'/%3E%3Cpath fill='%23B0BEC5' d='M42 4v12h12L42 4z'/%3E%3C/svg%3E"
    };
    return icons[type] || icons["File"];
}

function copyPath() {
    if (menuTarget) {
        const textArea = document.createElement('textarea');
        textArea.value = menuTarget;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showAlert('Copied', `Path copied to clipboard:\n${menuTarget}`, 'success');
    }
}

function sortItems(sortType) {
    const [criteria, order] = sortType.split('-');
    items.sort((a, b) => {
        let comparison = 0;

        switch(criteria) {
            case 'name':
                comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
                break;
            case 'size':
                comparison = (a.size || 0) - (b.size || 0);
                break;
            case 'date':
                comparison = new Date(a.modified) - new Date(b.modified);
                break;
            case 'type':
                comparison = a.type.localeCompare(b.type);
                if (comparison === 0) {
                    comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
                }
                break;
        }

        return order === 'desc' ? -comparison : comparison;
    });

    renderItems();
}

let searchDebounceTimer = null;
let currentSearchId = 0;

async function filterItems(q) {

    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = setTimeout(async () => {
        await performSearch(q);
    }, 150);
}

async function performSearch(q) {
    if (!q || q.trim() === '') {
        items = [...allItems];
        renderItems();
        updateStats();
        return;
    }

    const query = q.toLowerCase();
    currentSearchId++;
    const mySearchId = currentSearchId;

    let results = allItems.filter(i => i.name.toLowerCase().includes(query));

    if (mySearchId !== currentSearchId) return;

    items = results;
    renderItems();
    updateStats();

    const uniqueResults = Array.from(new Map(results.map(r => [r.path, r])).values());

    uniqueResults.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        if (aName === query && bName !== query) return -1;
        if (aName !== query && bName === query) return 1;
        if (aName.startsWith(query) && !bName.startsWith(query)) return -1;
        if (!aName.startsWith(query) && bName.startsWith(query)) return 1;

        return aName.localeCompare(bName);
    });

    if (mySearchId !== currentSearchId) return;

    items = uniqueResults;
    renderItems();
    updateStats();
}

async function updateStorageBar() {
    try {
        const space = await pywebview.api.get_disk_space();

        document.getElementById('storageAvailable').textContent = space.free_str + ' free';
        document.getElementById('storageUsed').textContent = space.used_str;
        document.getElementById('storageTotal').textContent = space.total_str;
        document.getElementById('storageFill').style.width = space.percent_used + '%';

        if (space.percent_used > 90) {
            document.getElementById('storageFill').style.background = 'linear-gradient(90deg, #f44336 0%, #e57373 100%)';
        } else if (space.percent_used > 75) {
            document.getElementById('storageFill').style.background = 'linear-gradient(90deg, #ff9800 0%, #ffb74d 100%)';
        } else {
            document.getElementById('storageFill').style.background = 'linear-gradient(90deg, #666 0%, #888 100%)';
        }
    } catch (error) {
    }
}

function resetState(newContextType) {

    activeContextId++;
    currentContextType = newContextType;

    scanId++;
    runningId = null;
    isScanning = false;

    items.length = 0;
    allItems.length = 0;
    selected.clear();
    lastIdx = -1;
    allSelected = false;

    hideLoadingState();
    resetEmptyState();

    const itemsContainer = document.getElementById('itemsContainer');
    if (itemsContainer) {
        itemsContainer.style.display = 'none';
        itemsContainer.innerHTML = '';
    }

    const browsersView = document.getElementById('browsersView');
    if (browsersView) {
        browsersView.style.display = 'none';
        browsersView.innerHTML = '';
    }

    return activeContextId;
}
