import { createTreeRenderer, type TreePalette, type TreeRendererOptions, type TreeRenderer, type TreeRenderOptions, type TreeRenderSize } from '@grundyjs/algiviz/canvas/tree';
import { createTreeTrace, type TreeFrame, type TreeSnapshot, type TreeEvent } from '@grundyjs/algiviz/tree';
import { Player } from '@grundyjs/algiviz/player';
export type PublicTreeCanvasTypes = [TreePalette, TreeRendererOptions, TreeRenderer, TreeRenderSize];
const renderer: TreeRenderer = createTreeRenderer({ theme: 'light', emptySlots: 'visible', horizontalGap: 1, levelGap: 2, colors: { result: undefined } });
const input = { kind: 'binary', rootId: 'A', nodes: [{ id: 'A', data: 42 }], links: [] } as const;
const positions = renderer.layout(input);
if (positions.length !== 1 || !Object.isFrozen(positions)) throw new Error('Installed tree layout failed');
export function checkTreeCanvas(host: HTMLElement, context: CanvasRenderingContext2D) {
    function* source() {
        const tree = createTreeTrace(input, { layout: renderer.layout(input) });
        yield tree.start(); yield tree.done({ result: { nodeIds: ['A'] } });
    }
    const player: Player<TreeSnapshot<42, unknown, 'binary'>, TreeEvent> = new Player(host, {
        stepSource: source, isTerminal: step => step.event.type === 'done', rewindCapacity: 3,
        render: frame => renderer.render(context, frame, { width: 640, height: 400 })
    });
    player.previous(); player.restart(); player.dispose();
    const frame: TreeFrame<42, unknown, 'binary', undefined> = { previous: createTreeTrace(input, { layout: positions }).state,
        current: createTreeTrace(input, { layout: positions }).state, progress: 1, event: undefined, stepIndex: 0 };
    const drawing: TreeRenderOptions = { doubleOutlineNodeIds: ['A'] };
    renderer.render(context, frame, { width: 640, height: 400 }, drawing);
    const decorated = createTreeRenderer<42>({ theme: 'light', nodeRadius: 21, drawNode({ view, drawDefault }) {
        const data: 42 | undefined = view.node.data;
        if (data === 42) drawDefault();
    } });
    decorated.render(context, frame, { width: 640, height: 400 }, drawing);
    const other = createTreeTrace({ ...input, nodes: [{ id: 'A', data: 'other' }] }, { layout: positions }).state;
    // @ts-expect-error A typed callback requires matching node data.
    decorated.render(context, { ...frame, previous: other, current: other }, { width: 640, height: 400 });
    // @ts-expect-error A renderer with a typed callback cannot accept every tree.
    const untyped: TreeRenderer = decorated;
    // @ts-expect-error Theme is required.
    createTreeRenderer({});
    // @ts-expect-error No force-visible caption mode.
    createTreeRenderer({ theme: 'dark', nodeCaptions: 'always' });
    // @ts-expect-error No automatic layout option on render.
    createTreeRenderer({ theme: 'light', layout: 'auto' });
    // @ts-expect-error Numeric gaps only.
    createTreeRenderer({ theme: 'dark', horizontalGap: '1' });
    // @ts-expect-error Slots visibility is an enum.
    createTreeRenderer({ theme: 'dark', emptySlots: true });
    // @ts-expect-error Layout returns immutable positions.
    positions.push({ nodeId: 'B', x: 0, y: 0 });
    // @ts-expect-error TreeInput, not TreeSnapshot.
    renderer.layout(frame.current);
    // @ts-expect-error No scheduler/dispose owned by the renderer.
    renderer.dispose();
    // @ts-expect-error Explicit logical size is required.
    renderer.render(context, frame);
    // @ts-expect-error Offscreen host is not part of the first Canvas contract.
    renderer.render({} as OffscreenCanvasRenderingContext2D, frame, { width: 1, height: 1 });
}
