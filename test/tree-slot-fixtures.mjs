import { createTreeTrace } from '@grundyjs/algiviz/tree';

/** Public-API witnesses: nominal bounds passed before T1, painted bounds did not. */
export function slotBoundsFixture(name) {
    if (name === 'viewport' || name === 'viewport-safe') {
        const state = createTreeTrace({ kind: 'binary', rootId: 'R', nodes: [{ id: 'R', label: '' }], links: [] },
            { layout: [{ nodeId: 'R', x: 0, y: 0 }] }).state;
        return { state, size: { width: 160, height: name === 'viewport' ? 21 : 24 },
            options: { theme: 'light', horizontalGap: 4, emptySlots: 'visible' } };
    }
    const parameters = {
        node: { x: 1.025, y: 1, horizontalGap: .6, levelGap: 1 },
        caption: { x: 1.807, y: .527, horizontalGap: 1.486, levelGap: .913 },
        slot: { x: -.15, y: .17, horizontalGap: 1.06, levelGap: 1.94 }
    }[name];
    if (!parameters) throw new Error('Unknown slot fixture: ' + name);
    const { x, y, horizontalGap, levelGap } = parameters;
    const state = createTreeTrace({ kind: 'binary', rootId: 'P', nodes: ['P', 'S', 'A'].map(id => ({ id, label: '' })),
        links: [{ id: 'l', parentId: 'P', childId: 'S', slot: 'left' }, { id: 'r', parentId: 'P', childId: 'A', slot: 'right' }] },
        { layout: [{ nodeId: 'P', x: 2, y: -2 }, { nodeId: 'S', x: 0, y: 0 }, { nodeId: 'A', x, y }],
            nodeCaptions: name === 'node' ? [] : [{ id: 'A', text: 'tag' }] }).state;
    return { state, size: { width: 390, height: 280 }, options: { theme: 'light', horizontalGap, levelGap, emptySlots: 'visible' } };
}
