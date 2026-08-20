// --- Box Class ---
class Box {
    constructor(boxData, manager) {
        this.data = boxData;
        if (!this.data.widthType) { this.data.widthType = WIDTH_TYPES.MEDIUM; }
        if (!this.data.markdown) { this.data.markdown = '# New Box\nUse **markdown** to format'; }
        if (!this.data.themeKey) { this.data.themeKey = 'default'; }
        if (!TEXT_ALIGNMENTS.includes(this.data.textAlign)) { this.data.textAlign = 'left'; }
        this.data.fontScale = Math.min(2.0, Math.max(0.5, Number(this.data.fontScale) || 1.0));
        if (!BOX_SHAPES.includes(this.data.shape)) { this.data.shape = 'rectangle'; }
        this.manager = manager;
        this.isEditing = false;
        this.element = this.createElement();
        this.contentDiv = this.element.firstChild;
        this.textarea = null;
        this.updateElementPosition();
        this.applyColorTheme();
        this.applyTextAlign();
        this.applyFontScale();
        this.applyShape();
        this.renderMarkdown();
        this.setupEventListeners();
    }

    createElement() { 
        const div = document.createElement('div'); 
        div.className = BASE_BOX_CLASSES; 
        div.dataset.id = this.data.id; 
        div.dataset.type = 'box';
        div.dataset.theme = this.data.themeKey;
        const contentDiv = document.createElement('div'); 
        contentDiv.className = 'markdown-content relative w-full h-full'; 
        div.appendChild(contentDiv); 
        return div; 
    }
    
