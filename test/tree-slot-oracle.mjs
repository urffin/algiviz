/** Independent painted-command oracle. No layout/planner code is imported. */
export function slotBoundsIssues({ squares, circles, boxes }, size) {
    const issues = [], tolerance = 1e-8;
    const painted = squares.map(s => ({ left: s.x - s.lineWidth / 2, top: s.y - s.lineWidth / 2,
        right: s.x + s.width + s.lineWidth / 2, bottom: s.y + s.height + s.lineWidth / 2 }));
    const gap = (a, b) => Math.hypot(Math.max(a.left - b.right, b.left - a.right, 0), Math.max(a.top - b.bottom, b.top - a.bottom, 0));
    for (const [index, square] of painted.entries()) {
        const margin = Math.min(square.left, square.top, size.width - square.right, size.height - square.bottom);
        if (margin < 4 - tolerance) issues.push({ kind: 'viewport', index, margin });
        for (const circle of circles) {
            const distance = Math.hypot(Math.max(square.left - circle.x, circle.x - square.right, 0),
                Math.max(square.top - circle.y, circle.y - square.bottom, 0)) - circle.radius;
            if (distance < 2 - tolerance) issues.push({ kind: 'node', index, gap: distance });
        }
        for (const b of boxes) {
            const distance = gap(square, { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height });
            if (distance < 2 - tolerance) issues.push({ kind: 'caption', index, gap: distance });
        }
        for (let other = 0; other < index; other++) {
            const distance = gap(square, painted[other]);
            if (distance < 2 - tolerance) issues.push({ kind: 'slot', index, other, gap: distance });
        }
    }
    return issues;
}
