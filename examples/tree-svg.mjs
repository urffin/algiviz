import { createSceneRenderer } from '@grundyjs/algiviz/scene';

const namespace = 'http://www.w3.org/2000/svg';
function point(object) {
    if (!object) return null;
    const from = (object.previous ?? object.current).data;
    const to = (object.current ?? object.previous).data;
    if (!('x' in from) || !('x' in to)) return null;
    return { x: (from.x + (to.x - from.x) * object.progress) * 960,
        y: (from.y + (to.y - from.y) * object.progress) * 500 };
}
function attributes(element, values) {
    for (const [key, value] of Object.entries(values)) element.setAttribute(key, String(value));
}

// This retained DOM renderer belongs to the example, not the library.
export function createTreeSvgRenderer(svg) {
    const layer = svg.ownerDocument.createElementNS(namespace, 'g');
    svg.appendChild(layer);
    const elements = new Map();
    let seen = new Set();
    function element(object, tag) {
        seen.add(object.id);
        let entry = elements.get(object.id);
        if (entry && entry.tagName !== tag) { entry.remove(); entry = null; }
        if (!entry) {
            entry = svg.ownerDocument.createElementNS(namespace, tag);
            entry.setAttribute('data-object-id', object.id);
            elements.set(object.id, entry);
        }
        // Moving existing nodes preserves identity and applies the scene's layer order.
        layer.appendChild(entry);
        attributes(entry, { opacity: object.presence });
        return entry;
    }
    const renderer = createSceneRenderer({
        edge(_, object, scene) {
            const data = (object.current ?? object.previous).data;
            const a = scene.get(data.from), b = scene.get(data.to);
            const from = point(a), to = point(b);
            if (!from || !to || Math.min(object.presence, a.presence, b.presence) <= 0) return;
            attributes(element(object, 'line'), { x1: from.x, y1: from.y, x2: to.x, y2: to.y,
                stroke: '#64748b', 'stroke-width': 3, opacity: Math.min(object.presence, a.presence, b.presence) });
        },
        node(_, object) {
            if (object.presence <= 0) return;
            const p = point(object), data = (object.current ?? object.previous).data;
            const group = element(object, 'g');
            if (!group.firstChild) {
                group.appendChild(svg.ownerDocument.createElementNS(namespace, 'circle'));
                group.appendChild(svg.ownerDocument.createElementNS(namespace, 'text'));
            }
            attributes(group, { transform: `translate(${p.x} ${p.y})` });
            attributes(group.children[0], { r: 24, fill: data.active ? '#fbbf24' : '#34d399' });
            attributes(group.children[1], { fill: '#101827', 'font-size': 20, 'font-weight': 'bold',
                'font-family': 'sans-serif', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
            group.children[1].textContent = data.label;
        },
        pointer(_, object, scene) {
            if (object.presence <= 0) return;
            const from = point(scene.get((object.previous ?? object.current).data.target));
            const to = point(scene.get((object.current ?? object.previous).data.target));
            if (!from || !to) return;
            const x = from.x + (to.x - from.x) * object.progress;
            const y = from.y + (to.y - from.y) * object.progress - 36;
            attributes(element(object, 'path'), { d: 'M0 0 L-9 -15 L9 -15 Z', fill: '#c4b5fd', transform: `translate(${x} ${y})` });
        }
    });
    return {
        render(frame) {
            seen = new Set();
            renderer.render(null, frame);
            // Reconcile every frame: seeking may skip an object's exit transition.
            for (const [id, node] of elements) if (!seen.has(id)) { node.remove(); elements.delete(id); }
        },
        dispose() { layer.remove(); elements.clear(); }
    };
}
