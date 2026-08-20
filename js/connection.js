// --- Connection Class ---
class Connection {
    constructor(connectionData, startBox, endBox, manager) { 
        this.data = connectionData; 
        // Initialize data if needed
        if (!this.data.themeKey) this.data.themeKey = 'default';
        if (!this.data.pattern) this.data.pattern = CONNECTION_PATTERNS.NORMAL;
        if (!this.data.thickness) this.data.thickness = CONNECTION_THICKNESSES.NORMAL;
        if (this.data.bidirectional === undefined) this.data.bidirectional = false;
        
        this.startBox = startBox; 
        this.endBox = endBox; 
        this.manager = manager; 
        
        // Create connection group and all elements
        this.createElements();
        
        this.update(); 
        this.setupEventListeners(); 
    }
    
    createElements() {
        // Create a group for the connection
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.group.setAttribute('class', 'connection-group');
        this.group.dataset.id = this.data.id;
        this.group.dataset.type = 'connection-group';
        
        // Create the hitbox path with wide stroke for easier clicking
        this.hitboxElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.hitboxElement.setAttribute('class', 'connection-hitbox');
        this.hitboxElement.dataset.id = this.data.id;
        this.hitboxElement.dataset.type = 'connection-hitbox';
        
        // Create the visible connection path
        this.element = document.createElementNS('http://www.w3.org/2000/svg', 'path'); 
        this.element.setAttribute('class', 'connection-path pointer-events-none'); 
        this.element.dataset.id = this.data.id; 
        this.element.dataset.type = 'connection';
        this.element.dataset.theme = this.data.themeKey;
        
        // Set markers based on if bidirectional
        if (this.data.bidirectional) {
            this.element.setAttribute('marker-start', 'url(#arrowhead-start)');
        }
        this.element.setAttribute('marker-end', 'url(#arrowhead-end)');
        
        // Create start hotspot inside the group
        this.startHotspot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.startHotspot.setAttribute('class', 'arrow-hotspot');
        this.startHotspot.setAttribute('r', '12');
        this.startHotspot.dataset.connection = this.data.id;
        this.startHotspot.dataset.end = 'start';
        
        // Create end hotspot inside the group
        this.endHotspot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.endHotspot.setAttribute('class', 'arrow-hotspot');
        this.endHotspot.setAttribute('r', '12');
        this.endHotspot.dataset.connection = this.data.id;
        this.endHotspot.dataset.end = 'end';
        
        // Add all elements to the group in the correct order (hitbox first, then line, then interaction points)
        this.group.appendChild(this.hitboxElement);
        this.group.appendChild(this.element);
        this.group.appendChild(this.startHotspot);
        this.group.appendChild(this.endHotspot);
        
        // Set up event listeners for the hotspots
        this.setupHotspotEventListeners();
    }
    
    // Get current mode (light or dark)
    getMode() {
        return document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    }
    
