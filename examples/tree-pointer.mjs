// Follow the tree's edges through ancestors, at constant speed along the route.
export function treePointerPosition(object, scene, width, height) {
    const from = (object.previous ?? object.current).data.target;
    const to = (object.current ?? object.previous).data.target;
    const neighbors = new Map();
    for (const transition of scene.objects) {
        const edge = transition.current ?? transition.previous;
        if (edge.type !== 'edge') continue;
        const { from: a, to: b } = edge.data;
        if (!neighbors.has(a)) neighbors.set(a, []);
        if (!neighbors.has(b)) neighbors.set(b, []);
        neighbors.get(a).push(b); neighbors.get(b).push(a);
    }
    const parent = new Map([[from, null]]), queue = [from];
    for (let i = 0; i < queue.length && !parent.has(to); i++) {
        for (const next of neighbors.get(queue[i]) ?? []) if (!parent.has(next)) {
            parent.set(next, queue[i]); queue.push(next);
        }
    }
    if (!parent.has(to)) return null;
    const route = [];
    for (let id = to; id !== null; id = parent.get(id)) {
        const node = scene.get(id);
        if (!node) return null;
        const a = (node.previous ?? node.current).data, b = (node.current ?? node.previous).data;
        route.unshift({ x: (a.x + (b.x - a.x) * object.progress) * width,
            y: (a.y + (b.y - a.y) * object.progress) * height - 36 });
    }
    const lengths = route.slice(1).map((p, i) => Math.hypot(p.x - route[i].x, p.y - route[i].y));
    let distance = lengths.reduce((a, b) => a + b, 0) * object.progress;
    for (let i = 0; i < lengths.length; i++) {
        if (distance <= lengths[i] && lengths[i] > 0) {
            const t = distance / lengths[i];
            return { x: route[i].x + (route[i + 1].x - route[i].x) * t,
                y: route[i].y + (route[i + 1].y - route[i].y) * t };
        }
        distance -= lengths[i];
    }
    return route.at(-1);
}
