document.addEventListener('DOMContentLoaded', () => {
    const alertOverlay = document.getElementById('alertOverlay');
    if (alertOverlay) {
        alertOverlay.addEventListener('click', (e) => {
            if (e.target === alertOverlay) {
                closeAlert(false);
            }
        });
    }

    const associatedModal = document.getElementById('associatedModal');
    if (associatedModal) {
        associatedModal.addEventListener('click', (e) => {
            if (e.target === associatedModal) {
                closeAssociatedModal();
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {

        searchInput.removeAttribute('contentEditable');
        searchInput.readOnly = false;
        searchInput.disabled = false;
        searchInput.tabIndex = 1;

        searchInput.addEventListener('click', (e) => {
            e.stopPropagation();

            searchInput.focus();
        });

        searchInput.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        searchInput.addEventListener('focus', () => {
            inSearch = true;
            console.log('Search input focused, activeElement:', document.activeElement);

            setTimeout(() => {
                if (document.activeElement === searchInput) {
                    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
                    console.log('Caret positioned at end of input');
                }
            }, 0);
        });

        searchInput.addEventListener('blur', () => {
            inSearch = false;
            console.log('Search input blurred');
        });

        searchInput.addEventListener('input', () => {
            console.log('Input value changed to:', searchInput.value);
        });

        searchInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });
    }
});

document.addEventListener('click', (e) => {
    if ((e.target.classList.contains('content') || e.target.classList.contains('grid')) && !justFinishedDrag) {
        deselectAll();
    }
    document.getElementById('contextMenu').style.display = 'none';
});

document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        document.getElementById('searchInput')?.focus();
        return;
    }

    if (inSearch) {
        return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        if (curTab === 'help') {
            return;
        }
        e.preventDefault();
        if (allSelected) {
            deselectAll();
        } else {
            selectAll();
        }
        return;
    }

    if (e.key === 'Escape') {
        if (document.getElementById('associatedModal').classList.contains('show')) {
            closeAssociatedModal();
        } else if (document.getElementById('confirmDialog').classList.contains('show')) {
            closeConfirm();
        } else if (document.getElementById('alertOverlay').classList.contains('show')) {
            closeAlert(false);
        } else {
            deselectAll();
        }
        return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size > 0 && !inSearch) {
        e.preventDefault();
        deleteSelected();
        return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        scanSystem();
        return;
    }
});

document.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.card');
    if (card) {
        e.preventDefault();
        const index = parseInt(card.dataset.index);
        const path = card.dataset.path;
        openContextMenu(e, path, index);
    }
});

function hideLoader() {
    const loader = document.getElementById('appLoader');
    if (loader) {
        loader.classList.add('hidden');
        setTimeout(() => {
            loader.remove();
        }, 300);
    }
}

async function initializeCaches() {
    try {

        await Promise.all([
            loadSizeCache(),
            loadIconCacheFromDisk(),
            loadScanCacheFromDisk()
        ]);
        console.log('[Init] All caches loaded');
    } catch (e) {
        console.warn('[Init] Error loading caches:', e);
    }
}

function waitForAPI() {
    if (typeof pywebview !== 'undefined' && pywebview.api) {

        initHomeDirectory().then(() => {
            initializeCaches().then(() => {
                updateCounts();
                scanSystem().then(() => {
                    hideLoader();
                });
                updateToolbarForPreset();
            });
        });
    } else {
        setTimeout(waitForAPI, 100);
    }
}
window.addEventListener('DOMContentLoaded', waitForAPI);
//cmmsg
