// Shared immutable inputs for the independent BFS and DFS examples.
function fixedGraph(labels, pairs) {
    return Object.freeze({
        nodes: Object.freeze([...labels].map(id => Object.freeze({ id }))),
        edges: Object.freeze(pairs.map(([id, from, to]) => Object.freeze({ id, from, to }))),
    });
}
// Kept for the original walkthrough, tests and README GIF.
export const sampleGraph = fixedGraph('ABCDEFG', [
    ['AB', 'A', 'B'], ['AC', 'A', 'C'], ['BD', 'B', 'D'],
    ['CD', 'C', 'D'], ['DE', 'D', 'E'], ['BC', 'B', 'C'], ['FG', 'F', 'G'],
]);
export const graphExamples = Object.freeze([
    Object.freeze({ id: 'layers', label: 'Layers and a cycle', start: 'A', target: 'G',
        graph: fixedGraph('ABCDEFGH', ['AB', 'AC', 'BD', 'BE', 'CE', 'CF', 'DG', 'EG', 'FG'].map(pair => [pair, ...pair])) }),
    Object.freeze({ id: 'chain', label: 'Chain', start: 'A', target: 'E',
        graph: fixedGraph('ABCDE', ['AB', 'BC', 'CD', 'DE'].map(pair => [pair, ...pair])) }),
    Object.freeze({ id: 'diamond', label: 'Two shortest paths', start: 'A', target: 'D',
        graph: fixedGraph('ABCD', ['AB', 'AC', 'BD', 'CD'].map(pair => [pair, ...pair])) }),
    Object.freeze({ id: 'circle', label: 'Original disconnected graph', start: 'A', target: 'E', graph: sampleGraph }),
]);
