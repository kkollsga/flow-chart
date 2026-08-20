// Helper to safely remove CSS classes
function safeRemoveClass(element, className) {
    if (element && className && className.trim() !== '') {
        element.classList.remove(className);
    }
}
