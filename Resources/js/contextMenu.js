function openContextMenu(event, path, index) {
    event.stopPropagation();
    const menu = document.getElementById('contextMenu');
    menuTarget = path;

    const item = items[index];
    menuIsFolder = item && item.type === "Folder";

    document.getElementById('contextShowAssociated').style.display = item && item.is_app ? 'flex' : 'none';
    document.getElementById('contextShowFolder').style.display = menuIsFolder ? 'flex' : 'none';

    if (!selected.has(path)) {
        selected.clear();
        selected.add(path);
        renderItems(); 
        updateStats(); 
    }

    let count = 1;
    if (selected.has(path)) {
        count = selected.size;
    }

    const restoreBtn = document.getElementById('contextRestore');
    if (restoreBtn) {
        restoreBtn.style.display = curTab === 'trash' ? 'flex' : 'none';

        Array.from(restoreBtn.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                restoreBtn.removeChild(node);
            }
        });

        restoreBtn.appendChild(document.createTextNode(count === 1 ? 'Restore' : `Restore ${count} items`));
    }

    const deleteBtn = menu.querySelector('[onclick="deleteFromContext()"]');
    if (deleteBtn) {

        Array.from(deleteBtn.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                deleteBtn.removeChild(node);
            }
        });

        deleteBtn.appendChild(document.createTextNode('Delete'));
    }

    menu.style.display = 'block';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
}

async function revealInFinder() {
    if (menuTarget) {
        await pywebview.api.reveal_in_finder(menuTarget);
    }
}

async function deleteFromContext() {
    if (menuTarget) {

        if (selected.has(menuTarget) && selected.size > 0) {
            await window.deleteSelected();
        } else {

            selected.clear();
            selected.add(menuTarget);
            await window.deleteSelected();
        }
    }
}

async function showAssociatedFiles() {
    if (!menuTarget) return;
    try {
        const data = await pywebview.api.get_associated_files(menuTarget);

        const modal = document.getElementById('associatedModal');
        document.getElementById('associatedModalTitle').textContent = `Associated Files - ${data.app_name}`;

        const body = document.getElementById('associatedModalBody');
        let html = `<div class="modal-note">Our app will automatically remove all these associated files when uninstalling the application. Total: ${data.total_files} files (${data.total_size})</div>`;

        for (let [category, files] of Object.entries(data.associated)) {
            if (files.length > 0) {
                html += `
                    <div class="modal-section">
                        <div class="modal-section-title">${category.replace(/_/g, ' ').toUpperCase()}</div>
                        ${files.map(f => `
                            <div class="file-item" onclick="pywebview.api.reveal_in_finder('${f.path.replace(/'/g, "\\'")}')">
                                <div class="file-path">${f.path}</div>
                                <div class="file-size">${f.size_str}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        }

        body.innerHTML = html;
        modal.classList.add('show');
    } catch (error) {
    }
}

async function showFolderContents() {
    if (!menuTarget) return;
    await navigateToFolder(menuTarget);
}

function getInfo() {
    if (!menuTarget) return;
    const item = items.find(i => i.path === menuTarget) || allItems.find(i => i.path === menuTarget);
    if (!item) return;

    const info = `
        <div style="padding: 20px;">
            <div style="margin-bottom: 15px;">
                <strong>Name:</strong> ${item.name}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Type:</strong> ${item.type}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Size:</strong> ${item.size_str}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Modified:</strong> ${new Date(item.modified).toLocaleString()}
            </div>
            <div style="margin-bottom: 15px; word-break: break-all;">
                <strong>Path:</strong> ${item.path}
            </div>
        </div>
    `;

    const modal = document.getElementById('associatedModal');
    document.getElementById('associatedModalTitle').textContent = 'File Information';
    document.getElementById('associatedModalBody').innerHTML = info;
    modal.classList.add('show');
}
