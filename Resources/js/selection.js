let isDraggingSelect = false;
let dragStartX = 0;
let dragStartY = 0;
let dragBox = null;
let dragStartedOnCard = false;
let potentialDrag = false;
let dragUpdateTimer = null;
let justFinishedDrag = false;
const DRAG_UPDATE_DELAY = 16;

function createDragBox() {
    if (!dragBox) {
        dragBox = document.createElement('div');
        dragBox.style.position = 'fixed';
        dragBox.style.border = '1.5px solid rgba(255, 255, 255, 0.3)';
        dragBox.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        dragBox.style.pointerEvents = 'none';
        dragBox.style.zIndex = '10000';
        dragBox.style.borderRadius = '8px';
        document.body.appendChild(dragBox);
    }
    return dragBox;
}

function updateDragBox(startX, startY, endX, endY) {
    const box = createDragBox();
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = width + 'px';
    box.style.height = height + 'px';
    box.style.display = 'block';
}

function removeDragBox() {
    if (dragBox) {
        dragBox.style.display = 'none';
    }
}

function getCardsInDragBox(startX, startY, endX, endY) {
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const right = Math.max(startX, endX);
    const bottom = Math.max(startY, endY);

    const selected = [];
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        if (rect.right >= left && rect.left <= right && rect.bottom >= top && rect.top <= bottom) {
            const path = card.getAttribute('data-path');
            if (path) selected.push(path);
        }
    });

    return selected;
}

document.addEventListener('mousedown', (e) => {
    const inContentArea = e.target.closest('.content') &&
                          !e.target.closest('.toolbar') &&
                          !e.target.closest('.search');

    if (inContentArea) {
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragStartedOnCard = e.target.closest('.card') !== null;
        potentialDrag = true;
    }
});

document.addEventListener('mousemove', (e) => {
    if (potentialDrag && !isDraggingSelect) {
        const dx = Math.abs(e.clientX - dragStartX);
        const dy = Math.abs(e.clientY - dragStartY);

        if (dx > 5 || dy > 5) {
            isDraggingSelect = true;
            potentialDrag = false;
            e.preventDefault();
        }
    }

    if (isDraggingSelect) {
        updateDragBox(dragStartX, dragStartY, e.clientX, e.clientY);

        if (dragUpdateTimer) {
            clearTimeout(dragUpdateTimer);
        }

        dragUpdateTimer = setTimeout(() => {
            const paths = getCardsInDragBox(dragStartX, dragStartY, e.clientX, e.clientY);

            if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
                selected.clear();
            }

            paths.forEach(path => selected.add(path));
            refreshSelection();
            updateStats();
        }, DRAG_UPDATE_DELAY);
    }
});

document.addEventListener('mouseup', (e) => {
    if (isDraggingSelect) {
        if (dragUpdateTimer) {
            clearTimeout(dragUpdateTimer);
            dragUpdateTimer = null;
        }

        removeDragBox();

        const paths = getCardsInDragBox(dragStartX, dragStartY, e.clientX, e.clientY);

        if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
            selected.clear();
        }

        paths.forEach(path => selected.add(path));
        refreshSelection();
        updateStats();

        isDraggingSelect = false;
        justFinishedDrag = true;
        setTimeout(() => { justFinishedDrag = false; }, 0);
    }

    potentialDrag = false;
    dragStartedOnCard = false;
});
