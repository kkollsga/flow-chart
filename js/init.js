// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Configure marked.js for better rendering
    if (window.marked) {
        marked.setOptions({
            gfm: true,       // GitHub flavored markdown
            breaks: true,    // Add <br> on single line breaks
            headerIds: false,
            mangle: false    // Don't escape HTML
        });
    }
    
    window.diagramManager = new DiagramManager();
    
    // Add example content to the first box if needed
    setTimeout(() => {
        if (window.diagramManager.boxes.size === 0) {
            const exampleBox = window.diagramManager.createBox(window.innerWidth / 2, window.innerHeight * 0.3);
            exampleBox.data.markdown = `# Welcome to FlowChart

This is an enhanced diagram tool with **improved markdown** support.

## Features:
* Ordered and unordered lists
* Tables support
* Adjustable text size

1. Double-click anywhere to add boxes
2. Right-drag to connect boxes
3. Press 'c' to change colors
4. Press 's' to change sizes

### Example Table:
| Feature | Description |
|---------|-------------|
| Lists | Both ordered and unordered |
| Tables | Markdown table support |
| Text Size | Adjustable text scaling |`;
            exampleBox.commitEdit();
        }
    }, 100);
});