    setupEventListeners() {
        let isDragging = false;
        
        this.element.addEventListener('mouseenter', () => {
            this.manager.hoveredElement = this;
        });
        
        this.element.addEventListener('mouseleave', () => {
            if (this.manager.hoveredElement === this) {
                this.manager.hoveredElement = null;
            }
        });
        
        this.element.addEventListener('mousedown', (e) => { 
            isDragging = false; 
            // Start dragging on mousedown
            if (e.button === 0 && !this.isEditing) {
                this.manager.startDragging(this, e);
            } else if (e.button === 2) {
                // Right mouse button down - start connection or change width
                this.manager.handleBoxRightMouseDown(e, this);
            }
        });
        
        this.element.addEventListener('mousemove', () => { 
            if (this.manager.draggingBox === this) { 
                isDragging = true; 
            } 
        });
        
        this.element.addEventListener('dblclick', (e) => { 
            e.stopPropagation(); 
            if (!this.isEditing) { 
                this.startEditing(); 
            } 
        });
        
        this.element.addEventListener('contextmenu', (e) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            return false; 
        });
    }

    // Updates the element's CSS position
    updateElementPosition() {
        const x = this.data.cx - this.data.width / 2;
        const y = this.data.cy - this.data.height / 2;
        this.element.style.left = `${Math.round(x)}px`;
        this.element.style.top = `${Math.round(y)}px`;
        this.element.style.width = `${this.data.width}px`;
        this.element.style.height = `${this.data.height}px`;
    }

    // Updates position using center coordinates - for dragging
    setCenterPosition(cx, cy) { this.data.cx = cx; this.data.cy = cy; this.updateElementPosition(); }
    
    // Get current mode (light or dark)
    getMode() {
        return document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    }
    
    // Apply color theme to the box
    applyColorTheme() {
        const mode = this.getMode();
        const themeKey = this.data.themeKey || 'default';
        const theme = COLOR_THEMES[themeKey] || COLOR_THEMES.default;
        
        // Get the mode-specific theme
        const modeTheme = theme[mode];
        
        // Remove all theme classes
        THEME_KEYS.forEach(key => {
            const lightTheme = COLOR_THEMES[key].light;
            const darkTheme = COLOR_THEMES[key].dark;
            
            // Remove both light and dark variants
            safeRemoveClass(this.element, lightTheme.bg);
            safeRemoveClass(this.element, lightTheme.border);
            safeRemoveClass(this.contentDiv, lightTheme.text);
            
            safeRemoveClass(this.element, darkTheme.bg);
            safeRemoveClass(this.element, darkTheme.border);
            safeRemoveClass(this.contentDiv, darkTheme.text);
        });
        
        // Add current theme classes for the current mode
        if (modeTheme.bg) this.element.classList.add(modeTheme.bg);
        if (modeTheme.border) this.element.classList.add(modeTheme.border);
        if (modeTheme.text) this.contentDiv.classList.add(modeTheme.text);
        
        // Update data attribute for theme identification
        this.element.dataset.theme = themeKey;
    }
    
    // Cycle to the next color theme
    cycleColorTheme() {
        const currentIndex = THEME_KEYS.indexOf(this.data.themeKey);
        const nextIndex = (currentIndex + 1) % THEME_KEYS.length;
        this.data.themeKey = THEME_KEYS[nextIndex];
        this.applyColorTheme();
    }

    // Toggle between width types
    applyTextAlign() {
        this.contentDiv.dataset.align = this.data.textAlign;
    }

    // Which shape the box should currently PRESENT (edit mode always presents
    // the plain rectangle so the textarea pipeline stays untouched).
    presentedShape() {
        return this.isEditing ? 'rectangle' : this.data.shape;
    }

    applyShape() {
        this.element.dataset.shape = this.presentedShape();
    }

    cycleShape() {
        const currentIndex = BOX_SHAPES.indexOf(this.data.shape);
        this.data.shape = BOX_SHAPES[(currentIndex + 1) % BOX_SHAPES.length];
        this.applyShape();

        // Satisfying pop on top of the border-radius / clip-path morph.
        this.element.classList.remove('shape-pop');
        void this.element.offsetWidth;
        this.element.classList.add('shape-pop');
        this.element.addEventListener('animationend',
            () => this.element.classList.remove('shape-pop'), { once: true });

        // Content fitting differs per shape -> re-measure.
        this.calculateRenderedSize();
        this.manager.updateConnectionsForBox(this);
    }

    // Outline of the presented shape as a polygon in canvas coordinates —
    // shared by connection-endpoint intersection. Diamond/triangle fall back
    // to the rectangle outline until their rendering lands.
    getOutlinePolygon() {
        const b = this.getBounds();
        const shape = this.presentedShape();
        const pts = [];
        if (shape === 'circle') {
            const cx = this.data.cx, cy = this.data.cy, rx = b.width / 2, ry = b.height / 2;
            for (let i = 0; i < 36; i++) {
                const a = (i / 36) * Math.PI * 2;
                pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
            }
        } else if (shape === 'rounded' || shape === 'rectangle') {
            const r = Math.min(shape === 'rounded' ? 24 : 8, b.width / 2, b.height / 2);
            // 4 corner arcs sampled at 5 points each, clockwise from top-left
            const corners = [
                { cx: b.left + r,  cy: b.top + r,    from: Math.PI,       to: Math.PI * 1.5 },
                { cx: b.right - r, cy: b.top + r,    from: Math.PI * 1.5, to: Math.PI * 2 },
                { cx: b.right - r, cy: b.bottom - r, from: 0,             to: Math.PI * 0.5 },
                { cx: b.left + r,  cy: b.bottom - r, from: Math.PI * 0.5, to: Math.PI },
            ];
            corners.forEach(c => {
                for (let i = 0; i <= 4; i++) {
                    const a = c.from + (c.to - c.from) * (i / 4);
                    pts.push({ x: c.cx + r * Math.cos(a), y: c.cy + r * Math.sin(a) });
                }
            });
        } else {
            // diamond/triangle placeholder until their rendering phase
            pts.push({ x: b.left, y: b.top }, { x: b.right, y: b.top },
                     { x: b.right, y: b.bottom }, { x: b.left, y: b.bottom });
        }
        return pts;
    }

    applyFontScale() {
        this.element.style.setProperty('--box-font-scale', this.data.fontScale);
    }

    changeFontScale(delta) {
        const next = Math.round((this.data.fontScale + delta) * 10) / 10;
        this.data.fontScale = Math.min(2.0, Math.max(0.5, next));
        this.applyFontScale();
        // Re-measure: font-size drives the content-derived height.
        if (this.isEditing) {
            this.updateEditModeSize();
        } else {
            this.calculateRenderedSize();
        }
        this.manager.updateConnectionsForBox(this);
    }

    cycleTextAlign() {
        const currentIndex = TEXT_ALIGNMENTS.indexOf(this.data.textAlign);
        this.data.textAlign = TEXT_ALIGNMENTS[(currentIndex + 1) % TEXT_ALIGNMENTS.length];
        this.applyTextAlign();

        // Satisfying nudge: restart a short slide/settle animation toward the
        // new alignment (text-align itself is not animatable).
        const anim = 'align-anim-' + (this.data.textAlign === 'right' ? 'right'
            : this.data.textAlign === 'left' ? 'left' : 'center');
        this.contentDiv.classList.remove('align-anim-left', 'align-anim-right', 'align-anim-center');
        void this.contentDiv.offsetWidth; // restart if the same class re-applies
        this.contentDiv.classList.add(anim);
        this.contentDiv.addEventListener('animationend',
            () => this.contentDiv.classList.remove(anim), { once: true });
    }

    toggleWidthType() {
        const types = Object.values(WIDTH_TYPES);
        const currentIndex = types.indexOf(this.data.widthType);
        const nextIndex = (currentIndex + 1) % types.length;
        this.data.widthType = types[nextIndex];
        
        // Set the new width directly
        const width = WIDTH_TYPE_VALUES[this.data.widthType];
        this.data.width = width;
        
        // Update size based on current mode
        if (this.isEditing) {
            this.updateEditModeSize();
        } else {
            this.renderMarkdown();
        }
        
        this.manager.updateConnectionsForBox(this);
    }

    // Renders markdown content to HTML and calculates size
    renderMarkdown() {
        if (!this.data.markdown) return;
        
        // Sanitize before innerHTML: markdown arrives from imported JSON files
        // too, and marked v4 passes raw HTML through. Without this, a shared
        // project file can carry script payloads into the page (and into
        // exported SVGs, which copy this rendered DOM).
        const sanitize = (html) => typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(html) : html;
        try {
            // Use marked.js or fallback
            this.contentDiv.innerHTML = sanitize(typeof marked !== 'undefined' && typeof marked.parse === 'function' 
                ? marked.parse(this.data.markdown) 
                : simpleMarkdownParser(this.data.markdown));
        } catch (e) {
            console.error('Error parsing markdown:', e);
            this.contentDiv.innerHTML = sanitize(simpleMarkdownParser(this.data.markdown));
        }
        
        // Update size after rendering
        this.calculateRenderedSize();
    }

    // Calculate size with fixed width based on type
    calculateRenderedSize() {
        // Clone for measurement
        const clone = this.element.cloneNode(true);
        document.body.appendChild(clone);
        
        // Reset styles for measurement
        clone.style.position = 'absolute';
        clone.style.visibility = 'hidden';
        clone.style.left = '-9999px';
        clone.style.top = '-9999px';
        clone.style.height = 'auto';
        clone.style.maxWidth = 'none';
        clone.style.transition = 'none';
        clone.style.animation = 'none';
        
        // Use fixed width from width type directly
        const fixedWidth = WIDTH_TYPE_VALUES[this.data.widthType];
        clone.style.width = `${fixedWidth}px`;
        
        // Force reflow and measure height with the fixed width. The clone
        // carries data-shape, so shaped content-width constraints apply; the
        // shape's height ratio adds the headroom the outline needs.
        clone.offsetHeight;
        const heightRatio = (SHAPE_CONFIG[this.presentedShape()] || SHAPE_CONFIG.rectangle).heightRatio;
        const newHeight = Math.max(Math.round(clone.offsetHeight * heightRatio), 50);
        
        // Clean up
        document.body.removeChild(clone);
        
        // Update size
        this.data.width = fixedWidth;
        this.data.height = newHeight;
        this.updateElementPosition();
        
        return { width: fixedWidth, height: newHeight };
    }

    // Calculate box height based on line count
    calculateHeightFromLineCount() {
        if (!this.isEditing || !this.textarea) return 50;
        
        const lineCount = this.textarea.value.split('\n').length;
        return PADDING_HEIGHT + (lineCount * LINE_HEIGHT);
    }

    // Updates box size based on text content during editing
    updateEditModeSize() {
        if (!this.isEditing || !this.textarea) return;
        
        // Always use fixed width from width type
        const width = WIDTH_TYPE_VALUES[this.data.widthType];
        
        // Calculate height based on line count
        const height = this.calculateHeightFromLineCount();
        
        // Update size
        this.data.width = width;
        this.data.height = height;
        this.updateElementPosition();
        this.manager.updateConnectionsForBox(this);
    }

    // Switches to editing mode
    startEditing() {
        if (this.isEditing) return;
        this.isEditing = true;
        this.applyShape(); // edit mode presents the plain rectangle
        this.element.classList.remove('cursor-move');
        
        // Clear and prepare container
        this.contentDiv.innerHTML = '';
        
        // Create textarea
        this.textarea = document.createElement('textarea');
        this.textarea.className = 'edit-textarea';
        this.textarea.value = this.data.markdown || '';
        this.textarea.placeholder = 'Add markdown content...';
        
        // Set fixed width from width type
        this.data.width = WIDTH_TYPE_VALUES[this.data.widthType];
        
        // Add event listeners
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { 
                e.preventDefault(); 
                this.cancelEdit(); 
            } else if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.commitEdit();
            }
            
            // Update size on next tick
            setTimeout(() => this.updateEditModeSize(), 0);
        });
        
        this.textarea.addEventListener('input', () => {
            this.updateEditModeSize();
        });
        
        // Prevent event propagation
        this.textarea.addEventListener('mousedown', e => e.stopPropagation());
        this.textarea.addEventListener('contextmenu', e => e.stopPropagation());
        this.textarea.addEventListener('dblclick', e => e.stopPropagation());
        this.textarea.addEventListener('click', e => e.stopPropagation());

        // Append the textarea to the DOM
        this.contentDiv.appendChild(this.textarea);

        // Focus and select text safely with a check
        requestAnimationFrame(() => {
            // Guard clause to prevent the error
            if (this.textarea && this.contentDiv.contains(this.textarea)) {
                this.textarea.focus();
                if (this.textarea.value) this.textarea.select();
            }
            this.updateEditModeSize();
        });
    }

    commitEdit() { 
        if (!this.isEditing || !this.textarea) return false; 
        const markdown = this.textarea.value.trim(); 
        if (!markdown) { 
            this.cancelEdit(); 
            return false; 
        } 
        this.data.markdown = markdown; 
        this.cleanupEdit(); 
        this.renderMarkdown(); 
        this.manager.updateConnectionsForBox(this); 
        this.manager.saveCurrentProject();
        this.manager.updateCanvasSize(); // Update canvas size after edit
        return true; 
    }
    
    cancelEdit() { 
        if (!this.isEditing) return; 
        if (!this.data.markdown) { 
            this.manager.deleteBox(this); 
            return; 
        } 
        this.cleanupEdit(); 
        this.renderMarkdown(); 
    }
    
    cleanupEdit() { 
        this.isEditing = false; 
        if (this.textarea && this.textarea.parentNode) { 
            this.textarea.remove(); 
        } 
        this.textarea = null; 
        this.element.classList.add('cursor-move'); 
        this.applyShape(); // restore the real shape (edit mode presents rectangle)
    }
    
    getBounds() { 
        const x = this.data.cx - this.data.width / 2; 
        const y = this.data.cy - this.data.height / 2; 
        return { 
            left: x, 
            right: x + this.data.width, 
            top: y, 
            bottom: y + this.data.height, 
            width: this.data.width, 
            height: this.data.height 
        }; 
    }
    
    // Export box data
    exportData() {
        return {
            id: this.data.id,
            cx: this.data.cx,
            cy: this.data.cy,
            width: this.data.width,
            height: this.data.height,
            widthType: this.data.widthType,
            themeKey: this.data.themeKey,
            textAlign: this.data.textAlign,
            fontScale: this.data.fontScale,
            shape: this.data.shape,
            markdown: this.data.markdown
        };
    }
}
