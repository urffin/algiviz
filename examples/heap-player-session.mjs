import { createArrayTrace } from '@grundyjs/algiviz/array';
import { createTreeTrace } from '@grundyjs/algiviz/tree';
import { iterateHeapSort } from './heap-algorithm.mjs';
import { timing } from './player-settings.mjs';

const values = [2, 2, 1];
const labels = ['2a', '2b', '1'];
const positions = [{ x: 0, y: 0 }, { x: -1, y: 1 }, { x: 1, y: 1 }];

function recordArray(array, { state, event }) {
    switch (event.type) {
        case 'start': return array.start({ sortedSuffixLength: 0 });
        case 'sift-start': return array.highlight([event.root]);
        case 'compare-children': return array.compare(event.left, event.right);
        case 'compare-parent': return array.compare(event.parent, event.child);
        case 'swap':
        case 'extract-swap': return array.swap(event.left, event.right);
        case 'shrink-heap': return array.pass(event.index, { sortedSuffixLength: values.length - state.heapSize });
        case 'done': return array.done();
        default: return array.highlight([]);
    }
}

function makeTree(snapshot, count, labelById) {
    const items = snapshot.slots.slice(0, count);
    return {
        rootId: items[0]?.id ?? null,
        nodes: items.map(item => ({ id: item.id, label: labelById[item.id] })),
        links: items.slice(1).map((child, offset) => {
            const index = offset + 1;
            return {
                id: 'heap-slot-' + index,
                parentId: items[Math.floor((index - 1) / 2)].id,
                childId: child.id,
                slot: index % 2 ? 'left' : 'right',
            };
        }),
        layout: items.map((item, index) => ({ nodeId: item.id, ...positions[index] })),
    };
}

function describe(event, slots, labelById) {
    const label = index => labelById[slots[index].id];
    switch (event.type) {
        case 'start': return 'Start with [2a, 2b, 1].';
        case 'sift-start': return `Sift down from ${label(event.root)}.`;
        case 'compare-children': return `Compare children ${label(event.left)} and ${label(event.right)}.`;
        case 'compare-parent': return `Compare parent ${label(event.parent)} with child ${label(event.child)}.`;
        case 'sift-done': return 'The subtree satisfies the heap property.';
        case 'heap-built': return 'The max-heap is ready.';
        case 'swap': return `Swap ${label(event.right)} and ${label(event.left)} while sifting down.`;
        case 'extract-swap': return `Move maximum ${label(event.right)} to index ${event.right}.`;
        case 'shrink-heap': return `Remove ${label(event.index)} from the heap. It stays in the sorted suffix.`;
        case 'done': return `Sorted order: [${slots.map(item => labelById[item.id]).join(', ')}]. The heap is empty.`;
    }
}

export function* heapPanelSteps() {
    const array = createArrayTrace(values);
    let tree, labelById;
    for (const step of iterateHeapSort(values)) {
        const { type } = step.event;
        const { state: arraySnapshot, event: arrayEvent } = recordArray(array, step);
        if (type === 'start') {
            labelById = Object.freeze(Object.fromEntries(arraySnapshot.slots.map((item, index) => [item.id, labels[index]])));
            const { layout, ...input } = makeTree(arraySnapshot, step.state.heapSize, labelById);
            tree = createTreeTrace({ kind: 'binary', ...input }, { layout });
            tree.start();
        } else if (type === 'swap' || type === 'extract-swap' || type === 'shrink-heap') {
            tree.edit(makeTree(arraySnapshot, step.state.heapSize, labelById));
        } else if (type === 'done') {
            tree.done();
        }
        yield Object.freeze({
            ...step,
            state: Object.freeze({
                array: arraySnapshot,
                tree: tree.state,
                arrayEvent,
                labelById,
                message: describe(step.event, arraySnapshot.slots, labelById),
            }),
        });
    }
}

export function prepareHeapPanelSession(mode) {
    if (mode === 'history') {
        return { ...timing, history: () => Object.freeze(Array.from(heapPanelSteps(), step => step.state)) };
    }
    if (mode === 'generator') {
        return { ...timing, stepSource: heapPanelSteps, isTerminal: step => step.event.type === 'done', rewindCapacity: 24 };
    }
    throw new RangeError('Choose a playback mode');
}
