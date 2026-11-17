import { createGraphRenderer, graphLayout } from './graph-scene.mjs';

// The original teaching scene, driven by the same Player as the stock example.
export function createDetailedGraphView(preset) {
    const renderer = createGraphRenderer({ layout: preset });
    return {
        height: (width, state) => graphLayout(width, state.graph.nodes.length, preset).height,
        render(context, frame, size) {
            // Recorded history has no Frame.event; the immutable state keeps its BFS event.
            renderer.render(context, { ...frame, event: frame.current.event }, size.width, size.height);
        }
    };
}
