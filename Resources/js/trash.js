async function restoreSelected() {
    if (selected.size === 0) {
        showAlert('No Selection', 'Please select items to restore', 'warning');
        return;
    }

    const itemCount = selected.size;
    const itemText = itemCount === 1 ? 'item' : 'items';

    showAlert('Confirm', `Are you sure you want to restore ${itemCount} ${itemText} from Trash?\n\nItems will be moved to your Desktop.`, 'question', async (confirmed) => {
        if (!confirmed) return;

        try {
            const restoredPaths = Array.from(selected);

            showProgressAlert('Restoring Items', `Restoring ${itemCount} ${itemText}...`);

            setDeleteInProgress(true);

            const result = await pywebview.api.restore_from_trash(restoredPaths);

            closeProgressAlert();

            const verificationWarning = await checkRestoreResult(restoredPaths, result);

            let message = '';

            if (verificationWarning) {
                message += `⚠️ ${verificationWarning}\n\n`;
            }
            if (result.success && result.success.length > 0) {
                message += `✓ Restored ${result.success.length} ${result.success.length === 1 ? 'item' : 'items'} to Desktop\n`;
            }

            if (result.failed && result.failed.length > 0) {
                message += `\n✗ Failed to restore ${result.failed.length} ${result.failed.length === 1 ? 'item' : 'items'}:\n`;
                result.failed.forEach(f => {
                    message += `\n• ${f.name}\n  ${f.error}`;
                });

                result.failed.forEach(f => {

                    const failedPath = restoredPaths.find(p => p.includes(f.name));
                    if (failedPath) {
                        selected.delete(failedPath);
                    }
                });
            }

            await updateCounts();
            setTimeout(() => setDeleteInProgress(false), 1000);

            if (verificationWarning) {
                showAlert('Verification Failed', message.trim(), 'error');
            } else if (result.failed && result.failed.length > 0) {
                showAlert('Partially Complete', message.trim(), 'warning');
            } else {
                const count = result.success.length;
                showToast(`Restored ${count} item${count !== 1 ? 's' : ''} to Desktop`, 'success');
            }

        } catch (error) {
            closeProgressAlert();
            showToast('Failed to restore: ' + error.message, 'error');
            setDeleteInProgress(false);
        }
    });
}

async function restoreFromContext() {
    if (menuTarget) {
        selected.clear();
        selected.add(menuTarget);
        await restoreSelected();
    }
}

async function restoreAll() {
    if (!items || items.length === 0) {
        showAlert('Empty Trash', 'Trash is already empty', 'info');
        return;
    }

    const itemCount = items.length;
    const confirmed = await window.confirm(`Restore ALL ${itemCount} items from Trash to Desktop?`);
    if (!confirmed) return;

    const allPaths = items.map(item => item.path);

    try {
        showProgressAlert('Restoring All', `Restoring ${itemCount} items...`);

        setDeleteInProgress(true);

        const result = await pywebview.api.restore_from_trash(allPaths);

        closeProgressAlert();

        const verificationWarning = await checkRestoreResult(allPaths, result);

        selected.clear();

        let message = '';

        if (verificationWarning) {
            message += `⚠️ ${verificationWarning}\n\n`;
        }
        if (result.success && result.success.length > 0) {
            message += `✓ Restored ${result.success.length} ${result.success.length === 1 ? 'item' : 'items'} to Desktop\n`;
        }

        if (result.failed && result.failed.length > 0) {
            message += `\n✗ Failed to restore ${result.failed.length} ${result.failed.length === 1 ? 'item' : 'items'}:\n`;
            result.failed.forEach(f => {
                message += `\n• ${f.name}\n  ${f.error}`;
            });
        }

        updateStats();
        await updateCounts();
        setTimeout(() => setDeleteInProgress(false), 1000);

        if (verificationWarning) {
            showAlert('Verification Failed', message.trim(), 'error');
        } else if (result.failed && result.failed.length > 0) {
            showAlert('Partially Complete', message.trim(), 'warning');
        } else {
            const count = result.success.length;
            showToast(`Restored ${count} item${count !== 1 ? 's' : ''} to Desktop`, 'success');
        }

    } catch (error) {
        closeProgressAlert();
        setDeleteInProgress(false);
        showToast('Failed to restore: ' + error.message, 'error');
    }
}

async function emptyTrash() {
    if (!items || items.length === 0) {
        showAlert('Empty Trash', 'Trash is already empty', 'info');
        return;
    }

    const itemCount = items.length;
    const confirmed = await window.confirm(`Are you sure you want to permanently delete ALL ${itemCount} items in Trash? This cannot be undone!`);
    if (!confirmed) return;

    try {
        showProgressAlert('Emptying Trash', `Deleting ${itemCount} items...`);

        setDeleteInProgress(true);

        const result = await pywebview.api.empty_trash();

        closeProgressAlert();

        Object.keys(scanCache).forEach(key => delete scanCache[key]);
        dirtyCache.add('trash');
        dirtyCache.add('all');

        const allCards = document.querySelectorAll('.card[data-path]');
        allCards.forEach(card => card.classList.add('removing'));

        if (allCards.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        items.length = 0;
        allItems.length = 0;
        selected.clear();

        allCards.forEach(card => card.remove());

        const trashItems = await pywebview.api.scan_trash();
        const remainingCount = trashItems ? trashItems.length : 0;

        if (remainingCount > 0) {
            items.push(...trashItems);
            allItems.push(...trashItems);
            trashItems.forEach(item => {
                item.icon = getDefaultIcon(item.type);
                item.protected = isSysPath(item.path);
            });
            renderItems();
            showAlert('Warning', `Trash still contains ${remainingCount} item${remainingCount !== 1 ? 's' : ''}. Some items may be protected or in use.`, 'warning');
        } else {
            document.getElementById('itemsContainer').style.display = 'none';
            showEmptyState();

            const normalCount = result.success || 0;
            const privilegedCount = result.privileged || 0;
            const totalCount = normalCount + privilegedCount;

            if (privilegedCount > 0) {
                showToast(`Deleted ${totalCount} item${totalCount !== 1 ? 's' : ''} permanently (${privilegedCount} required admin)`, 'success');
            } else {
                showToast(`Deleted ${totalCount || itemCount} item${(totalCount || itemCount) !== 1 ? 's' : ''} permanently`, 'success');
            }
        }

        updateStats();
        await updateCounts();

        setTimeout(() => setDeleteInProgress(false), 1000);

    } catch (error) {
        closeProgressAlert();
        showToast('Failed to empty trash: ' + error.message, 'error');
        setDeleteInProgress(false);
    }
}

async function restoreFromTrash() {
    await restoreFromContext();
}
