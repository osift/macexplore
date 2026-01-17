async function navigateToFolder(folderPath) {
    try {

        navHistory.push({ items: [...items], path: curPath });

        const myContextId = resetState('folder');
        curPath = folderPath;

        showLoadingState();
        document.getElementById('itemsContainer').style.display = 'none';

        const contents = await pywebview.api.get_directory_contents(folderPath);

        if (activeContextId !== myContextId) {
            return;
        }

        items = contents.map(item => ({
            ...item,
            icon: getDefaultIcon(item.type),
            category: 'Folder View',
            is_app: false,
            protected: isSysPath(item.path)
        }));

        allItems = [...items];

        hideLoadingState();

        if (items.length === 0) {
            showEmptyState();
            document.getElementById('itemsContainer').style.display = 'none';
        } else {
            resetEmptyState();
            document.getElementById('itemsContainer').style.display = 'grid';
        }

        renderItems();
        updateStats();

        showBackButton();

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

        renderItems();
        updateStats();

        if (navHistory.length === 0) {
            hideBackButton();
        }
    }
}
