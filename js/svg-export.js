// --- SVG Export Manager Class ---

// Coordinates are emitted at 2dp: enough to keep sub-pixel text placement,
// short enough to keep the exported file readable.
function svgRound(value) { return Math.round(value * 100) / 100; }

class SVGExportManager {
    constructor(diagramManager) {
        this.diagramManager = diagramManager;
    }
    
    // Export the current diagram as an SVG file
    exportSVG() {
        // Get all the elements to include in the export
        const boxes = this.diagramManager.boxes;
        const connections = this.diagramManager.connections;
        
        // Create a new SVG element
        const svgNamespace = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNamespace, "svg");
        
        // Find the bounding box for all elements
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        
        // Include space for the title at the top
        const titleHeight = 60; // Reserve space for title
        minY = Math.min(minY, 0); // Ensure we start from the top
        
        // Calculate bounds from boxes
        boxes.forEach(box => {
            const bounds = box.getBounds();
            minX = Math.min(minX, bounds.left);
            minY = Math.min(minY, bounds.top);
            maxX = Math.max(maxX, bounds.right);
            maxY = Math.max(maxY, bounds.bottom);
        });
        
        // Add padding
        const padding = 20;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding - titleHeight); // Extra space for title
        maxX += padding;
        maxY += padding;
        
        // Calculate exact dimensions
        const width = maxX - minX;
        const height = maxY - minY + titleHeight;
        
        // Set SVG attributes
        svg.setAttribute("width", width + "px");
        svg.setAttribute("height", height + "px");
        svg.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
        
        // Get the current theme mode
        const isDarkMode = document.body.classList.contains('dark-mode');
        
        // Add class to SVG root for dark mode
        if (isDarkMode) {
            svg.classList.add('dark-mode');
            
            // Create a background rectangle for dark mode only. Read the resolved
            // value from body — .dark-mode lives on body, so documentElement
            // always reports the light value (which is why the old hex-sniff
            // guard here never fired and dark exports shipped with no background).
            const darkBgColor = getComputedStyle(document.body)
                .getPropertyValue('--bg-primary')
                .trim();

            const bgRect = document.createElementNS(svgNamespace, "rect");
            bgRect.setAttribute("x", minX);
            bgRect.setAttribute("y", minY);
            bgRect.setAttribute("width", width);
            bgRect.setAttribute("height", height);
            bgRect.setAttribute("fill", darkBgColor);

            // Insert background as first element
            svg.appendChild(bgRect);
        }
        // No background rect added in light mode
        
        // Add metadata about theme mode
        const metadata = document.createElementNS(svgNamespace, "metadata");
        metadata.textContent = JSON.stringify({
            themeMode: isDarkMode ? 'dark' : 'light',
            exportDate: new Date().toISOString()
        });
        svg.appendChild(metadata);
        
        // Add style definitions that include all CSS variables and classes
        const style = document.createElementNS(svgNamespace, "style");
        style.textContent = this.extractThemeStyles();
        svg.appendChild(style);
        
        // Create a defs section for markers (arrowheads)
        const defs = document.createElementNS(svgNamespace, "defs");
        
        // Add theme-specific arrow markers for all themes
        Object.keys(COLOR_THEMES).forEach(themeKey => {
            // Create markers for both light and dark modes
            this.createArrowMarkers(defs, themeKey, 'light');
            this.createArrowMarkers(defs, themeKey, 'dark');
        });
        
        svg.appendChild(defs);
        
        // Add project title at the top
        this.addProjectTitle(svg, svgNamespace, minX, minY, width);
        
        // Create a group for connections
        const connectionsGroup = document.createElementNS(svgNamespace, "g");
        connectionsGroup.setAttribute("class", "connections");
        
        // Add all connections
        connections.forEach(connection => {
            const connectionGroup = document.createElementNS(svgNamespace, "g");
            const themeKey = connection.data.themeKey || 'default';
            
            // Set basic class to identify the element
            connectionGroup.setAttribute("class", `connection-group theme-${themeKey}`);
            
            // Create the connection path
            const path = document.createElementNS(svgNamespace, "path");
            path.setAttribute("d", connection.element.getAttribute("d"));
            path.setAttribute("class", `connection-path pattern-${connection.data.pattern} thickness-${connection.data.thickness}`);
            
            // Set markers based on directionality, with mode-specific IDs
            const mode = isDarkMode ? 'dark' : 'light';
            if (connection.data.bidirectional) {
                path.setAttribute("marker-start", `url(#arrowhead-start-${themeKey}-${mode})`);
            }
            path.setAttribute("marker-end", `url(#arrowhead-end-${themeKey}-${mode})`);
            
            connectionGroup.appendChild(path);
            connectionsGroup.appendChild(connectionGroup);
        });
        
        svg.appendChild(connectionsGroup);
        
        // Create a group for boxes
        const boxesGroup = document.createElementNS(svgNamespace, "g");
        boxesGroup.setAttribute("class", "boxes");
        
        // Add all boxes
        boxes.forEach(box => {
            const bounds = box.getBounds();
            const themeKey = box.data.themeKey || 'default';
            const theme = COLOR_THEMES[themeKey] || COLOR_THEMES.default;
            
            // Create a group for this box
            const boxGroup = document.createElementNS(svgNamespace, "g");
            boxGroup.setAttribute("class", `box theme-${themeKey}`);
            boxGroup.setAttribute("transform", `translate(${bounds.left}, ${bounds.top})`);
            
            // Create the box's shape element (theme classes carry fill/stroke)
            const shape = box.data.shape || 'rectangle';
            let shapeEl;
            if (shape === 'circle') {
                shapeEl = document.createElementNS(svgNamespace, "ellipse");
                shapeEl.setAttribute("cx", bounds.width / 2);
                shapeEl.setAttribute("cy", bounds.height / 2);
                shapeEl.setAttribute("rx", bounds.width / 2);
                shapeEl.setAttribute("ry", bounds.height / 2);
            } else if (shape === 'diamond' || shape === 'triangle') {
                shapeEl = document.createElementNS(svgNamespace, "path");
                shapeEl.setAttribute("d", roundedPolygonPath(
                    polygonShapeVertices(shape, 0, 0, bounds.width, bounds.height),
                    POLYGON_CORNER_RADIUS).d);
            } else {
                shapeEl = document.createElementNS(svgNamespace, "rect");
                shapeEl.setAttribute("width", bounds.width);
                shapeEl.setAttribute("height", bounds.height);
                const r = shape === 'rounded' ? '24' : '8';
                shapeEl.setAttribute("rx", r);
                shapeEl.setAttribute("ry", r);
            }
            
            // Apply theme classes - for both light and dark modes
            // The SVG's .dark-mode class will determine which is active
            shapeEl.classList.add('light-' + themeKey + '-bg', 'light-' + themeKey + '-border');
            shapeEl.classList.add('dark-' + themeKey + '-bg', 'dark-' + themeKey + '-border');
            
            boxGroup.appendChild(shapeEl);
            
            // Emit the box content as native SVG primitives. A <foreignObject>
            // renders blank in PowerPoint (and in most non-browser SVG
            // consumers), so the text is re-created as <text> runs whose
            // geometry is read back from the live DOM - the browser has
            // already applied wrapping, alignment, shape insets and font
            // scaling, so nothing here re-derives layout.
            const boxClientRect = box.element.getBoundingClientRect();
            const contentGroup = document.createElementNS(svgNamespace, "g");
            contentGroup.setAttribute("class", "box-content");
            // Decorations first: they paint under the text.
            this.extractDecorations(box.contentDiv, boxClientRect)
                .forEach(el => contentGroup.appendChild(el));
            this.extractTextFragments(box.contentDiv, boxClientRect)
                .forEach(fragment => contentGroup.appendChild(fragment.symbol
                    ? this.emitListSymbol(fragment)
                    : this.emitTextFragment(fragment)));
            boxGroup.appendChild(contentGroup);

            boxesGroup.appendChild(boxGroup);
        });
        
        svg.appendChild(boxesGroup);
        
        // Convert SVG to a string
        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(svg);
        
        // Add XML declaration and doctype
        svgString = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
                    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
                    svgString;
        
        // Create a blob and download the SVG
        const blob = new Blob([svgString], {type: "image/svg+xml"});
        const url = URL.createObjectURL(blob);
        
        // Get project name for the filename
        const projectName = this.getProjectName();
        const filename = projectName ? `${projectName}.svg` : "flowchart.svg";
        
        const downloadLink = document.createElement("a");
        downloadLink.href = url;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    }
    // --- Native SVG content extraction ---------------------------------
    // These read geometry back from the rendered DOM. Every layout decision
    // (line breaking, text-align, per-box --box-font-scale, the global text
    // scale, shape content insets) is already resolved there; nothing below
    // recomputes any of it.

    // Font ascent for a CSS font shorthand, cached per shorthand string.
    // Client rects give a line box top; <text> needs a baseline.
    getFontAscent(fontSpec, fontSizePx) {
        if (!this._ascentCache) this._ascentCache = new Map();
        if (this._ascentCache.has(fontSpec)) return this._ascentCache.get(fontSpec);
        let ascent = 0;
        try {
            if (!this._measureCtx) {
                this._measureCtx = document.createElement('canvas').getContext('2d');
            }
            this._measureCtx.font = fontSpec;
            const metrics = this._measureCtx.measureText('Mg');
            ascent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent || 0;
        } catch (e) {
            ascent = 0;
        }
        // Fallback for engines without font bounding metrics.
        if (!ascent || !isFinite(ascent)) ascent = fontSizePx * 0.8;
        this._ascentCache.set(fontSpec, ascent);
        return ascent;
    }

    // Split one text node into per-visual-line fragments by walking a Range
    // one character at a time and watching for a second client rect - that is
    // the moment the character just added landed on a new line.
    splitTextNodeIntoLines(node) {
        const value = node.nodeValue;
        const lines = [];
        const range = document.createRange();
        const visibleRects = (start, end) => {
            range.setStart(node, start);
            range.setEnd(node, end);
            return Array.from(range.getClientRects()).filter(r => r.width > 0.5);
        };
        let lineStart = 0;
        let lineRect = null;
        for (let i = 1; i <= value.length; i++) {
            const rects = visibleRects(lineStart, i);
            if (rects.length === 0) continue; // collapsed leading whitespace
            if (rects.length > 1) {
                // Chars [lineStart, i-1) completed a line; char i-1 starts the next.
                if (lineRect) lines.push({ start: lineStart, end: i - 1, text: value.slice(lineStart, i - 1), rect: lineRect });
                lineStart = i - 1;
                lineRect = rects[rects.length - 1];
            } else {
                lineRect = rects[0];
            }
        }
        if (lineRect && lineStart < value.length) {
            lines.push({ start: lineStart, end: value.length, text: value.slice(lineStart), rect: lineRect });
        }
        return lines;
    }

    // Word-level split of one already-identified line. Justified text has its
    // inter-word spacing stretched by the browser; a single <text> run would
    // re-render it at natural spacing and fall short of the line's right edge,
    // so each word is placed at the x the browser gave it.
    splitLineIntoWords(node, start, end) {
        const value = node.nodeValue;
        const words = [];
        const range = document.createRange();
        let i = start;
        while (i < end) {
            while (i < end && /\s/.test(value[i])) i++;
            let j = i;
            while (j < end && !/\s/.test(value[j])) j++;
            if (j > i) {
                range.setStart(node, i);
                range.setEnd(node, j);
                const rects = Array.from(range.getClientRects()).filter(r => r.width > 0.5);
                if (rects.length > 0) words.push({ text: value.slice(i, j), rect: rects[0] });
            }
            i = j;
        }
        return words;
    }

    // Text nodes -> positioned fragments in box-local coordinates.
    extractTextFragments(contentDiv, boxClientRect) {
        const fragments = [];
        if (!contentDiv) return fragments;
        // First fragment of each list item, so a marker can borrow that line's
        // baseline instead of modelling one.
        const firstFragmentByItem = new Map();
        const walker = document.createTreeWalker(contentDiv, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
            if (!node.nodeValue || node.nodeValue.trim() === '') continue; // layout-only whitespace
            const parent = node.parentElement;
            if (!parent) continue;
            const parentStyle = getComputedStyle(parent);
            if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') continue;
            const fontSizePx = parseFloat(parentStyle.fontSize) || 0;
            const fontFamily = parentStyle.fontFamily;
            const fontWeight = parentStyle.fontWeight;
            const fontStyle = parentStyle.fontStyle;
            const preserveWhitespace = /^(pre|pre-wrap|break-spaces)$/.test(parentStyle.whiteSpace);
            const fontSpec = `${fontStyle} ${fontWeight} ${fontSizePx}px ${fontFamily}`;
            const ascent = this.getFontAscent(fontSpec, fontSizePx);
            const justified = parentStyle.textAlign === 'justify';
            const pushRun = (raw, rect) => {
                // The browser has already collapsed runs of whitespace unless
                // the element preserves them; match that in the emitted run so
                // widths agree with what the page shows.
                const text = preserveWhitespace
                    ? raw.replace(/[\r\n]+$/, '')
                    : raw.replace(/\s+/g, ' ');
                if (text === '' || text.trim() === '') return;
                fragments.push({
                    text,
                    x: rect.left - boxClientRect.left,
                    baselineY: (rect.top - boxClientRect.top) + ascent,
                    fontFamily,
                    fontSizePx,
                    fontWeight,
                    fontStyle,
                    fill: parentStyle.color
                });
                const item = parent.closest('li');
                if (item && contentDiv.contains(item) && !firstFragmentByItem.has(item)) {
                    firstFragmentByItem.set(item, fragments[fragments.length - 1]);
                }
            };
            this.splitTextNodeIntoLines(node).forEach(line => {
                if (justified) {
                    this.splitLineIntoWords(node, line.start, line.end)
                        .forEach(word => pushRun(word.text, word.rect));
                } else {
                    pushRun(line.text, line.rect);
                }
            });
        }
        return fragments.concat(this.extractListMarkers(contentDiv, boxClientRect, firstFragmentByItem));
    }

    // The ordinal a list item's marker shows: <ol start>, per-item value= and
    // reversed all shift it, so it is counted rather than assumed.
    listItemOrdinal(item) {
        const list = item.parentElement;
        if (!list) return 1;
        const items = Array.from(list.children).filter(c => c.tagName === 'LI');
        const reversed = list.tagName === 'OL' && list.hasAttribute('reversed');
        const startAttr = parseInt(list.getAttribute('start'), 10);
        let n = isNaN(startAttr) ? (reversed ? items.length : 1) : startAttr;
        for (const candidate of items) {
            const valueAttr = parseInt(candidate.getAttribute('value'), 10);
            if (!isNaN(valueAttr)) n = valueAttr;
            if (candidate === item) return n;
            n += reversed ? -1 : 1;
        }
        return n;
    }

    // List markers are ::marker pseudo-elements: they have no DOM node and no
    // client rect, so unlike everything else here their geometry has to be
    // derived. Measured against Chrome on 2026-08-21 (font sizes 10/14/20/28,
    // list-style disc/circle/square/decimal):
    //   * an outside marker's box ends 7px short of the item's content edge;
    //   * a bullet is synthesised geometry, not the U+2022 glyph - it is drawn
    //     in a box one third of the font's ascent across, centred at
    //     itemLeft - 7 - fontSize/2 horizontally and ascent/3 above the first
    //     line's baseline (measured centres were within 0.5px of that for
    //     three different font stacks at both sizes);
    //   * a numeric marker is text ending one space short of the content edge;
    //   * an inside marker (which is what centre/right aligned lists use) is
    //     part of the line box instead: it hangs off the first run's start,
    //     the bullet's ink ending one font-size short of it.
    extractListMarkers(contentDiv, boxClientRect, firstFragmentByItem) {
        const SYMBOL_MARKERS = { disc: 'disc', circle: 'circle', square: 'square' };
        const MARKER_PAD = 7;
        const SYMBOL_ASCENT_FRACTION = 1 / 3;
        const markers = [];
        contentDiv.querySelectorAll('li').forEach(item => {
            const anchor = firstFragmentByItem.get(item);
            if (!anchor) return; // empty item - nothing to hang a baseline on
            const itemStyle = getComputedStyle(item);
            const type = itemStyle.listStyleType;
            const symbol = SYMBOL_MARKERS[type];
            let text = null;
            if (!symbol) {
                if (type !== 'decimal') return; // 'none', or a numbering system we would only guess at
                text = this.listItemOrdinal(item) + '.';
            }
            const markerStyle = getComputedStyle(item, '::marker');
            const fontSizePx = parseFloat(markerStyle.fontSize) || parseFloat(itemStyle.fontSize) || 0;
            const fontFamily = markerStyle.fontFamily || itemStyle.fontFamily;
            const fontWeight = markerStyle.fontWeight || itemStyle.fontWeight;
            const fontStyle = markerStyle.fontStyle || itemStyle.fontStyle;
            const fill = markerStyle.color || itemStyle.color;
            const inside = itemStyle.listStylePosition === 'inside';
            const itemLeft = item.getBoundingClientRect().left - boxClientRect.left;
            const fontSpec = `${fontStyle} ${fontWeight} ${fontSizePx}px ${fontFamily}`;
            if (symbol) {
                const size = this.getFontAscent(fontSpec, fontSizePx) * SYMBOL_ASCENT_FRACTION;
                markers.push({
                    symbol,
                    cx: inside
                        ? anchor.x - fontSizePx - size / 2
                        : itemLeft - MARKER_PAD - fontSizePx / 2,
                    cy: anchor.baselineY - size,
                    size,
                    strokeWidth: Math.max(1, fontSizePx / 14),
                    fill
                });
                return;
            }
            const x = (inside ? anchor.x : itemLeft)
                - this.measureTextWidth(fontSpec, ' ')
                - this.measureTextWidth(fontSpec, text);
            markers.push({
                text,
                x,
                baselineY: anchor.baselineY,
                fontFamily,
                fontSizePx,
                fontWeight,
                fontStyle,
                fill
            });
        });
        return markers;
    }

    // A bullet marker -> the shape Blink paints for it.
    emitListSymbol(marker) {
        const svgNamespace = "http://www.w3.org/2000/svg";
        if (marker.symbol === 'square') {
            const rect = document.createElementNS(svgNamespace, "rect");
            rect.setAttribute("x", svgRound(marker.cx - marker.size / 2));
            rect.setAttribute("y", svgRound(marker.cy - marker.size / 2));
            rect.setAttribute("width", svgRound(marker.size));
            rect.setAttribute("height", svgRound(marker.size));
            rect.setAttribute("fill", marker.fill);
            return rect;
        }
        const circle = document.createElementNS(svgNamespace, "circle");
        circle.setAttribute("cx", svgRound(marker.cx));
        circle.setAttribute("cy", svgRound(marker.cy));
        circle.setAttribute("r", svgRound(marker.size / 2));
        if (marker.symbol === 'circle') {
            circle.setAttribute("fill", "none");
            circle.setAttribute("stroke", marker.fill);
            circle.setAttribute("stroke-width", svgRound(marker.strokeWidth));
        } else {
            circle.setAttribute("fill", marker.fill);
        }
        return circle;
    }

    // Width of a string in a given CSS font shorthand, via the shared canvas.
    measureTextWidth(fontSpec, text) {
        if (!this._measureCtx) {
            this._measureCtx = document.createElement('canvas').getContext('2d');
        }
        this._measureCtx.font = fontSpec;
        return this._measureCtx.measureText(text).width;
    }

    // One fragment -> one <text>. Colours are emitted verbatim as the
    // rgb()/rgba() literals the computed styles gave us: the exported content
    // must not depend on the stylesheet's classes or CSS variables.
    emitTextFragment(fragment) {
        const svgNamespace = "http://www.w3.org/2000/svg";
        const text = document.createElementNS(svgNamespace, "text");
        text.setAttribute("x", svgRound(fragment.x));
        text.setAttribute("y", svgRound(fragment.baselineY));
        text.setAttribute("font-family", fragment.fontFamily);
        text.setAttribute("font-size", svgRound(fragment.fontSizePx));
        const weight = String(fragment.fontWeight);
        if (weight !== '400' && weight !== 'normal') text.setAttribute("font-weight", weight);
        if (fragment.fontStyle === 'italic' || fragment.fontStyle === 'oblique') {
            text.setAttribute("font-style", fragment.fontStyle);
        }
        text.setAttribute("fill", fragment.fill);
        if (/^\s|\s$/.test(fragment.text)) {
            text.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
        }
        text.appendChild(document.createTextNode(fragment.text));
        return text;
    }

    // Per-element primitives that paint under the text: backgrounds (inline
    // code, table header and row shading), borders (which is what draws an
    // <hr>) and link underlines. Returned ready to append, in box-local
    // coordinates, in paint order.
    extractDecorations(contentDiv, boxClientRect) {
        const svgNamespace = "http://www.w3.org/2000/svg";
        const boxes = [];
        const underlines = [];
        if (!contentDiv) return boxes;
        const isTransparent = (color) => {
            if (!color) return true;
            if (color === 'transparent' || color === 'none') return true;
            const rgba = color.match(/^rgba?\(([^)]+)\)$/);
            if (rgba) {
                const parts = rgba[1].split(',').map(p => parseFloat(p));
                if (parts.length > 3 && parts[3] === 0) return true;
            }
            return false;
        };
        const makeLine = (x1, y1, x2, y2, stroke, strokeWidth) => {
            const line = document.createElementNS(svgNamespace, "line");
            line.setAttribute("x1", svgRound(x1));
            line.setAttribute("y1", svgRound(y1));
            line.setAttribute("x2", svgRound(x2));
            line.setAttribute("y2", svgRound(y2));
            line.setAttribute("stroke", stroke);
            line.setAttribute("stroke-width", svgRound(strokeWidth));
            return line;
        };
        contentDiv.querySelectorAll('*').forEach(el => {
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return;
            const rects = Array.from(el.getClientRects()).filter(r => r.width > 0.5 && r.height > 0.5);
            if (rects.length === 0) return;
            const left = (v) => v - boxClientRect.left;
            const top = (v) => v - boxClientRect.top;

            if (!isTransparent(style.backgroundColor)) {
                // border-radius resolves to px; a percentage has no
                // rect-independent value here, so it is dropped.
                const radius = style.borderTopLeftRadius || '';
                const rx = radius.indexOf('%') === -1 ? (parseFloat(radius) || 0) : 0;
                rects.forEach(r => {
                    const rect = document.createElementNS(svgNamespace, "rect");
                    rect.setAttribute("x", svgRound(left(r.left)));
                    rect.setAttribute("y", svgRound(top(r.top)));
                    rect.setAttribute("width", svgRound(r.width));
                    rect.setAttribute("height", svgRound(r.height));
                    if (rx > 0) rect.setAttribute("rx", svgRound(rx));
                    rect.setAttribute("fill", style.backgroundColor);
                    boxes.push(rect);
                });
            }

            // Borders, one line per painted side. An <hr> is border-top only,
            // so it needs no case of its own.
            [['Top', 'top'], ['Right', 'right'], ['Bottom', 'bottom'], ['Left', 'left']].forEach(([side]) => {
                const width = parseFloat(style['border' + side + 'Width']) || 0;
                const lineStyle = style['border' + side + 'Style'];
                const color = style['border' + side + 'Color'];
                if (width <= 0.25 || lineStyle === 'none' || lineStyle === 'hidden' || isTransparent(color)) return;
                rects.forEach(r => {
                    if (side === 'Top') boxes.push(makeLine(left(r.left), top(r.top + width / 2), left(r.right), top(r.top + width / 2), color, width));
                    else if (side === 'Bottom') boxes.push(makeLine(left(r.left), top(r.bottom - width / 2), left(r.right), top(r.bottom - width / 2), color, width));
                    else if (side === 'Left') boxes.push(makeLine(left(r.left + width / 2), top(r.top), left(r.left + width / 2), top(r.bottom), color, width));
                    else boxes.push(makeLine(left(r.right - width / 2), top(r.top), left(r.right - width / 2), top(r.bottom), color, width));
                });
            });

            if (el.tagName === 'A') {
                // Explicit underline: text-decoration is unreliable outside a
                // browser, so links get a drawn rule.
                rects.forEach(r => underlines.push(makeLine(
                    left(r.left), top(r.bottom - 1), left(r.right), top(r.bottom - 1), style.color, 1)));
            }
        });
        return boxes.concat(underlines);
    }
    
    // Create arrow markers for both directions
    createArrowMarkers(defs, themeKey, mode) {
        const svgNamespace = "http://www.w3.org/2000/svg";
        const theme = COLOR_THEMES[themeKey] || COLOR_THEMES.default;
        
        // Get the CSS variable for this theme and mode
        const strokeVarName = theme[mode].stroke.replace('var(', '').replace(')', '');
        
        // Extract the actual color value from the CSS variable
        const strokeColor = getComputedStyle(document.documentElement)
            .getPropertyValue(strokeVarName)
            .trim();
        
        // End marker
        const arrowEndMarker = document.createElementNS(svgNamespace, "marker");
        arrowEndMarker.setAttribute("id", `arrowhead-end-${themeKey}-${mode}`);
        arrowEndMarker.setAttribute("markerWidth", "10");
        arrowEndMarker.setAttribute("markerHeight", "7");
        arrowEndMarker.setAttribute("refX", "9");
        arrowEndMarker.setAttribute("refY", "3.5");
        arrowEndMarker.setAttribute("orient", "auto");
        
        const arrowEndPolygon = document.createElementNS(svgNamespace, "polygon");
        arrowEndPolygon.setAttribute("points", "0 0, 10 3.5, 0 7");
        arrowEndPolygon.setAttribute("fill", strokeColor);
        arrowEndMarker.appendChild(arrowEndPolygon);
        defs.appendChild(arrowEndMarker);
        
        // Start marker
        const arrowStartMarker = document.createElementNS(svgNamespace, "marker");
        arrowStartMarker.setAttribute("id", `arrowhead-start-${themeKey}-${mode}`);
        arrowStartMarker.setAttribute("markerWidth", "10");
        arrowStartMarker.setAttribute("markerHeight", "7");
        arrowStartMarker.setAttribute("refX", "1");
        arrowStartMarker.setAttribute("refY", "3.5");
        arrowStartMarker.setAttribute("orient", "auto");
        
        const arrowStartPolygon = document.createElementNS(svgNamespace, "polygon");
        arrowStartPolygon.setAttribute("points", "10 0, 0 3.5, 10 7");
        arrowStartPolygon.setAttribute("fill", strokeColor);
        arrowStartMarker.appendChild(arrowStartPolygon);
        defs.appendChild(arrowStartMarker);
    }
    
    // Add the project title to the SVG
    addProjectTitle(svg, svgNamespace, x, y, width) {
        const titleGroup = document.createElementNS(svgNamespace, "g");
        titleGroup.setAttribute("class", "project-title");
        
        // Get current project title
        const projectTitle = document.getElementById('project-title').textContent;
        
        // Create text element
        const titleText = document.createElementNS(svgNamespace, "text");
        titleText.setAttribute("x", x + width / 2);
        titleText.setAttribute("y", y + 40); // Position from top
        titleText.setAttribute("text-anchor", "middle");
        titleText.setAttribute("font-size", "24px");
        titleText.setAttribute("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif");
        titleText.setAttribute("font-weight", "300");
        titleText.setAttribute("letter-spacing", "0.05em");
        titleText.setAttribute("class", "title-text");
        titleText.textContent = projectTitle;
        
        titleGroup.appendChild(titleText);
        svg.appendChild(titleGroup);
    }
    
    // Get project name for the filename
    getProjectName() {
        // Try to get project name from the title element
        const projectTitle = document.getElementById('project-title').textContent;
        if (projectTitle && projectTitle !== 'New Project') {
            return projectTitle.replace(/[^\w\-\s]/g, '').replace(/\s+/g, '-').toLowerCase();
        }
        return null;
    }
    
    // Extract all CSS variables and theme classes from the document
    extractThemeStyles() {
        // Get the font scale
        const fontScale = getComputedStyle(document.documentElement)
            .getPropertyValue('--font-scale')
            .trim();
            
        // First, extract all the CSS variables
        let cssVars = '';
        const vars = [
            // Base colors - Light Mode
            '--gray-50', '--gray-100', '--gray-200', '--gray-300', '--gray-400', '--gray-500',
            '--gray-600', '--gray-700', '--gray-800', '--gray-900',
            '--red-50', '--red-100', '--red-200', '--red-300', '--red-400', '--red-500',
            '--red-600', '--red-700', '--red-800', '--red-900', '--red-950',
            '--green-50', '--green-100', '--green-200', '--green-300', '--green-400', '--green-500',
            '--green-600', '--green-700', '--green-800', '--green-900', '--green-950',
            '--blue-50', '--blue-100', '--blue-200', '--blue-300', '--blue-400', '--blue-500',
            '--blue-600', '--blue-700', '--blue-800', '--blue-900', '--blue-950',
            '--purple-50', '--purple-100', '--purple-200', '--purple-300', '--purple-400', '--purple-500',
            '--purple-600', '--purple-700', '--purple-800', '--purple-900', '--purple-950',
            '--yellow-50', '--yellow-100', '--yellow-200', '--yellow-300', '--yellow-400', '--yellow-500',
            '--yellow-600', '--yellow-700', '--yellow-800', '--yellow-900', '--yellow-950',
            '--amber-50', '--amber-100', '--amber-200', '--amber-300', '--amber-400', '--amber-500',
            '--amber-600', '--amber-700', '--amber-800', '--amber-900', '--amber-950',
            '--black', '--white', '--link-color',
            
            // Theme variables - Light mode
            '--bg-primary', '--bg-secondary', '--text-primary', '--text-secondary', '--text-muted',
            '--border-color', '--shadow-color',
            
            // Theme colors - Light mode
            '--theme-default-bg', '--theme-default-text', '--theme-default-border', '--theme-default-stroke',
            '--theme-red-bg', '--theme-red-text', '--theme-red-border', '--theme-red-stroke',
            '--theme-green-bg', '--theme-green-text', '--theme-green-border', '--theme-green-stroke',
            '--theme-blue-bg', '--theme-blue-text', '--theme-blue-border', '--theme-blue-stroke',
            '--theme-purple-bg', '--theme-purple-text', '--theme-purple-border', '--theme-purple-stroke',
            '--theme-yellow-bg', '--theme-yellow-text', '--theme-yellow-border', '--theme-yellow-stroke',
            '--theme-grey-bg', '--theme-grey-text', '--theme-grey-border', '--theme-grey-stroke'
        ];
        
        // Extract all variables
        vars.forEach(varName => {
            const value = getComputedStyle(document.documentElement)
                .getPropertyValue(varName)
                .trim();
            cssVars += `${varName}: ${value};\n`;
        });
        
        // Now create rules to define base styling
        return `
            /* SVG Root with CSS Variables */
            :root {
                ${cssVars}
            }
            
            /* SVG root should also have background in dark mode */
            svg.dark-mode {
                background-color: var(--bg-primary);
            }
            
            /* Dark Mode Variables */
            .dark-mode {
                --bg-primary: var(--gray-800);
                --bg-secondary: var(--gray-700);
                --text-primary: var(--gray-50);
                --text-secondary: var(--gray-300);
                --text-muted: var(--gray-400);
                --border-color: var(--gray-600);
                --shadow-color: rgba(0, 0, 0, 0.3);
                
                /* Theme Colors - Dark Mode */
                --theme-default-bg: var(--gray-700);
                --theme-default-text: var(--gray-50);
                --theme-default-border: var(--gray-500);
                --theme-default-stroke: var(--gray-400);
                
                --theme-red-bg: var(--red-900);
                --theme-red-text: var(--red-200);
                --theme-red-border: var(--red-600);
                --theme-red-stroke: var(--red-500);
                
                --theme-green-bg: var(--green-900);
                --theme-green-text: var(--green-200);
                --theme-green-border: var(--green-600);
                --theme-green-stroke: var(--green-500);
                
                --theme-blue-bg: var(--blue-900);
                --theme-blue-text: var(--blue-200);
                --theme-blue-border: var(--blue-600);
                --theme-blue-stroke: var(--blue-500);
                
                --theme-purple-bg: var(--purple-800);
                --theme-purple-text: var(--purple-200);
                --theme-purple-border: var(--purple-600);
                --theme-purple-stroke: var(--purple-500);
                
                --theme-yellow-bg: var(--yellow-900);
                --theme-yellow-text: var(--yellow-200);
                --theme-yellow-border: var(--amber-600);
                --theme-yellow-stroke: var(--amber-500);
                
                --theme-grey-bg: var(--gray-800);
                --theme-grey-text: var(--gray-200);
                --theme-grey-border: var(--gray-500);
                --theme-grey-stroke: var(--gray-400);
            }
            
            /* Markdown content styling */
            .markdown-content { 
                font-size: ${fontScale * 14}px; 
                line-height: 1.5; 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .markdown-content h1 { 
                font-size: 1.5em; 
                font-weight: bold; 
                margin: 0.5em 0 0.3em; 
            }
            .markdown-content h2 { 
                font-size: 1.3em; 
                font-weight: bold; 
                margin: 0.4em 0 0.2em; 
            }
            .markdown-content h3 { 
                font-size: 1.1em; 
                font-weight: bold; 
                margin: 0.3em 0 0.1em; 
            }
            .markdown-content p { margin-bottom: 0.5em; }
            .markdown-content ul, .markdown-content ol { 
                padding-left: 1.5em; 
                margin-bottom: 0.5em; 
            }
            .markdown-content li { margin-bottom: 0.2em; }
            .markdown-content li > ul, .markdown-content li > ol { margin-top: 0.2em; }
            .markdown-content code { 
                background-color: rgba(0, 0, 0, 0.05); 
                padding: 0.1em 0.2em; 
                border-radius: 0.2em; 
                font-family: monospace; 
                font-size: 0.9em;
            }
            .markdown-content hr { margin: 0.5em 0; border: none; border-top: 1px solid var(--border-color); }
            .markdown-content a { color: var(--link-color); text-decoration: underline; }
            /* no rule for data-align="left": explicit text-align on the container
               flips Chrome's UA th centering (-internal-center); default start == today */
            .markdown-content[data-align="justify"] { text-align: justify; }
            .markdown-content[data-align="center"] { text-align: center; }
            .markdown-content[data-align="right"] { text-align: right; }
            .markdown-content[data-align="center"] ul, .markdown-content[data-align="center"] ol,
            .markdown-content[data-align="right"] ul, .markdown-content[data-align="right"] ol {
                list-style-position: inside;
                padding-left: 0;
            }
            
            /* Table styling */
            .markdown-content table { 
                border-collapse: collapse; 
                width: 100%; 
                margin-bottom: 0.8em; 
                font-size: 0.9em; 
            }
            .markdown-content table td { 
                border: 1px solid var(--border-color); 
                padding: 0.4em 0.7em; 
            }
            .markdown-content table th { 
                border: 1px solid var(--border-color); 
                padding: 0.5em 0.7em; 
                text-align: left; 
                font-weight: bold; 
            }
            
            /* Connection path styling */
            .connection-path {
                fill: none;
                pointer-events: none;
            }
            
            /* Pattern styles */
            .pattern-normal { stroke-dasharray: none; }
            .pattern-dashed { stroke-dasharray: 10, 5; }
            .pattern-dotted { stroke-dasharray: 2, 4; }
            
            /* Thickness styles */
            .thickness-thin { stroke-width: 1; }
            .thickness-normal { stroke-width: 2; }
            .thickness-bold { stroke-width: 4; }
            
            /* Box styling */
            .box rect, .box ellipse, .box polygon, .box path {
                stroke-width: 1.5;
            }
            
            /* Theme-specific classes - Light Mode */
            .light-default-bg { background-color: var(--theme-default-bg); fill: var(--theme-default-bg); }
            .light-default-text { color: var(--theme-default-text); }
            .light-default-border { border-color: var(--theme-default-border); stroke: var(--theme-default-border); }
            .theme-default .connection-path { stroke: var(--theme-default-stroke); }
            
            .light-red-bg { background-color: var(--theme-red-bg); fill: var(--theme-red-bg); }
            .light-red-text { color: var(--theme-red-text); }
            .light-red-border { border-color: var(--theme-red-border); stroke: var(--theme-red-border); }
            .theme-red .connection-path { stroke: var(--theme-red-stroke); }
            
            .light-green-bg { background-color: var(--theme-green-bg); fill: var(--theme-green-bg); }
            .light-green-text { color: var(--theme-green-text); }
            .light-green-border { border-color: var(--theme-green-border); stroke: var(--theme-green-border); }
            .theme-green .connection-path { stroke: var(--theme-green-stroke); }
            
            .light-blue-bg { background-color: var(--theme-blue-bg); fill: var(--theme-blue-bg); }
            .light-blue-text { color: var(--theme-blue-text); }
            .light-blue-border { border-color: var(--theme-blue-border); stroke: var(--theme-blue-border); }
            .theme-blue .connection-path { stroke: var(--theme-blue-stroke); }
            
            .light-purple-bg { background-color: var(--theme-purple-bg); fill: var(--theme-purple-bg); }
            .light-purple-text { color: var(--theme-purple-text); }
            .light-purple-border { border-color: var(--theme-purple-border); stroke: var(--theme-purple-border); }
            .theme-purple .connection-path { stroke: var(--theme-purple-stroke); }
            
            .light-yellow-bg { background-color: var(--theme-yellow-bg); fill: var(--theme-yellow-bg); }
            .light-yellow-text { color: var(--theme-yellow-text); }
            .light-yellow-border { border-color: var(--theme-yellow-border); stroke: var(--theme-yellow-border); }
            .theme-yellow .connection-path { stroke: var(--theme-yellow-stroke); }
            
            .light-grey-bg { background-color: var(--theme-grey-bg); fill: var(--theme-grey-bg); }
            .light-grey-text { color: var(--theme-grey-text); }
            .light-grey-border { border-color: var(--theme-grey-border); stroke: var(--theme-grey-border); }
            .theme-grey .connection-path { stroke: var(--theme-grey-stroke); }
            
            /* Theme-specific classes - Dark Mode (these will only apply when .dark-mode is present) */
            .dark-mode .dark-default-bg { background-color: var(--theme-default-bg); fill: var(--theme-default-bg); }
            .dark-mode .dark-default-text { color: var(--theme-default-text); }
            .dark-mode .dark-default-border { border-color: var(--theme-default-border); stroke: var(--theme-default-border); }
            .dark-mode .theme-default .connection-path { stroke: var(--theme-default-stroke); }
            
            .dark-mode .dark-red-bg { background-color: var(--theme-red-bg); fill: var(--theme-red-bg); }
            .dark-mode .dark-red-text { color: var(--theme-red-text); }
            .dark-mode .dark-red-border { border-color: var(--theme-red-border); stroke: var(--theme-red-border); }
            .dark-mode .theme-red .connection-path { stroke: var(--theme-red-stroke); }
            
            .dark-mode .dark-green-bg { background-color: var(--theme-green-bg); fill: var(--theme-green-bg); }
            .dark-mode .dark-green-text { color: var(--theme-green-text); }
            .dark-mode .dark-green-border { border-color: var(--theme-green-border); stroke: var(--theme-green-border); }
            .dark-mode .theme-green .connection-path { stroke: var(--theme-green-stroke); }
            
            .dark-mode .dark-blue-bg { background-color: var(--theme-blue-bg); fill: var(--theme-blue-bg); }
            .dark-mode .dark-blue-text { color: var(--theme-blue-text); }
            .dark-mode .dark-blue-border { border-color: var(--theme-blue-border); stroke: var(--theme-blue-border); }
            .dark-mode .theme-blue .connection-path { stroke: var(--theme-blue-stroke); }
            
            .dark-mode .dark-purple-bg { background-color: var(--theme-purple-bg); fill: var(--theme-purple-bg); }
            .dark-mode .dark-purple-text { color: var(--theme-purple-text); }
            .dark-mode .dark-purple-border { border-color: var(--theme-purple-border); stroke: var(--theme-purple-border); }
            .dark-mode .theme-purple .connection-path { stroke: var(--theme-purple-stroke); }
            
            .dark-mode .dark-yellow-bg { background-color: var(--theme-yellow-bg); fill: var(--theme-yellow-bg); }
            .dark-mode .dark-yellow-text { color: var(--theme-yellow-text); }
            .dark-mode .dark-yellow-border { border-color: var(--theme-yellow-border); stroke: var(--theme-yellow-border); }
            .dark-mode .theme-yellow .connection-path { stroke: var(--theme-yellow-stroke); }
            
            .dark-mode .dark-grey-bg { background-color: var(--theme-grey-bg); fill: var(--theme-grey-bg); }
            .dark-mode .dark-grey-text { color: var(--theme-grey-text); }
            .dark-mode .dark-grey-border { border-color: var(--theme-grey-border); stroke: var(--theme-grey-border); }
            .dark-mode .theme-grey .connection-path { stroke: var(--theme-grey-stroke); }
            
            /* Project title styling */
            .title-text {
                fill: var(--text-muted);
                color: var(--text-muted);
            }
        `;
    }
}
