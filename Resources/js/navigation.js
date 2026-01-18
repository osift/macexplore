async function navigateToFolder(folderPath, isCustomRoot = false) {
    try {
        const cacheKey = 'folder_' + folderPath;
        const isSameFolder = curPath === folderPath;

        if (!isCustomRoot && !isSameFolder) {
            navHistory.push({ items: [...items], path: curPath });
        }

        let myContextId;
        let myScanId;
        if (!isSameFolder) {
            myContextId = resetState('folder');
            scanId++;
            myScanId = scanId;
            runningId = myScanId;
        } else {
            myContextId = activeContextId;
            myScanId = runningId;
        }
        curPath = folderPath;

        const cachedItems = scanCache[cacheKey];
        let showedCache = false;

        const container = document.getElementById('itemsContainer');

        if (cachedItems && cachedItems.length > 0 && !isSameFolder) {
            items = cachedItems.map(item => {
                if (item.type === 'Folder') {
                    return { ...item, needs_size: true };  // Keep size_str for display
                }
                return { ...item };
            });
            allItems = [...items];

            hideLoadingState();
            resetEmptyState();
            container.style.display = 'grid';
            renderItems(true);  
            updateStats();
            showedCache = true;
        } else if (isSameFolder && items.length > 0) {
            showedCache = true;
        } else if (!isSameFolder) {
            showLoadingState();
            container.style.display = 'none';
        }

        const contents = await pywebview.api.get_directory_contents(folderPath);

        if (activeContextId !== myContextId) {
            return;
        }

        const newItems = contents.map(item => ({
            ...item,
            icon: getDefaultIcon(item.type),
            category: 'Folder View',
            protected: isSysPath(item.path)
        }));

        const currentPaths = new Set(items.map(i => i.path));
        const newPaths = new Set(newItems.map(i => i.path));

        const pathsToRemove = [...currentPaths].filter(p => !newPaths.has(p));
        const itemsToAdd = newItems.filter(item => !currentPaths.has(item.path));
        const isSameData = pathsToRemove.length === 0 && itemsToAdd.length === 0;

        if (showedCache && isSameData) {
        } else if (showedCache && (pathsToRemove.length > 0 || itemsToAdd.length > 0)) {

            if (pathsToRemove.length > 0) {
                const cardsToRemove = pathsToRemove.map(path =>
                    document.querySelector(`[data-path="${CSS.escape(path)}"]`)
                ).filter(Boolean);

                cardsToRemove.forEach(card => card.classList.add('removing'));
                if (cardsToRemove.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    cardsToRemove.forEach(card => card.remove());
                }

                pathsToRemove.forEach(path => {
                    delete iconCacheData[path];
                    delete sizeCache[path];
                });
                saveIconCacheToDisk();
                saveSizeCache();

                items = items.filter(item => !pathsToRemove.includes(item.path));
                allItems = allItems.filter(item => !pathsToRemove.includes(item.path));
            }

            if (itemsToAdd.length > 0) {
                items.push(...itemsToAdd);
                allItems.push(...itemsToAdd);
                appendNewItems(itemsToAdd);
                loadIcons(itemsToAdd, myScanId, myContextId);
                loadFolderSizes(itemsToAdd, myScanId, myContextId);
            }

            updateStats();
        } else {
            items = newItems;
            allItems = [...items];

            hideLoadingState();

            if (items.length === 0) {
                showEmptyState();
                container.style.display = 'none';
            } else {
                resetEmptyState();
                container.style.display = 'grid';
            }

            renderItems(true);  // Skip animation for initial load
            updateStats();
            loadIcons(items, myScanId, myContextId);
        }

        if (items.length > 0) {
            scanCache[cacheKey] = [...items];
            saveScanCacheToDisk();
        } else {
            delete scanCache[cacheKey];
        }

        if (navHistory.length > 0) {
            showBackButton();
        } else {
            hideBackButton();
        }

        loadFolderSizes(items, myScanId, myContextId);

    } catch (error) {
        hideLoadingState();
        showAlert('Error', 'Error opening folder: ' + error.message, 'error');
    }
}

function showBackButton() {
    const toolbar = document.querySelector('.toolbar');
    let backBtn = document.getElementById('backBtn');

    if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.id = 'backBtn';
        backBtn.className = 'btn btn-hover';
        backBtn.innerHTML = '← Back';
        backBtn.onclick = navigateBack;
        backBtn.style.marginRight = '12px';
        toolbar.insertBefore(backBtn, toolbar.querySelector('.toolbar-title'));
    }

    backBtn.style.display = 'inline-block';
}

function hideBackButton() {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.style.display = 'none';
    }
}

function navigateBack() {
    if (navHistory.length > 0) {
        const previous = navHistory.pop();

        items = [...previous.items];
        allItems = [...items];
        curPath = previous.path;

        resetEmptyState();
        document.getElementById('itemsContainer').style.display = 'grid';

        renderItems(true);  
        updateStats();

        if (navHistory.length === 0) {
            hideBackButton();
        }
    }
}
