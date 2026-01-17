const CARD_HEIGHT = 140;
const CARD_MIN_WIDTH = 140;
const GAP = 14;
const BUFFER_ROWS = 3;

function getColumnsCount(containerWidth) {
    if (containerWidth <= 0) return 4;
    return Math.max(1, Math.floor((containerWidth + GAP) / (CARD_MIN_WIDTH + GAP)));
}

function renderItems() {
    const container = document.getElementById('itemsContainer');
    const content = document.querySelector('.content');

    const seenPaths = new Set();
    const uniqueItems = [];
    for (const item of items) {
        if (!seenPaths.has(item.path)) {
            seenPaths.add(item.path);
            uniqueItems.push(item);
        }
    }

    if (uniqueItems.length !== items.length) {
        items.length = 0;
        items.push(...uniqueItems);
        allItems.length = 0;
        allItems.push(...uniqueItems);
    }

    const curPaths = new Set(items.map(i => i.path));
    const orphanedSelections = Array.from(selected).filter(path => !curPaths.has(path));
    orphanedSelections.forEach(path => selected.delete(path));

    if (items.length === 0) {
        container.innerHTML = '';
        container.style.height = '';
        container.style.position = '';
        return;
    }

    if (items.length <= 500) {
        renderAllItems(container);
    } else {
        renderVirtualItems(container, content);
    }
}

function renderAllItems(container) {
    container.innerHTML = '';
    container.style.height = '';
    container.style.position = '';

    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
        fragment.appendChild(createCardElement(item, index));
    });
    container.appendChild(fragment);
}

function renderVirtualItems(container, content) {
    const containerWidth = container.clientWidth || content.clientWidth - 56;
    const viewportHeight = content.clientHeight || window.innerHeight - 200;
    const scrollTop = content.scrollTop || 0;

    const columns = getColumnsCount(containerWidth);
    const totalRows = Math.ceil(items.length / columns);
    const rowHeight = CARD_HEIGHT + GAP;
    const totalHeight = totalRows * rowHeight;

    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - BUFFER_ROWS);
    const visibleRows = Math.ceil(viewportHeight / rowHeight) + BUFFER_ROWS * 2;
    const endRow = Math.min(totalRows, startRow + visibleRows);

    const startIndex = startRow * columns;
    const endIndex = Math.min(items.length, endRow * columns);

    container.style.height = totalHeight + 'px';
    container.style.position = 'relative';

    const existingCards = container.querySelectorAll('.card');
    const existingByPath = new Map();
    existingCards.forEach(card => existingByPath.set(card.dataset.path, card));

    const neededPaths = new Set();
    for (let i = startIndex; i < endIndex; i++) {
        neededPaths.add(items[i].path);
    }

    existingCards.forEach(card => {
        if (!neededPaths.has(card.dataset.path)) card.remove();
    });

    const fragment = document.createDocumentFragment();
    const cardWidth = (containerWidth - (columns - 1) * GAP) / columns;

    for (let i = startIndex; i < endIndex; i++) {
        const item = items[i];
        const row = Math.floor(i / columns);
        const col = i % columns;

        let card = existingByPath.get(item.path);

        if (!card) {
            card = createCardElement(item, i);
            fragment.appendChild(card);
        } else {
            card.dataset.index = i;
            card.classList.toggle('selected', selected.has(item.path));
        }

        card.style.position = 'absolute';
        card.style.left = (col * (cardWidth + GAP)) + 'px';
        card.style.top = (row * rowHeight) + 'px';
        card.style.width = cardWidth + 'px';
    }

    container.appendChild(fragment);
}

function createCardElement(item, index) {
    const isSelected = selected.has(item.path) ? 'selected' : '';
    const isApp = item.is_app ? 'is-app' : '';
    const protectedClass = item.protected ? 'protected' : '';
    const iconSrc = item.icon || getDefaultIcon(item.type);

    const card = document.createElement('div');
    card.className = `card ${isSelected} ${isApp} ${protectedClass}`;
    card.dataset.index = index;
    card.dataset.path = item.path;
    card.onclick = (e) => toggleItem(e, parseInt(card.dataset.index));
    card.ondblclick = (e) => handleDoubleClick(e, parseInt(card.dataset.index));
    card.oncontextmenu = (e) => {
        e.preventDefault();
        openContextMenu(e, item.path, parseInt(card.dataset.index));
    };

    card.innerHTML = `
        <div class="check"></div>
        <div class="card-icon"><img src="${iconSrc}" alt=""></div>
        <div class="card-name">${item.name}</div>
        <div class="card-meta">${item.size_str}</div>
    `;

    return card;
}

function setupVirtualScroll() {
    const content = document.querySelector('.content');
    if (!content) return;

    let scrollTimeout;
    content.addEventListener('scroll', () => {
        if (items.length <= 500) return;
        if (scrollTimeout) cancelAnimationFrame(scrollTimeout);
        scrollTimeout = requestAnimationFrame(() => {
            const container = document.getElementById('itemsContainer');
            if (container) renderVirtualItems(container, content);
        });
    }, { passive: true });

    window.addEventListener('resize', () => {
        if (items.length <= 500) return;
        const container = document.getElementById('itemsContainer');
        const content = document.querySelector('.content');
        if (container) renderVirtualItems(container, content);
    });
}

document.addEventListener('DOMContentLoaded', setupVirtualScroll);

