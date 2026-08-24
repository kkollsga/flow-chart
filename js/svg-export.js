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
        
        // Colours are baked as literal presentation attributes below, so the
        // root carries no theme class - only the dark-mode background rect.
        if (isDarkMode) {
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
        
        // No <style> element is emitted: PowerPoint neither resolves var() nor
        // applies CSS classes reliably, so every colour below is a literal
        // presentation attribute instead.
        
        // No <defs>/<marker> either: PowerPoint does not paint marker-end, so
        // each arrowhead is emitted below as an explicit <polygon> in place.
        
        // Add project title at the top
        this.addProjectTitle(svg, svgNamespace, minX, minY, width);
        
        // Create a group for connections
        const connectionsGroup = document.createElementNS(svgNamespace, "g");
        
        // Add all connections. Stroke colour, width and dash pattern are read
        // off the live path - the app applies them through a theme attribute
        // and pattern/thickness classes, none of which survive export - so the
        // exported line is styled with exactly what the screen is showing.
        // Reading the live element is also what makes dark mode correct: the
        // theme stroke var only resolves against body, which carries
        // .dark-mode, so the old documentElement lookup always yielded the
        // light-mode colour.
        connections.forEach(connection => {
            const d = connection.element.getAttribute("d");
            const ends = this.parseLineEndpoints(d);
            if (!ends) return;
            
            const live = getComputedStyle(connection.element);
            const strokeColor = live.stroke;
            const strokeWidth = parseFloat(live.strokeWidth) || 2;
            const dashArray = this.normalizeDashArray(live.strokeDasharray);
            
            const path = document.createElementNS(svgNamespace, "path");
            path.setAttribute("d", d);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", strokeColor);
            path.setAttribute("stroke-width", strokeWidth);
            if (dashArray) path.setAttribute("stroke-dasharray", dashArray);
            connectionsGroup.appendChild(path);
            
            // The end arrowhead is always drawn; the start one only when the
            // connection is bidirectional - same rule the live markers follow.
            const endHead = this.buildArrowhead(svgNamespace, ends.end, ends.start, strokeWidth, strokeColor);
            if (endHead) connectionsGroup.appendChild(endHead);
            if (connection.data.bidirectional) {
                const startHead = this.buildArrowhead(svgNamespace, ends.start, ends.end, strokeWidth, strokeColor);
                if (startHead) connectionsGroup.appendChild(startHead);
            }
        });
        
        svg.appendChild(connectionsGroup);
        
        // Create a group for boxes
        const boxesGroup = document.createElementNS(svgNamespace, "g");
        
        // Add all boxes
        boxes.forEach(box => {
            const bounds = box.getBounds();
            
            // Create a group for this box
            const boxGroup = document.createElementNS(svgNamespace, "g");
            boxGroup.setAttribute("transform", `translate(${bounds.left}, ${bounds.top})`);
            
            // Create the box's shape element (literal fill/stroke applied below)
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
            
            // Bake the colours the live box is actually painted with, so the
            // export matches the screen for whichever mode/theme is current.
            const shapeColors = this.getShapeColors(box.element, shape);
            shapeEl.setAttribute("fill", shapeColors.fill);
            shapeEl.setAttribute("stroke", shapeColors.stroke);
            shapeEl.setAttribute("stroke-width", "1.5");
            
            boxGroup.appendChild(shapeEl);
            
            // Emit the box content as native SVG primitives. A <foreignObject>
            // renders blank in PowerPoint (and in most non-browser SVG
            // consumers), so the text is re-created as <text> runs whose
            // geometry is read back from the live DOM - the browser has
            // already applied wrapping, alignment, shape insets and font
            // scaling, so nothing here re-derives layout.
            const boxClientRect = box.element.getBoundingClientRect();
            const contentGroup = document.createElementNS(svgNamespace, "g");
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
        
        return svgString;
    }

    exportSVGFile() {
        const svgString = this.exportSVG();

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

    // Copy the SVG to the clipboard for direct pasting (e.g. into PowerPoint).
    // Writes image/svg+xml when the browser supports it (Chromium 124+) plus a
    // text/plain fallback carrying the markup; on older browsers, plain text
    // alone. Returns a promise resolving true on success.
    async copySVGToClipboard() {
        const svgString = this.exportSVG();
        const items = { 'text/plain': new Blob([svgString], { type: 'text/plain' }) };
        if (typeof ClipboardItem !== 'undefined' &&
            typeof ClipboardItem.supports === 'function' &&
            ClipboardItem.supports('image/svg+xml')) {
            items['image/svg+xml'] = new Blob([svgString], { type: 'image/svg+xml' });
        }
        try {
            await navigator.clipboard.write([new ClipboardItem(items)]);
            return true;
        } catch (e) {
            console.error('Copy SVG failed:', e);
            // Last resort: plain-text write API
            try { await navigator.clipboard.writeText(svgString); return true; }
            catch (e2) { console.error('Copy SVG text fallback failed:', e2); return false; }
        }
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
    
    // The fill/stroke a box is currently painted with, read off the live
    // element. Diamond and triangle draw their silhouette with two stacked
    // pseudo-elements (::before is the border layer, ::after the inset fill)
    // because a CSS border cannot follow a clip-path, so the div itself is
    // transparent for those two shapes and the colours have to come from the
    // pseudo-elements instead.
    getShapeColors(element, shape) {
        if (shape === 'diamond' || shape === 'triangle') {
            return {
                fill: getComputedStyle(element, '::after').backgroundColor,
                stroke: getComputedStyle(element, '::before').backgroundColor
            };
        }
        const style = getComputedStyle(element);
        return { fill: style.backgroundColor, stroke: style.borderTopColor };
    }
    
    // Connection paths are always "M sx sy L ex ey" (Connection.update builds
    // them); anything else is left alone rather than guessed at.
    parseLineEndpoints(d) {
        if (!d) return null;
        const m = /^\s*M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*L\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*$/.exec(d);
        if (!m) return null;
        const n = m.slice(1).map(Number);
        if (n.some(v => !isFinite(v))) return null;
        return { start: { x: n[0], y: n[1] }, end: { x: n[2], y: n[3] } };
    }
    
    // getComputedStyle reports the dash pattern in CSS px ("10px, 5px"); the
    // SVG attribute wants bare user units, and "none" means no attribute.
    normalizeDashArray(value) {
        if (!value || value === 'none') return null;
        const nums = value.match(/-?[\d.]+/g);
        if (!nums || nums.length === 0) return null;
        return nums.join(', ');
    }
    
    // One arrowhead as an explicit polygon, reproducing what the live
    // <marker> draws. The app's end marker is markerWidth=10 markerHeight=7
    // refX=9 refY=3.5 orient=auto with polygon "0 0, 10 3.5, 0 7"; markerUnits
    // defaults to strokeWidth, so one marker unit == one stroke-width in user
    // space and refX=9 puts the marker origin 9 units behind the vertex. That
    // maps the three polygon points to: tip at vertex + 1*sw along the
    // direction, and a base 9*sw behind it, 3.5*sw either side. The start
    // marker (refX=1, polygon "10 0, 0 3.5, 10 7") is the same triangle
    // mirrored, which is what passing the endpoints the other way round gives.
    buildArrowhead(svgNamespace, vertex, from, strokeWidth, fill) {
        const dx = vertex.x - from.x;
        const dy = vertex.y - from.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (!isFinite(len) || len < 0.001) return null;
        const ux = dx / len, uy = dy / len;   // along the path, towards the vertex
        const nx = -uy, ny = ux;               // perpendicular
        const sw = strokeWidth;
        const tipX = vertex.x + ux * sw, tipY = vertex.y + uy * sw;
        const baseX = vertex.x - ux * 9 * sw, baseY = vertex.y - uy * 9 * sw;
        const half = 3.5 * sw;
        const points = [
            [tipX, tipY],
            [baseX + nx * half, baseY + ny * half],
            [baseX - nx * half, baseY - ny * half]
        ].map(([x, y]) => `${svgRound(x)},${svgRound(y)}`).join(' ');
        
        const polygon = document.createElementNS(svgNamespace, "polygon");
        polygon.setAttribute("points", points);
        polygon.setAttribute("fill", fill);
        return polygon;
    }
    
    // Add the project title to the SVG
    addProjectTitle(svg, svgNamespace, x, y, width) {
        const titleGroup = document.createElementNS(svgNamespace, "g");
        
        // Get current project title
        const titleEl = document.getElementById('project-title');
        const projectTitle = titleEl.textContent;
        
        // Create text element
        const titleText = document.createElementNS(svgNamespace, "text");
        titleText.setAttribute("x", x + width / 2);
        titleText.setAttribute("y", y + 40); // Position from top
        titleText.setAttribute("text-anchor", "middle");
        titleText.setAttribute("font-size", "24px");
        titleText.setAttribute("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif");
        titleText.setAttribute("font-weight", "300");
        titleText.setAttribute("letter-spacing", "0.05em");
        titleText.setAttribute("fill", getComputedStyle(titleEl).color);
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
}
