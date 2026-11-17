import { createGraphRenderer, type GraphRenderer, type GraphPalette, type GraphRendererOptions, type GraphRenderSize } from '@grundyjs/algiviz/canvas/graph';
import { createGraphTrace, type GraphFrame, type GraphSnapshot, type GraphEvent } from '@grundyjs/algiviz/graph';
import { createCanvasViewport } from '@grundyjs/algiviz/canvas/viewport';
import { Player } from '@grundyjs/algiviz/player';

// Import and construction have no DOM side effects. Drawing requires a Canvas 2D host.
export type PublicGraphCanvasTypes = [GraphRenderer, GraphPalette, GraphRendererOptions, GraphRenderSize];
const renderer: GraphRenderer = createGraphRenderer({ theme: 'light', colors: { result: undefined }, roleColors: { 'app:frontier': 'orange' }, nodeCaptions: 'auto' });
if (typeof renderer.render !== 'function') throw new Error('Installed graph Canvas export failed');

export function checkGraphCanvasTypes(host: HTMLElement, canvas: HTMLCanvasElement) {
    let player: Player<GraphSnapshot<{ score: number }>, GraphEvent>;
    const viewport = createCanvasViewport(canvas, { onResize() { if (player?.frame) draw(player.frame); } });
    function* source() {
        const trace = createGraphTrace({ nodes: [{ id: 'A', data: { score: 1 } }], edges: [] });
        yield trace.start(); yield trace.done({ result: { nodeIds: ['A'] } });
    }
    function draw(frame: GraphFrame<{ score: number }>) {
        const size = viewport.resize(width => width * .6);
        if (size) renderer.render(viewport.context, frame, size);
    }
    player = new Player(host, { stepSource: source, isTerminal: step => step.event.type === 'done', render: draw, rewindCapacity: 4 });
    player.previous(); player.restart(); player.dispose(); viewport.dispose();
    const stateOnly: GraphFrame<number, unknown, undefined> = {
        previous: createGraphTrace({ nodes: [{ id: 'A', data: 1 }], edges: [] }).state,
        current: createGraphTrace({ nodes: [{ id: 'A', data: 2 }], edges: [] }).state,
        progress: 1, stepIndex: 0, event: undefined
    };
    renderer.render(viewport.context, stateOnly, { width: 640, height: 400 });
    createGraphRenderer({ theme: 'dark', nodeCaptions: 'hidden' });
    // @ts-expect-error No force-visible caption mode.
    createGraphRenderer({ theme: 'dark', nodeCaptions: 'always' });
    // @ts-expect-error Caption placement is not a mutable callback.
    createGraphRenderer({ theme: 'dark', nodeCaptions: () => [] });
    // @ts-expect-error Theme is required.
    createGraphRenderer({});
    // @ts-expect-error Only light/dark themes.
    createGraphRenderer({ theme: 'sepia' });
    // @ts-expect-error Role overrides are string colors.
    createGraphRenderer({ theme: 'dark', roleColors: { active: 1 } });
    // @ts-expect-error Explicit logical dimensions are required.
    renderer.render(viewport.context, stateOnly);
    // @ts-expect-error Dimensions are numeric.
    renderer.render(viewport.context, stateOnly, { width: '640', height: 400 });
    // @ts-expect-error No hidden scheduler or renderer disposal.
    renderer.dispose();
    // @ts-expect-error Renderer options do not select an algorithm/layout solver.
    createGraphRenderer({ theme: 'dark', physics: true });
}
