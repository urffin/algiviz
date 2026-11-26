import { createGraphTrace } from '@grundyjs/algiviz/graph';

// Snapshots from the site's Aho–Corasick builder. Null marks a failure link.
const fixtures = [
    ['сон, он, нос',
        [['∅', 1, 0], ['с', 0, 1], ['со', 0, 2], ['сон •', 0, 3], ['о', 1, 1], ['он •', 1, 2], ['н', 2, 1], ['но', 2, 2], ['нос •', 2, 3]],
        [[0, 1, 'с'], [1, 2, 'о'], [2, 3, 'н'], [0, 4, 'о'], [4, 5, 'н'], [0, 6, 'н'], [6, 7, 'о'], [7, 8, 'с'],
            [2, 4, null], [3, 5, null], [5, 6, null], [7, 4, null], [8, 1, null]]],
    ['she, he, hers',
        [['∅', .5, 0], ['s', 0, 1], ['sh', 0, 2], ['she •', 0, 3], ['h', 1, 1], ['he •', 1, 2], ['her', 1, 3], ['hers •', 1, 4]],
        [[0, 1, 's'], [1, 2, 'h'], [2, 3, 'e'], [0, 4, 'h'], [4, 5, 'e'], [5, 6, 'r'], [6, 7, 's'],
            [2, 4, null], [3, 5, null], [7, 1, null]]],
    ['сон, нос, оса, она',
        [['∅', 1.25, 0], ['с', 0, 1], ['со', 0, 2], ['сон •', 0, 3], ['н', 1, 1], ['но', 1, 2], ['нос •', 1, 3],
            ['о', 2.5, 1], ['ос', 2, 2], ['оса •', 2, 3], ['он', 3, 2], ['она •', 3, 3]],
        [[0, 1, 'с'], [1, 2, 'о'], [2, 3, 'н'], [0, 4, 'н'], [4, 5, 'о'], [5, 6, 'с'], [0, 7, 'о'], [7, 8, 'с'],
            [8, 9, 'а'], [7, 10, 'н'], [10, 11, 'а'], [2, 7, null], [3, 10, null], [5, 7, null], [6, 8, null], [8, 1, null], [10, 4, null]]],
];

export function ahoLabelFrames() {
    return fixtures.map(([name, positions, connections]) => {
        const nodes = positions.map(([label], id) => ({ id: String(id), label }));
        const layout = positions.map(([, x, y], id) => ({ nodeId: String(id), x, y }));
        const edges = connections.map(([from, to, label]) => ({
            id: label === null ? `fail:${from}` : `next:${to}`,
            from: String(from), to: String(to), directed: true,
            data: { kind: label === null ? 'failure' : 'transition' }, ...(label === null ? {} : { label })
        }));
        const trace = createGraphTrace({ nodes, edges }, { layout });
        const start = trace.start();
        const fallback = trace.mark({ edges: [{ id: 'fail:3', role: 'active' }] });
        const withoutLabels = step => {
            const bare = createGraphTrace({
                nodes, edges: edges.map(edge => ({ ...edge, label: '' }))
            }, { layout });
            bare.start();
            return bare.mark({ edges: step.state.edgeMarks }).state;
        };
        return {
            name, start, fallback, withoutLabels, labelCount: edges.filter(edge => edge.label).length,
        };
    });
}