function toggleItem(event, index) {
    if (isDraggingSelect) return;

    const item = items[index];
    const path = item.path;

    if (event.shiftKey && lastIdx !== -1) {
        const start = Math.min(lastIdx, index);
        const end = Math.max(lastIdx, index);
        for (let i = start; i <= end; i++) {
            selected.add(items[i].path);
        }
    } else {
        if (selected.has(path)) {
            selected.delete(path);
        } else {
            selected.add(path);
        }
        lastIdx = index;
    }

    refreshSelection();
    updateStats();
}

function refreshSelection() {
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.classList.toggle('selected', selected.has(card.dataset.path));
    });
}

async function handleDoubleClick(event, index) {
    event.stopPropagation();
    const item = items[index];
    if (item.type === 'Folder') {
        await navigateToFolder(item.path);
    } else {
        await pywebview.api.reveal_in_finder(item.path);
    }
}

function selectAll() {
    items.forEach(i => selected.add(i.path));
    allSelected = true;
    refreshSelection();
    updateStats();
}

function deselectAll() {
    selected.clear();
    allSelected = false;
    lastIdx = -1;
    refreshSelection();
    updateStats();
}

function updateStats() {
    const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0);

    const totalItemsEl = document.getElementById('totalItems');
    if (totalItemsEl) totalItemsEl.textContent = items.length;

    const totalSizeEl = document.getElementById('totalSize');
    if (totalSizeEl) totalSizeEl.textContent = formatSize(totalSize);

    const selectedCountEl = document.getElementById('selectedCount');
    if (selectedCountEl) selectedCountEl.textContent = selected.size;

    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        const loadingState = document.getElementById('loadingState');
        const isLoadingVisible = loadingState && loadingState.classList.contains('show');

        if (isScanning || isLoadingVisible) {
            deleteBtn.style.display = 'none';
            deleteBtn.disabled = true;
        } else {
            const shouldShow = selected.size > 0 && curTab !== 'trash' && curTab !== 'browsers' && items.length > 0;
            deleteBtn.style.display = shouldShow ? 'inline-flex' : 'none';
            deleteBtn.disabled = !shouldShow;
        }
    }

    const deletePermanentBtn = document.getElementById('deletePermanentBtn');
    if (deletePermanentBtn) {
        deletePermanentBtn.style.display = selected.size > 0 ? 'inline-block' : 'none';
        deletePermanentBtn.disabled = selected.size === 0;
    }

    const restoreBtn = document.getElementById('restoreBtn');
    if (restoreBtn) {
        restoreBtn.style.display = selected.size > 0 ? 'inline-block' : 'none';
        restoreBtn.disabled = selected.size === 0;
    }
}

window.deleteSelected = async function() {
    if (selected.size === 0) return;

    const selectedList = items.filter(i => selected.has(i.path));
    const protectedItems = selectedList.filter(i => i.protected);
    const nonProtectedItems = selectedList.filter(i => !i.protected);

    if (protectedItems.length > 0 && nonProtectedItems.length === 0) {
        showAlert('Cannot Delete', `Cannot delete ${protectedItems.length} protected system file${protectedItems.length > 1 ? 's' : ''}.`, 'error');
        return;
    }

    if (protectedItems.length > 0) {
        showToast(`Skipping ${protectedItems.length} protected file${protectedItems.length > 1 ? 's' : ''}`, 'warning');
        protectedItems.forEach(item => selected.delete(item.path));
    }

    const apps = nonProtectedItems.filter(i => i.is_app).length;
    const folders = nonProtectedItems.filter(i => i.type === 'Folder' && !i.is_app).length;
    const files = nonProtectedItems.filter(i => i.type === 'File').length;
    const totalCount = nonProtectedItems.length;

    let itemsDescription = [];
    if (apps > 0) itemsDescription.push(`${apps} app${apps > 1 ? 's' : ''}`);
    if (files > 0) itemsDescription.push(`${files} file${files > 1 ? 's' : ''}`);
    if (folders > 0) itemsDescription.push(`${folders} folder${folders > 1 ? 's' : ''}`);

    const isInTrash = curTab === 'trash';
    let confirmMessage = totalCount === 1
        ? (isInTrash ? 'Permanently delete this item?' : `Move this ${apps ? 'app' : folders ? 'folder' : 'file'} to trash?`)
        : (isInTrash ? `Permanently delete ${itemsDescription.join(', ')}?` : `Move ${itemsDescription.join(', ')} to trash?`);

    showAlert('Confirm', confirmMessage, 'question', async (confirmed) => {
        if (confirmed) await performDelete();
    });
};

async function performDelete() {
    try {
        const isInTrash = curTab === 'trash';
        showProgressAlert('Deleting', 'Processing...');

        const deletedPaths = Array.from(selected);
        let results = isInTrash
            ? await pywebview.api.permanently_delete(deletedPaths)
            : await pywebview.api.deep_clean(deletedPaths, true);

        closeProgressAlert();
        await checkDeleteResult(results, isInTrash);

        const count = results.success?.length || results.permanently_deleted?.length || 0;
        showToast(`${isInTrash ? 'Deleted' : 'Trashed'} ${count} item${count !== 1 ? 's' : ''}`, 'success');

        allSelected = false;
        Object.keys(scanCache).forEach(key => delete scanCache[key]);
        await updateCounts();

    } catch (error) {
        closeProgressAlert();
        showToast('Failed: ' + error.message, 'error');
    }
}
