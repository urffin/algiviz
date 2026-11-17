// Application-owned normalized preset positions; /graph supplies the circle fallback.
const layouts = {
    layers: { A: [.48, 0], B: [.18, .34], C: [.78, .34], D: [0, .68], E: [.48, .68], F: [1, .68], G: [.48, 1], H: [1, 0] },
    chain: { A: [.08, 0], B: [.5, .25], C: [.92, .5], D: [.5, .75], E: [.08, 1] },
    diamond: { A: [.5, 0], B: [.05, .5], C: [.95, .5], D: [.5, 1] }
};
export function graphPositions(graph, preset) {
    const positions = Object.hasOwn(layouts, preset) ? layouts[preset] : null;
    if (!positions || !graph.nodes.every(node => Object.hasOwn(positions, node.id))) return undefined;
    return graph.nodes.map(node => ({ nodeId: node.id, x: positions[node.id][0], y: positions[node.id][1] }));
}
