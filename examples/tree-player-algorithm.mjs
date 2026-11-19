import { createTreeTrace } from '@grundyjs/algiviz/tree';

// A fixed LL insertion and one right rotation, not a complete AVL implementation.
export function* treeInsertionSteps(layout) {
    const input = { kind: 'binary', rootId: 'n3', nodes: [{ id: 'n3', label: '3', data: 3 }, { id: 'n2', label: '2', data: 2 }],
        links: [{ id: 'upper', parentId: 'n3', childId: 'n2', slot: 'left' }] };
    const tree = createTreeTrace(input, { layout: layout(input) });
    const step = (value, phase, message) => Object.freeze({ ...value,
        state: Object.freeze({ visual: value.state, phase, message }) });
    yield step(tree.start(), 'start', 'Start with root 3 and its left child 2. Insert 1.');

    let current = input.rootId;
    while (true) {
        const node = tree.state.tree.nodes.find(node => node.id === current);
        const slot = 1 < node.data ? 'left' : 'right';
        yield step(tree.mark({ nodes: tree.state.tree.nodes.map(node => ({ id: node.id, role: node.id === current ? 'active' : null })) }),
            'compare', `Compare 1 with ${node.data}: go ${slot}.`);
        const child = tree.state.tree.links.find(link => link.parentId === current && link.slot === slot);
        if (child) { current = child.childId; continue; }
        const inserted = { ...tree.state.tree, nodes: [...tree.state.tree.nodes, { id: 'n1', label: '1', data: 1 }],
            links: [...tree.state.tree.links, { id: 'inserted', parentId: current, childId: 'n1', slot }] };
        yield step(tree.edit({ nodes: inserted.nodes, links: inserted.links, layout: layout(inserted) }),
            'insert', 'The left slot of 2 is empty. Insert 1 there: 3 → 2 → 1 is a left-left chain.');
        break;
    }
    yield step(tree.mark({ nodes: [{ id: 'n3', role: 'active' }, { id: 'n2', role: 'active' }, { id: 'n1', role: 'visited' }],
        links: [{ id: 'upper', role: 'active' }], nodeCaptions: [{ id: 'n1', text: 'inserted' }] }),
        'pivot', 'Rotate right at 3, using its left child 2 as the pivot.');
    const rotated = { ...tree.state.tree, rootId: 'n2', links: tree.state.tree.links.map(link => link.id === 'upper'
        ? { ...link, parentId: 'n2', childId: 'n3', slot: 'right' } : link) };
    yield step(tree.edit({ rootId: rotated.rootId, links: rotated.links, layout: layout(rotated) }),
        'rotate', 'One right rotation: 2 becomes the root, 3 moves to its right, and 1 stays on its left.');
    yield step(tree.mark({ nodes: tree.state.tree.nodes.map(node => ({ id: node.id, role: null })),
        links: tree.state.tree.links.map(link => ({ id: link.id, role: null })),
        nodeCaptions: [{ id: 'n1', text: null }, { id: 'n2', text: 'root' }] }),
        'check', 'In-order is still 1 → 2 → 3. The rotation changes the shape, not the search order.');
    yield step(tree.done({ result: { nodeIds: ['n1', 'n2', 'n3'], linkIds: ['upper', 'inserted'] } }),
        'done', 'Done. Root: 2; left: 1; right: 3. In-order: 1 → 2 → 3. The resulting tree stays green.');
}