    // Set up event listeners for the hotspots
    setupHotspotEventListeners() {
        this.startHotspot.addEventListener('mouseenter', () => {
            this.manager.hoveredElement = this;
        });
        
        this.startHotspot.addEventListener('mouseleave', () => {
            if (this.manager.hoveredElement === this) {
                this.manager.hoveredElement = null;
            }
        });
        
        this.startHotspot.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleBidirectional();
            this.manager.saveCurrentProject();
        });
        
        this.endHotspot.addEventListener('mouseenter', () => {
            this.manager.hoveredElement = this;
        });
        
        this.endHotspot.addEventListener('mouseleave', () => {
            if (this.manager.hoveredElement === this) {
                this.manager.hoveredElement = null;
            }
        });
        
        this.endHotspot.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleBidirectional();
            this.manager.saveCurrentProject();
        });
    }
    
    // Toggle bidirectionality of the connection
    toggleBidirectional() {
        this.data.bidirectional = !this.data.bidirectional;
        
        // Apply the updated bidirectional state
        this.update();
        
        // Call applyTheme to ensure the correct marker is used
        this.applyTheme();
    }
    
    setupEventListeners() { 
        // Add interaction events to the hitbox element
        this.hitboxElement.addEventListener('mouseenter', () => {
            this.manager.hoveredElement = this;
        });
        
        this.hitboxElement.addEventListener('mouseleave', () => {
            if (this.manager.hoveredElement === this) {
                this.manager.hoveredElement = null;
            }
        });
        
        // Add left-click event to toggle line pattern
        this.hitboxElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.cyclePattern();
            this.manager.saveCurrentProject();
        });
        
        // Add right-click event to toggle thickness
        this.hitboxElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.cycleThickness();
            this.manager.saveCurrentProject();
        });
    }
    
    // Apply the current theme to the connection
    applyTheme() {
        const mode = this.getMode();
        const themeKey = this.data.themeKey || 'default';
        const theme = COLOR_THEMES[themeKey] || COLOR_THEMES.default;
        
        // Get stroke color for current mode
        const strokeColor = theme[mode].stroke;
        
        if (this.element) {
            // Set stroke color
            this.element.setAttribute('stroke', strokeColor);
            
            // Use theme-specific markers based on theme and current mode
            const startMarkerId = `arrowhead-start-${themeKey}-${mode}`;
            const endMarkerId = `arrowhead-end-${themeKey}-${mode}`;
            
            // Use theme-specific markers
            if (this.data.bidirectional) {
                this.element.setAttribute('marker-start', `url(#${startMarkerId})`);
            } else {
                this.element.removeAttribute('marker-start');
            }
            this.element.setAttribute('marker-end', `url(#${endMarkerId})`);
            
            // Also set hover fill color for hotspots to match the theme
            this.startHotspot.style.setProperty('--transparent-black-5', strokeColor + '33');
            this.endHotspot.style.setProperty('--transparent-black-5', strokeColor + '33');
        }
        
        // Update data attributes for theme identification
        this.element.dataset.theme = themeKey;
        this.group.dataset.theme = themeKey;
    }
    
    // Cycle to the next color theme
    cycleColorTheme() {
        const currentIndex = THEME_KEYS.indexOf(this.data.themeKey);
        const nextIndex = (currentIndex + 1) % THEME_KEYS.length;
        this.data.themeKey = THEME_KEYS[nextIndex];
        this.applyTheme();
        this.manager.saveCurrentProject();
    }
    
    // Apply current pattern to the connection
    applyPattern() {
        // Remove all pattern classes first
        this.element.classList.remove(
            'connection-pattern-normal',
            'connection-pattern-dashed', 
            'connection-pattern-dotted'
        );
        
        // Add current pattern class
        this.element.classList.add(`connection-pattern-${this.data.pattern}`);
    }
    
    // Apply current thickness to the connection
    applyThickness() {
        // Remove all thickness classes first
        this.element.classList.remove(
            'connection-thickness-thin',
            'connection-thickness-normal',
            'connection-thickness-bold'
        );
        
        // Add current thickness class
        this.element.classList.add(`connection-thickness-${this.data.thickness}`);
    }
    
    // Cycle to the next line pattern (left click)
    cyclePattern() {
        const patterns = Object.values(CONNECTION_PATTERNS);
        const currentIndex = patterns.indexOf(this.data.pattern);
        const nextIndex = (currentIndex + 1) % patterns.length;
        this.data.pattern = patterns[nextIndex];
        this.applyPattern();
    }
    
    // Cycle to the next thickness (right click)
    cycleThickness() {
        const thicknesses = Object.values(CONNECTION_THICKNESSES);
        const currentIndex = thicknesses.indexOf(this.data.thickness);
        const nextIndex = (currentIndex + 1) % thicknesses.length;
        this.data.thickness = thicknesses[nextIndex];
        this.applyThickness();
    }
    
    calculateIntersection(startPt, endPt, targetBox) { 
        const bounds = targetBox.getBounds(); 
        const dx = endPt.x - startPt.x; 
        const dy = endPt.y - startPt.y; 
        if (bounds.width <= 0 || bounds.height <= 0 || (dx === 0 && dy === 0)) { 
            return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }; 
        } 
        // Generic ray-vs-outline: works for every box shape via the shared
        // outline polygon (rectangle results match the old rect-only math).
        const poly = targetBox.getOutlinePolygon();
        let t = Infinity; 
        let intersection = null; 
        const eps = 1e-9;
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            const ex = b.x - a.x;
            const ey = b.y - a.y;
            const denom = dx * ey - dy * ex;
            if (Math.abs(denom) < eps) continue;
            const sx = a.x - startPt.x;
            const sy = a.y - startPt.y;
            const tRay = (sx * ey - sy * ex) / denom;   // param along start->end
            const u = (sx * dy - sy * dx) / denom;       // param along the edge
            if (tRay >= 0 && tRay < t && u >= -0.001 && u <= 1.001) {
                t = tRay;
                intersection = { x: startPt.x + tRay * dx, y: startPt.y + tRay * dy };
            }
        }
        if (intersection) { 
            const len = Math.sqrt(dx*dx + dy*dy) || 1; 
            const ux = dx / len; 
            const uy = dy / len; 
            intersection.x -= ux * 2; 
            intersection.y -= uy * 2; 
        } 
        return intersection || { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }; 
    }
    
    update() { 
        if (!this.startBox || !this.endBox) return; 
        const sC = { x: this.startBox.data.cx, y: this.startBox.data.cy }; 
        const eC = { x: this.endBox.data.cx, y: this.endBox.data.cy }; 
        const eP = this.calculateIntersection(sC, eC, this.endBox); 
        const sP = this.calculateIntersection(eP, sC, this.startBox); 
        
        if (!isNaN(sP.x) && !isNaN(eP.x)) { 
            const pathData = `M ${sP.x} ${sP.y} L ${eP.x} ${eP.y}`;
            
            // Update both the visible path and hitbox path
            this.element.setAttribute('d', pathData); 
            this.hitboxElement.setAttribute('d', pathData);
            
            // Update hotspot positions
            this.updateHotspotPositions(sP, eP);
        } else { 
            this.element.setAttribute('d', ''); 
            this.hitboxElement.setAttribute('d', '');
        } 
        
        this.updateElementStyle(); 
    }
    
    // Update hotspot positions
    updateHotspotPositions(startPoint, endPoint) {
        // Calculate vector
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len === 0) return;
        
        const ux = dx / len;
        const uy = dy / len;
        
        // Position hotspots
        if (this.startHotspot) {
            const startHotspotX = startPoint.x + ux * 12;
            const startHotspotY = startPoint.y + uy * 12;
            this.startHotspot.setAttribute('cx', startHotspotX);
            this.startHotspot.setAttribute('cy', startHotspotY);
        }
        
        if (this.endHotspot) {
            const endHotspotX = endPoint.x - ux * 12;
            const endHotspotY = endPoint.y - uy * 12;
            this.endHotspot.setAttribute('cx', endHotspotX);
            this.endHotspot.setAttribute('cy', endHotspotY);
        }
    }
    
    updateElementStyle() { 
        // Apply theme, pattern and thickness
        this.applyTheme();
        this.applyPattern();
        this.applyThickness();
    }
    
    // Clean up the connection by removing the whole group
    cleanup() {
        if (this.group) {
            this.group.remove();
            this.group = null;
            this.element = null;
            this.hitboxElement = null;
            this.startHotspot = null;
            this.endHotspot = null;
        }
    }
    
    // Export connection data
    exportData() {
        return {
            id: this.data.id,
            startBoxId: this.startBox.data.id,
            endBoxId: this.endBox.data.id,
            themeKey: this.data.themeKey,
            pattern: this.data.pattern,
            thickness: this.data.thickness,
            bidirectional: this.data.bidirectional
        };
    }
}
