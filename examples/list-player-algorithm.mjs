import { createListTrace } from '@grundyjs/algiviz/list';
import { timing, limits } from './player-settings.mjs';

const initial = Object.freeze({
    headId: 'a',
    nodes: Object.freeze([
        Object.freeze({ id: 'a', value: 7, nextId: 'b' }),
        Object.freeze({ id: 'b', value: 3, nextId: 'c' }),
        Object.freeze({ id: 'c', value: 9, nextId: null }),
    ]),
});
const inserted = Object.freeze({ id: 'x', value: 5, nextId: 'b' });
const peakNodes = initial.nodes.length + 1;
const nextSlot = nodeId => ({ kind: 'next', nodeId });
const headSlot = { kind: 'head' };
const markPointer = (id, role) => ({ id, role });
const describe = (step, phase, message) => Object.freeze({
    ...step, state: Object.freeze({ visual: step.state, phase, message }),
});

function insertAfterHead(list) {
    return {
        headId: list.headId,
        nodes: [
            ...list.nodes.map(node => node.id === list.headId ? { ...node, nextId: inserted.id } : node),
            inserted,
        ],
    };
}

function removeNode(list, id) {
    const { nextId } = list.nodes.find(node => node.id === id);
    return {
        headId: list.headId === id ? nextId : list.headId,
        nodes: list.nodes.filter(node => node.id !== id)
            .map(node => node.nextId === id ? { ...node, nextId } : node),
    };
}

function reverseList(list) {
    const byId = new Map(list.nodes.map(node => [node.id, node]));
    const replacements = new Map();
    let previous = null;
    for (let id = list.headId; id !== null;) {
        const node = byId.get(id);
        replacements.set(id, { ...node, nextId: previous });
        previous = id;
        id = node.nextId;
    }
    return { headId: previous, nodes: list.nodes.map(node => replacements.get(node.id)) };
}

export function* listEditSteps(layout) {
    const trace = createListTrace(initial, { layout: layout(initial) });
    yield describe(trace.start(), 'start', 'Start with 7 → 3 → 9.');

    let candidate = insertAfterHead(trace.state.list);
    yield describe(trace.edit({
        ...candidate,
        layout: layout(candidate),
        marks: {
            nodes: [{ id: 'x', role: 'active' }],
            pointers: [markPointer(nextSlot('a'), 'active')],
            nodeCaptions: [{ id: 'x', text: 'inserted' }],
        },
    }), 'insert', 'Insert 5 after 7. Now 7 → 5 → 3 → 9.');

    candidate = removeNode(trace.state.list, 'b');
    yield describe(trace.edit({
        ...candidate,
        layout: layout(candidate),
        marks: {
            nodes: [{ id: 'x', role: null }],
            pointers: [markPointer(nextSlot('a'), null), markPointer(nextSlot('x'), 'active')],
            nodeCaptions: [{ id: 'x', text: null }],
        },
    }), 'remove', 'Remove 3 by linking 5 directly to 9. Now 7 → 5 → 9.');

    candidate = reverseList(trace.state.list);
    const pointerIds = [headSlot, ...candidate.nodes.map(node => nextSlot(node.id))];
    yield describe(trace.edit({
        ...candidate,
        layout: layout(candidate),
        marks: { pointers: pointerIds.map(id => markPointer(id, 'active')) },
    }), 'reverse', 'Reverse the links and move head to 9. Now 9 → 5 → 7.');

    yield describe(trace.done({
        result: { nodeIds: candidate.nodes.map(node => node.id), pointerIds },
    }), 'done', 'Result: 9 → 5 → 7 → null.');
}

export const listRewindCapacity = 8;

export function prepareListSession(mode, layout) {
    if (mode !== 'generator' && mode !== 'history') throw new RangeError('Choose a playback mode');
    if (peakNodes > limits[mode]) throw new RangeError('List exceeds the shared demo size limit');
    const source = () => listEditSteps(layout);
    if (mode === 'history') {
        return { ...timing, history: () => Object.freeze([...source()].map(step => step.state)) };
    }
    return { ...timing, stepSource: source, isTerminal: step => step.event.type === 'done',
        rewindCapacity: listRewindCapacity };
}
