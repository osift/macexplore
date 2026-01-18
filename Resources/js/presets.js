function switchPreset(preset, event) {
    hideLoadingState();

    curTab = preset;
    selected.clear();
    allSelected = false;
    lastIdx = -1;

    items.length = 0;
    allItems.length = 0;

    navHistory = [];
    curPath = null;
    hideBackButton();

    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
        el.blur();
    });

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
        setTimeout(() => {
            if (event.currentTarget) {
                event.currentTarget.blur();
            }
        }, 100);
    }

    const titles = {
        'all': 'All Items', 'applications': 'Applications', 'desktop': 'Desktop',
        'documents': 'Documents', 'downloads': 'Downloads',
        'launch_agents': 'Launch Agents', 'binaries': 'Binaries',
        'browsers': 'Browser Data', 'trash': 'Trash', 'help': 'Help'
    };

    let title = titles[preset];
    if (preset.startsWith('custom_')) {
        const folder = userFolders.find(f => f.id === preset);
        title = folder ? folder.name : 'Custom Folder';
    }

    document.getElementById('toolbarTitle').textContent = title;

    const searchInput = document.querySelector('.search');
    if (searchInput) {
        searchInput.value = '';
    }


    const browsersView = document.getElementById('browsersView');
    const helpView = document.getElementById('helpView');
    const itemsContainer = document.getElementById('itemsContainer');
    const emptyState = document.getElementById('emptyState');

    if (browsersView) browsersView.style.display = 'none';
    if (helpView) helpView.style.display = 'none';

    if (preset === 'help') {

        if (itemsContainer) itemsContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
        if (helpView) helpView.style.display = 'block';
        hideLoadingState();
    } else if (preset === 'browsers') {
        if (itemsContainer) itemsContainer.style.display = 'grid';
        updateCounts();
        loadBrowsers();
    } else {
        if (itemsContainer) itemsContainer.style.display = 'grid';
        updateCounts();
        scanSystem();
    }

    updateToolbarForPreset();
}

async function addCustomFolder(event) {
    try {
        const folderPath = await pywebview.api.select_folder();

        const addBtn = event.target.closest('.nav-item');
        if (addBtn) addBtn.blur();

        if (!folderPath) return;

        const validationError = validateCustomFolder(folderPath);
        if (validationError) {
            showAlert('Cannot Add Folder', validationError, 'warning');
            return;
        }

        const folderName = folderPath.split('/').pop() || 'Folder';
        const folderId = `custom_${Date.now()}`;

        userFolders.push({
            id: folderId,
            path: folderPath,
            name: folderName
        });

        const container = document.getElementById('customFoldersContainer');
        const customItem = document.createElement('div');
        customItem.className = 'nav-item';
        customItem.id = folderId;
        customItem.innerHTML = `
            <span class="nav-icon" onclick="navigateToCustomFolder('${folderPath}', event); event.stopPropagation();">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                </svg>
            </span>
            <span onclick="navigateToCustomFolder('${folderPath}', event); event.stopPropagation();" style="flex: 1;">
                ${folderName}
            </span>
            <span class="nav-remove" onclick="removeCustomFolder('${folderId}'); event.stopPropagation();" title="Remove folder">×</span>
        `;

        container.appendChild(customItem);

        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        customItem.classList.add('active');
        curTab = folderId;
        document.getElementById('toolbarTitle').textContent = folderName;
        await navigateToFolder(folderPath);

    } catch (error) {
        console.error('addCustomFolder error:', error);
        const addBtn = event.target.closest('.nav-item');
        if (addBtn) addBtn.blur();

        showAlert('Error', 'Failed to select folder: ' + error.message, 'error');
    }
}

function validateCustomFolder(folderPath) {
    const homeDir = NSHomeDirectory();

    if (folderPath === '/' || folderPath === '/Users') {
        return 'Cannot add system root directories.';
    }

    const alreadyAdded = userFolders.find(f => f.path === folderPath);
    if (alreadyAdded) {
        return `"${folderPath.split('/').pop()}" is already in your custom folders list.`;
    }

    const presetPaths = {
        'desktop': homeDir + '/Desktop',
        'documents': homeDir + '/Documents',
        'downloads': homeDir + '/Downloads',
        'applications': '/Applications',
        'launch_agents': homeDir + '/Library/LaunchAgents',
        'binaries': '/usr/local/bin',
        'trash': homeDir + '/.Trash'
    };

    for (const [presetName, presetPath] of Object.entries(presetPaths)) {
        if (folderPath === presetPath) {
            return `"${folderPath.split('/').pop()}" is already available as a preset tab. Use the existing "${presetName.charAt(0).toUpperCase() + presetName.slice(1).replace('_', ' ')}" tab instead.`;
        }
    }

    return null;
}

