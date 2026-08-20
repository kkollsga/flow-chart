// Helper to safely remove CSS classes
function safeRemoveClass(element, className) {
    if (element && className && className.trim() !== '') {
        element.classList.remove(className);
    }
}

// Rounded-corner polygon: trims each corner by up to `radius` along both
// edges and bridges with a quadratic curve. Returns the SVG/CSS path string
// and sampled outline points (corner start / curve midpoint / corner end) for
// connection-endpoint intersection. Collinear vertices (used to give the
// triangle a fourth vertex so its clip-path morphs against the diamond's)
// degrade to straight pass-throughs. Shared by the box clip-path, the
// connection outline, and the SVG export.
function roundedPolygonPath(vertices, radius) {
    const n = vertices.length;
    const fmt = (pt) => `${Math.round(pt.x * 100) / 100} ${Math.round(pt.y * 100) / 100}`;
    let d = '';
    const points = [];
    for (let i = 0; i < n; i++) {
        const prev = vertices[(i + n - 1) % n];
        const v = vertices[i];
        const next = vertices[(i + 1) % n];
        const l1 = Math.hypot(prev.x - v.x, prev.y - v.y) || 1;
        const l2 = Math.hypot(next.x - v.x, next.y - v.y) || 1;
        // Angle-compensated trim: a fixed trim makes sharp corners LOOK less
        // rounded than wide ones (perceived radius ~ trim*tan(theta/2)), which
        // left the triangle's base corners crisp next to its softer apex.
        // trim = radius/tan(theta/2) gives every corner the same true radius;
        // collinear helper vertices (tan -> inf) get trim 0 and stay invisible.
        const u1x = (prev.x - v.x) / l1, u1y = (prev.y - v.y) / l1;
        const u2x = (next.x - v.x) / l2, u2y = (next.y - v.y) / l2;
        const halfAngle = Math.acos(Math.min(1, Math.max(-1, u1x * u2x + u1y * u2y))) / 2;
        const tanHalf = Math.tan(halfAngle);
        const t = tanHalf > 0.001 ? Math.min(radius / tanHalf, l1 / 2, l2 / 2) : 0;
        const p1 = { x: v.x + (prev.x - v.x) / l1 * t, y: v.y + (prev.y - v.y) / l1 * t };
        const p2 = { x: v.x + (next.x - v.x) / l2 * t, y: v.y + (next.y - v.y) / l2 * t };
        d += (i === 0 ? `M ${fmt(p1)}` : ` L ${fmt(p1)}`) + ` Q ${fmt(v)} ${fmt(p2)}`;
        // quadratic midpoint = 0.25*p1 + 0.5*v + 0.25*p2
        points.push(p1, { x: (p1.x + 2 * v.x + p2.x) / 4, y: (p1.y + 2 * v.y + p2.y) / 4 }, p2);
    }
    return { d: d + ' Z', points };
}

// Canonical vertex sets for the polygon shapes, in a WxH box at (0,0) or at
// canvas bounds. The triangle carries a collinear bottom-mid vertex so both
// shapes are 4-vertex paths with identical command structure (morphable).
function polygonShapeVertices(shape, left, top, width, height) {
    const cx = left + width / 2, cy = top + height / 2;
    if (shape === 'diamond') {
        return [{ x: cx, y: top }, { x: left + width, y: cy }, { x: cx, y: top + height }, { x: left, y: cy }];
    }
    return [{ x: cx, y: top }, { x: left + width, y: top + height },
            { x: cx, y: top + height }, { x: left, y: top + height }];
}

// True corner radius (see angle compensation above). 10 keeps the triangle
// apex looking as it did under the old fixed-trim scheme.
const POLYGON_CORNER_RADIUS = 10;
