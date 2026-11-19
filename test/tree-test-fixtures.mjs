export const input = (kind = 'binary') => ({ kind, rootId: 'A',
    nodes: [{ id: 'A' }, { id: 'B', label: '' }, { id: 'C' }, { id: 'D' }],
    links: [
        { id: 'A', parentId: 'A', childId: 'B', ...(kind === 'binary' ? { slot: 'left' } : {}) },
        { id: 'right', parentId: 'A', childId: 'C', ...(kind === 'binary' ? { slot: 'right' } : {}) },
        { id: 'child', parentId: 'B', childId: 'D', ...(kind === 'binary' ? { slot: 'right' } : {}) },
    ] });
export const layout = () => [{ nodeId: 'A', x: 0, y: 0 }, { nodeId: 'B', x: -1, y: 1 },
    { nodeId: 'C', x: 1, y: 1 }, { nodeId: 'D', x: 0, y: 2 }];
export const rotation = (kind = 'binary') => ({ rootId: 'C', links: [
    { id: 'A', parentId: 'A', childId: 'B', ...(kind === 'binary' ? { slot: 'left' } : {}) },
    { id: 'right', parentId: 'C', childId: 'A', ...(kind === 'binary' ? { slot: 'left' } : {}) },
    { id: 'child', parentId: 'B', childId: 'D', ...(kind === 'binary' ? { slot: 'right' } : {}) },
], layout: layout().map(p => ({ ...p, y: p.nodeId === 'C' ? 0 : p.y + 1 })) });
export const errorIs = Type => error => error?.constructor === Type;
export function accessor(key, base = {}) {
    return Object.defineProperty(base, key, { enumerable: true, get() { throw new Error('Getter invoked: ' + key); } });
}
export const endpoint = (state, previous = state, progress = 1) => ({ previous, current: state, progress, stepIndex: 0, event: undefined });
export function owned(value) {
    if (!value || typeof value !== 'object') return;
    if (!Object.isFrozen(value)) throw new Error('Unfrozen structural output');
    for (const key of Object.keys(value)) if (key !== 'data') owned(value[key]);
}