async function navigateToCustomFolder(folderPath, event) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (event && event.currentTarget) {
        const navItem = event.currentTarget.closest('.nav-item');
        if (navItem) {
            navItem.classList.add('active');
            curTab = navItem.id;
        }
    }
    const folder = userFolders.find(f => f.path === folderPath);
    if (folder) {
        document.getElementById('toolbarTitle').textContent = folder.name;
    }
    await navigateToFolder(folderPath);
}

async function validateCustomFolders() {
    const invalidFolders = [];

    for (const folder of userFolders) {
        try {
            await pywebview.api.get_directory_contents(folder.path);
        } catch (error) {
            invalidFolders.push(folder.id);
        }
    }

    for (const folderId of invalidFolders) {
        removeCustomFolder(folderId);
    }
}

function removeCustomFolder(folderId) {
    userFolders = userFolders.filter(f => f.id !== folderId);

    const element = document.getElementById(folderId);
    if (element) {
        element.remove();
    }

    if (curTab === folderId) {
        const allItem = document.querySelector('.nav-item[onclick*="all"]');
        switchPreset('all', { currentTarget: allItem });
    }
}

function updateToolbarForPreset() {
    const deleteBtn = document.getElementById('deleteBtn');
    const toolbarActions = document.querySelector('.toolbar-actions');
    const existingRestore = document.getElementById('restoreBtn');
    const existingRestoreAll = document.getElementById('restoreAllBtn');
    const existingEmptyTrash = document.getElementById('emptyTrashBtn');
    const existingDeletePermanent = document.getElementById('deletePermanentBtn');
    if (existingRestore) existingRestore.remove();
    if (existingRestoreAll) existingRestoreAll.remove();
    if (existingEmptyTrash) existingEmptyTrash.remove();
    if (existingDeletePermanent) existingDeletePermanent.remove();


    if (curTab === 'help') {
        if (toolbarActions) toolbarActions.style.display = 'none';
        return;
    } else {
        if (toolbarActions) toolbarActions.style.display = 'flex';
    }

    if (curTab === 'trash') {

        if (deleteBtn) deleteBtn.style.display = 'none';

        const deletePermanentBtn = document.createElement('button');
        deletePermanentBtn.id = 'deletePermanentBtn';
        deletePermanentBtn.className = 'btn';
        deletePermanentBtn.textContent = 'Delete';
        deletePermanentBtn.style.display = 'none';
        deletePermanentBtn.onclick = deleteSelected;

        const restoreBtn = document.createElement('button');
        restoreBtn.id = 'restoreBtn';
        restoreBtn.className = 'btn';
        restoreBtn.textContent = 'Restore';
        restoreBtn.style.display = 'none';
        restoreBtn.onclick = restoreSelected;

        const restoreAllBtn = document.createElement('button');
        restoreAllBtn.id = 'restoreAllBtn';
        restoreAllBtn.className = 'btn';
        restoreAllBtn.textContent = 'Restore All';
        restoreAllBtn.onclick = restoreAll;

        const emptyTrashBtn = document.createElement('button');
        emptyTrashBtn.id = 'emptyTrashBtn';
        emptyTrashBtn.className = 'btn';
        emptyTrashBtn.textContent = 'Empty Trash';
        emptyTrashBtn.onclick = emptyTrash;

        const searchWrap = toolbarActions.querySelector('.search-wrap');
        if (searchWrap) {
            toolbarActions.insertBefore(deletePermanentBtn, searchWrap);
            toolbarActions.insertBefore(restoreBtn, searchWrap);
            toolbarActions.insertBefore(restoreAllBtn, searchWrap);
            toolbarActions.insertBefore(emptyTrashBtn, searchWrap);
        } else {

            toolbarActions.appendChild(deletePermanentBtn);
            toolbarActions.appendChild(restoreBtn);
            toolbarActions.appendChild(restoreAllBtn);
            toolbarActions.appendChild(emptyTrashBtn);
        }
    } else {

    }
}
