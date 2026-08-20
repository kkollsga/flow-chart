// --- Diagram Manager Class ---
class DiagramManager {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.svg = document.getElementById('connections');
        this.boxContainer = document.getElementById('box-container');
        this.helperText = document.getElementById('helper-text');
        this.previewPath = document.getElementById('preview-connection');
        
        this.boxes = new Map();
        this.connections = new Map();
        this.nextBoxId = 1;
        this.nextConnectionId = 1;
        
        this.draggingBox = null;
        this.dragStartPos = { x: 0, y: 0 };
        this.dragBoxStartCenter = { cx: 0, cy: 0 };
        this.connectionStartBox = null;
        this.hoveredElement = null; // Track currently hovered element
        
        // Setup arrow markers with correct color inheritance
        this.setupArrowMarkers();
        
        // Initialize theme
        this.initTheme();
        
        // Initialize settings manager with reference to this diagram manager
        this.settingsManager = new SettingsManager(this);
        
        // Initialize UI
        this.setupEventListeners();
        this.updateHelperText();
        this.setupThemeToggle();
        
        // Initialize project manager
        this.projectManager = new ProjectManager(this);
        
        // Set initial canvas size
        this.updateCanvasSize();
        
        // Add window resize listener
        window.addEventListener('resize', () => {
            this.updateCanvasSize();
        });
    }

    // Setup arrow markers with proper color inheritance
    setupArrowMarkers() {
        // Get the defs section
        const defs = this.svg.querySelector('defs');
        if (!defs) return;
        
        // Clear existing markers
        defs.innerHTML = '';

        // Re-create the default markers the wipe just removed: #preview-connection
        // (the drag-to-connect preview line) references #arrowhead-end, so without
        // this the preview renders with no arrowhead.
        [['arrowhead-end', '9', '0 0, 10 3.5, 0 7'], ['arrowhead-start', '1', '10 0, 0 3.5, 10 7']].forEach(([id, refX, points]) => {
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.id = id;
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '7');
            marker.setAttribute('refX', refX);
            marker.setAttribute('refY', '3.5');
            marker.setAttribute('orient', 'auto');
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', points);
            polygon.setAttribute('fill', 'currentColor');
            marker.appendChild(polygon);
            defs.appendChild(marker);
        });

        // Create markers for each theme
        Object.keys(COLOR_THEMES).forEach(themeKey => {
            const theme = COLOR_THEMES[themeKey];
            
            // Create markers for both light and dark modes
            ['light', 'dark'].forEach(mode => {
                const strokeColor = theme[mode].stroke;
                
                // Create end marker
                const markerEndId = `arrowhead-end-${themeKey}-${mode}`;
                const markerEnd = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                markerEnd.id = markerEndId;
                markerEnd.setAttribute('markerWidth', '10');
                markerEnd.setAttribute('markerHeight', '7');
                markerEnd.setAttribute('refX', '9');
                markerEnd.setAttribute('refY', '3.5');
                markerEnd.setAttribute('orient', 'auto');
                
                const polygonEnd = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polygonEnd.setAttribute('points', '0 0, 10 3.5, 0 7');
                polygonEnd.setAttribute('fill', strokeColor);
                
                markerEnd.appendChild(polygonEnd);
                defs.appendChild(markerEnd);
                
                // Create start marker (for bidirectional)
                const markerStartId = `arrowhead-start-${themeKey}-${mode}`;
                const markerStart = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                markerStart.id = markerStartId;
                markerStart.setAttribute('markerWidth', '10');
                markerStart.setAttribute('markerHeight', '7');
                markerStart.setAttribute('refX', '1');
                markerStart.setAttribute('refY', '3.5');
                markerStart.setAttribute('orient', 'auto');
                
                const polygonStart = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polygonStart.setAttribute('points', '10 0, 0 3.5, 10 7');
                polygonStart.setAttribute('fill', strokeColor);
                
                markerStart.appendChild(polygonStart);
                defs.appendChild(markerStart);
            });
        });
    }
    
    // Update canvas size based on box positions with buffer zone
    updateCanvasSize() {
        // Find the maximum bounds in all directions
        let maxRight = 0;
        let maxBottom = 0;
        
        this.boxes.forEach(box => {
            const bounds = box.getBounds();
            maxRight = Math.max(maxRight, bounds.right);
            maxBottom = Math.max(maxBottom, bounds.bottom);
        });
        
        // Add buffer only for height (half viewport height)
        const bufferHeight = window.innerHeight / 2;
        
        // Get visible viewport dimensions (accounts for scrollbar presence)
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight;
        
        // For width: use exactly the content width or viewport width, whichever is larger
        // For height: add buffer for more natural vertical scrolling
        const newWidth = Math.max(maxRight, viewportWidth);
        const newHeight = Math.max(maxBottom + bufferHeight, viewportHeight);
        
        // Apply the new dimensions to relevant elements
        this.canvas.style.width = `${newWidth}px`;
        this.canvas.style.height = `${newHeight}px`;
        
        this.svg.style.width = `${newWidth}px`;
        this.svg.style.height = `${newHeight}px`;
        
        this.boxContainer.style.width = `${newWidth}px`;
        this.boxContainer.style.height = `${newHeight}px`;
    }

    updateAllBoxSizes() {
        // Recalculate and update the size of all boxes
        this.boxes.forEach(box => {
            // Force box to recalculate its size with current text scale
            box.renderMarkdown();
        });
        
        // Update all connections after box sizes change
        this.connections.forEach(connection => {
            connection.update();
        });
        
        // Update canvas size to accommodate new box sizes
        this.updateCanvasSize();
    }
    
    initTheme() {
        // Check for saved theme preference
        const darkMode = localStorage.getItem('darkMode') === 'true';
        if (darkMode) {
            document.body.classList.add('dark-mode');
        }
    }
    
    setupEventListeners() { 
        this.canvas.addEventListener('dblclick', this.handleCanvasDoubleClick.bind(this)); 
        this.canvas.addEventListener('mousedown', this.handleCanvasMouseDown.bind(this)); 
        
        // Use separate event handlers for better scroll position management
        document.addEventListener('mousemove', (e) => {
            // Handle box dragging
            if (this.draggingBox) { 
                const dx = e.clientX - this.dragStartPos.x; 
                const dy = e.clientY - this.dragStartPos.y; 
                const nCx = this.dragBoxStartCenter.cx + dx; 
                const nCy = this.dragBoxStartCenter.cy + dy; 
                this.draggingBox.setCenterPosition(nCx, nCy); 
                this.updateConnectionsForBox(this.draggingBox); 
            } 
            // Handle connection preview drawing
            else if (this.connectionStartBox) { 
                const sC = { cx: this.connectionStartBox.data.cx, cy: this.connectionStartBox.data.cy }; 
                
                // Get scroll position for accurate coordinates
                const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
                const scrollY = window.pageYOffset || document.documentElement.scrollTop;
                
                // Get mouse position relative to canvas with scroll offsets
                const r = this.svg.getBoundingClientRect(); 
                const mX = e.clientX - r.left + scrollX; 
                const mY = e.clientY - r.top + scrollY; 
                
                this.previewPath.setAttribute('d', `M ${sC.cx} ${sC.cy} L ${mX} ${mY}`); 
            }
        }); 
        
        document.addEventListener('mouseup', (e) => {
            if (this.draggingBox) { 
                this.draggingBox = null; 
                this.saveCurrentProject();
                this.updateCanvasSize(); // Update canvas size after drag
            } else if (this.connectionStartBox && e.button === 2) { 
                e.preventDefault(); 
                this.previewPath.setAttribute('display', 'none'); 
                
                // Get correct element at mouse position
                let eTE = document.elementFromPoint(e.clientX, e.clientY); 
                let eBE = eTE?.closest('.box-default'); 
                
                if (eBE) { 
                    const eB = this.boxes.get(eBE.dataset.id); 
                    if (eB && eB !== this.connectionStartBox) { 
                        // Create or update connection between boxes
                        const connection = this.createOrUpdateConnection(this.connectionStartBox, eB);
                        if (connection) {
                            this.saveCurrentProject();
                        }
                    } else if (eB === this.connectionStartBox) {
                        // Change width if right-click and release on the same box
                        eB.toggleWidthType();
                        this.saveCurrentProject();
                    }
                } 
                
                this.connectionStartBox = null; 
                this.rightClickBox = null;
            } 
            
            if (e.button === 0) { 
                this.draggingBox = null; 
            } 
        });

        document.addEventListener('keydown', this.handleKeyDown.bind(this)); 
        document.addEventListener('click', this.handleGlobalClick.bind(this), true); 
        document.addEventListener('contextmenu', e => e.preventDefault()); 

        // Handle mouse leaving the window
        document.addEventListener('mouseleave', () => { 
            if (this.connectionStartBox) { 
                this.previewPath.setAttribute('display', 'none'); 
                this.connectionStartBox = null; 
            } 
        }); 

        // Add scroll event handling to ensure connections update during scrolling
        window.addEventListener('scroll', () => {
            // Update all connections when scrolling to ensure they remain accurate
            this.connections.forEach(connection => {
                connection.update();
            });
        });
    }

    setupThemeToggle() {
        const toggleBtn = document.getElementById('theme-toggle');
        
        toggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            
            // Store theme preference in localStorage
            const isDarkMode = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDarkMode);
            
            // Update all box and connection themes
            this.updateAllThemes();
        });
    }

    // Update themes for all boxes and connections when theme mode changes
    updateAllThemes() {
        // Update boxes
        this.boxes.forEach(box => {
            box.applyColorTheme();
        });
        
        // Update connections
        this.connections.forEach(conn => {
            conn.applyTheme();
        });
    }

    handleCanvasDoubleClick(e) { 
        if (e.target === this.canvas || e.target === this.boxContainer) { 
            const rect = this.boxContainer.getBoundingClientRect(); 
            const cx = e.clientX - rect.left; 
            const cy = e.clientY - rect.top; 
            if (cx >= 0 && cy >= 0 && cx <= rect.width && cy <= rect.height) { 
                this.createBox(cx, cy); 
            } 
        } 
    }

    handleCanvasMouseDown(e) { 
        if (e.target === this.canvas || e.target === this.boxContainer) { 
            // No-op for now - we don't have selection state anymore
        } 
    }

    startDragging(box, e) {
        if (!box || box.isEditing) return;
        
        this.draggingBox = box;
        this.dragStartPos = { x: e.clientX, y: e.clientY };
        this.dragBoxStartCenter = { cx: box.data.cx, cy: box.data.cy };
    }

    handleBoxRightMouseDown(e, box) {
        if (!box || box.isEditing) return;
        
        e.preventDefault();
        
        // Right-click for starting connection
        this.connectionStartBox = box;
        const sC = { cx: box.data.cx, cy: box.data.cy };
        const r = this.svg.getBoundingClientRect();
        const mX = e.clientX - r.left;
        const mY = e.clientY - r.top;
        this.previewPath.setAttribute('d', `M ${sC.cx} ${sC.cy} L ${mX} ${mY}`);
        this.previewPath.setAttribute('display', 'block');
        
        // Also toggle width if mouse up on the same box
        this.rightClickBox = box;
    }

    handleGlobalClick(e) { 
        const targetTextarea = e.target.closest('textarea'); 
        
        if (!targetTextarea) { 
            // Check if any box is in edit mode
            let editingBox = false;
            this.boxes.forEach(box => { 
                if (box.isEditing) { 
                    editingBox = true; 
                    box.commitEdit(); 
                } 
            }); 
        } 
    }

    handleKeyDown(e) { 
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return; 
        
        // Handle Delete/Backspace for removing hovered element
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.hoveredElement) {
            // Delete the hovered element
            if (this.hoveredElement instanceof Box) {
                this.deleteBox(this.hoveredElement);
            } else if (this.hoveredElement instanceof Connection) {
                this.deleteConnection(this.hoveredElement);
            }
            this.saveCurrentProject();
            this.updateCanvasSize(); // Update canvas size after deletion
        }
        
        // Handle 'c' key for changing color of hovered element
        if (e.key === 'c' && this.hoveredElement) {
            if (this.hoveredElement instanceof Box || this.hoveredElement instanceof Connection) {
                this.hoveredElement.cycleColorTheme();
                this.saveCurrentProject();
            }
        }
        
        // Handle '+'/'-' for per-box text size of hovered box
        if ((e.key === '+' || e.key === '=') && this.hoveredElement instanceof Box) {
            this.hoveredElement.changeFontScale(0.1);
            this.saveCurrentProject();
        }
        if ((e.key === '-' || e.key === '_') && this.hoveredElement instanceof Box) {
            this.hoveredElement.changeFontScale(-0.1);
            this.saveCurrentProject();
        }

        // Handle 'a' key for cycling text alignment of hovered box
        if (e.key === 'a' && this.hoveredElement instanceof Box) {
            this.hoveredElement.cycleTextAlign();
            this.saveCurrentProject();
        }

        // Handle 's' key for cycling the shape of hovered box
        if (e.key === 's' && this.hoveredElement instanceof Box) {
            this.hoveredElement.cycleShape();
            this.saveCurrentProject();
        }

        // Handle 'w' key for changing width of hovered box (NOT connections).
        // Moved from 's' (2026-08-20), which now cycles shape; the right-click
        // press+release-on-same-box gesture still toggles width too.
        if (e.key === 'w' && this.hoveredElement instanceof Box) {
            this.hoveredElement.toggleWidthType();
            this.saveCurrentProject();
        }
    }

    createBox(cx, cy) { 
        const id = `box-${this.nextBoxId++}`; 
        const bD = { 
            id: id, 
            cx: cx, 
            cy: cy, 
            width: INITIAL_BOX_WIDTH, 
            height: INITIAL_BOX_HEIGHT, 
            widthType: WIDTH_TYPES.MEDIUM,
            themeKey: 'default',
            markdown: '# Title\nUse **markdown** for formatting'
        }; 
        const b = new Box(bD, this); 
        this.boxContainer.appendChild(b.element); 
        this.boxes.set(id, b); 
        this.updateHelperText(); 
        b.startEditing(); 
        this.updateCanvasSize(); // Update canvas size after adding a box
        return b; 
    }

    //// Create a new connection or update existing one to be bidirectional
    createOrUpdateConnection(startBox, endBox) { 
        if (!startBox || !endBox || startBox === endBox) return null; 
        
        // Check if there's already a connection in the opposite direction
        let existingConnection = null;
        this.connections.forEach(conn => {
            if (conn.startBox === endBox && conn.endBox === startBox) {
                existingConnection = conn;
            }
        });
        
        // If there's an existing connection, make it bidirectional
        if (existingConnection) {
            existingConnection.data.bidirectional = true;
            existingConnection.element.setAttribute('marker-start', 'url(#arrowhead-start)');
            // No longer changing the style when making bidirectional
            existingConnection.update();
            return existingConnection;
        }
        
        // Otherwise create a new connection
        const id = `conn-${this.nextConnectionId++}`; 
        const cD = { 
            id: id, 
            startBoxId: startBox.data.id, 
            endBoxId: endBox.data.id,
            themeKey: 'default',
            pattern: CONNECTION_PATTERNS.NORMAL,
            thickness: CONNECTION_THICKNESSES.NORMAL,
            bidirectional: false
        }; 
        
        // Create the connection instance
        const conn = new Connection(cD, startBox, endBox, this); 
        this.connections.set(id, conn); 
        
        // Add the connection group to SVG
        // All elements are now inside the group
        this.svg.appendChild(conn.group);
        
        // Apply theme and styles
        conn.applyTheme();
        conn.applyPattern();
        conn.applyThickness();
        
        return conn; 
    }

    deleteBox(boxInstance) { 
        if (!boxInstance) return; 
        const bId = boxInstance.data.id; 
        const cTR = []; 
        this.connections.forEach(c => { 
            if (c.startBox === boxInstance || c.endBox === boxInstance) cTR.push(c); 
        }); 
        cTR.forEach(c => this.deleteConnection(c)); 
        boxInstance.element.remove(); 
        this.boxes.delete(bId); 
        this.updateHelperText(); 
        
        // Clear hovered element if needed
        if (this.hoveredElement === boxInstance) {
            this.hoveredElement = null;
        }
        
        // Update canvas size after deletion
        this.updateCanvasSize();
    }

    deleteConnection(connInstance) { 
        if (!connInstance) return; 
        
        // Clean up all connection elements
        connInstance.cleanup();
        
        const cId = connInstance.data.id; 
        this.connections.delete(cId); 
        
        // Clear hovered element if needed
        if (this.hoveredElement === connInstance) {
            this.hoveredElement = null;
        }
    }

    updateConnectionsForBox(boxInstance) { 
        this.connections.forEach(c => { 
            if (c.startBox === boxInstance || c.endBox === boxInstance) c.update(); 
        }); 
    }

    updateHelperText() { 
        this.helperText.style.display = this.boxes.size === 0 ? 'block' : 'none'; 
    }

    // Clear the current diagram
    clearDiagram() {
        // Remove all connections
        this.connections.forEach(conn => {
            conn.cleanup();
        });
        this.connections.clear();
        
        // Remove all boxes
        this.boxes.forEach(box => {
            box.element.remove();
        });
        this.boxes.clear();
        
        // Reset counters
        this.nextBoxId = 1;
        this.nextConnectionId = 1;
        
        // Update helper text
        this.updateHelperText();
        
        // Update canvas size
        this.updateCanvasSize();
    }

    // Export the entire diagram data
    exportData() {
        const boxesData = [];
        this.boxes.forEach(box => {
            boxesData.push(box.exportData());
        });
        
        const connectionsData = [];
        this.connections.forEach(conn => {
            connectionsData.push(conn.exportData());
        });
        
        return {
            boxes: boxesData,
            connections: connectionsData,
            nextBoxId: this.nextBoxId,
            nextConnectionId: this.nextConnectionId
        };
    }

    // Load diagram from exported data
    loadFromProjectData(data) {
        // Clear current diagram
        this.clearDiagram();
        
        // Set counters
        this.nextBoxId = data.nextBoxId || 1;
        this.nextConnectionId = data.nextConnectionId || 1;
        
        // Create boxes first
        const boxMap = new Map(); // Map original IDs to new box instances
        
        if (data.boxes && Array.isArray(data.boxes)) {
            data.boxes.forEach(boxData => {
                const box = new Box(boxData, this);
                this.boxContainer.appendChild(box.element);
                this.boxes.set(boxData.id, box);
                boxMap.set(boxData.id, box);
            });
        }
        
        // Then create connections
        if (data.connections && Array.isArray(data.connections)) {
            data.connections.forEach(connData => {
                const startBox = boxMap.get(connData.startBoxId);
                const endBox = boxMap.get(connData.endBoxId);
                
                if (startBox && endBox) {
                    const conn = new Connection(connData, startBox, endBox, this);
                    this.connections.set(connData.id, conn);
                    
                    // Add the connection group to SVG
                    // All elements are now inside the group
                    this.svg.appendChild(conn.group);
                    
                    // Update connection after adding to DOM
                    conn.update();
                }
            });
        }
        
        // Update helper text
        this.updateHelperText();
        
        // Update canvas size
        this.updateCanvasSize();
    }

    // Save the current project through the project manager
    saveCurrentProject() {
        if (this.projectManager) {
            this.projectManager.saveCurrentProject();
        }
    }
}
