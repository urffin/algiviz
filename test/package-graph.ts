import { createGraphTrace, createDynamicGraphTrace, graphScene, type GraphNode, type GraphEdge, type GraphInput,
    type DynamicGraphEdit, type DynamicGraphEvent, type DynamicGraphStep, type DynamicGraphTrace,
    type GraphNodeCaption, type GraphNodeCaptionPatch, type GraphPosition, type GraphAnnotation, type GraphMark, type GraphMarkUpdate,
    type GraphResultInput, type GraphResult, type GraphDoneOptions, type GraphTraceOptions,
    type GraphSnapshot, type GraphEvent, type GraphStep, type GraphFrame, type GraphTrace,
    type GraphSceneOptions, type GraphNodeView, type GraphEdgeView, type GraphObjects } from '@grundyjs/algiviz/graph';
import { createTimeline, createPlayer, createRewindBuffer, type Frame } from '@grundyjs/algiviz/playback';
import { createSceneProjector, createSceneRenderer } from '@grundyjs/algiviz/scene';

// All graph exports compile with ES2022 only, including in the installed consumer matrix.
export type PublicGraphTypes = [GraphNode<number>, GraphEdge<string>, GraphInput<number,string>,
    GraphNodeCaption, GraphNodeCaptionPatch, GraphPosition, GraphAnnotation, GraphMark, GraphMarkUpdate, GraphResultInput, GraphResult,
    GraphDoneOptions, GraphTraceOptions, GraphSnapshot<number,string>, GraphEvent,
    GraphStep<number,string>, GraphFrame<number,string>, GraphTrace<number,string>, GraphSceneOptions,
    GraphNodeView<number>, GraphEdgeView<string>, GraphObjects<number,string>];
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const trace = createGraphTrace({ nodes: [{ id: 'A', data: { score: 1 } }, { id: 'B', data: { score: 2 } }],
    edges: [{ id: 'A', from: 'A', to: 'B', directed: true, weight: -1, data: 'edge' }] }, { nodeCaptions: [{ id: 'A', text: 'd = 0' }] });
const score: number | undefined = trace.state.graph.nodes[0]?.data?.score;
const payload: string | undefined = trace.state.graph.edges[0]?.data;
const initial = trace.start();
const marked = trace.mark({ nodes: [{ id: 'B', role: 'custom:frontier' }, { id: 'A', role: 'visited' }], edges: [{ id: 'A', role: null }], nodeCaptions: [{ id: 'B', text: 'd = 1' }] });
const done = trace.done({ result: { nodeIds: ['B', 'A', 'B'], edgeIds: ['A'] } });
check(done.state.result?.nodeIds.join() === 'B,A', 'Installed graph result lost selection order');
check(initial.state.result === null && initial.state.nodeMarks.length === 0, 'Installed graph mutated retained state');
check(marked.state.nodeMarks[0]?.id === 'A' && Object.isFrozen(done.state.graph.nodes), 'Installed graph marks/ownership failed');
check(done.state.nodeCaptions?.[1]?.text === 'd = 1' && initial.state.nodeCaptions?.length === 1, 'Installed captions capture/preservation failed');
const frames = createTimeline([initial, marked, done], { stepDurationMs: 10, finalHoldMs: 0 });
const project = createSceneProjector((state: typeof trace.state) => graphScene(state, { namespace: 'consumer' }));
const projected = project(frames.sample(20));
const seen: string[] = [];
createSceneRenderer<GraphObjects<{score:number},string>,string[],GraphEvent>({
    graphNode(output, object) {
        const view = (object.current ?? object.previous)!.data;
        const value: number | undefined = view.node.data?.score;
        const x: number = view.position.x;
        if (view.result) output.push(view.node.id);
        const caption: string | undefined = view.caption; void caption;
        void value; void x;
    },
    graphEdge(_output, object, scene) {
        const view = (object.current ?? object.previous)!.data;
        check(scene.get(view.from)?.current?.type === 'graphNode', 'Graph edge source ref failed');
        const n: number = view.routeCount; const value: string | undefined = view.edge.data; void n; void value;
    }
}).render(seen, projected);
check(seen.join() === 'A,B', 'Graph scene did not retain independent node results');
const buffer = createRewindBuffer([initial, marked, done], { capacity: 2 });
buffer.next(); buffer.next(); buffer.next(); check(buffer.previous() === marked, 'Graph rewind failed'); buffer.dispose();
const player = createPlayer([initial, marked, done], { isTerminal: step => step.event.type === 'done' });
player.nextStep(); player.nextStep(); check(player.finished, 'Graph terminal step not recognized'); player.dispose();
const stateOnly: GraphFrame<{score:number},string,undefined> = { ...frames.sample(20), event: undefined };
const noEvent: Frame<typeof trace.state,undefined> = stateOnly; project(noEvent);
void score; void payload;

const dynamic = createDynamicGraphTrace({
    nodes: [{ id: 'A', data: { score: 1 } }, { id: 'B', data: { score: 2 } }],
    edges: [{ id: 'e', from: 'A', to: 'B', data: 'edge' }],
});
const typedTrace: DynamicGraphTrace<{score:number},string> = dynamic;
const update: DynamicGraphEdit<{score:number},string> = {
    edges: [{ id: 'e', from: 'B', to: 'A', data: 'edge' }],
    nodes: undefined,
};
const dynamicStart = typedTrace.start();
const edit: DynamicGraphStep<{score:number},string> = typedTrace.edit(update);
const dynamicTimeline = createTimeline([dynamicStart, edit], { stepDurationMs: 10, finalHoldMs: 0 });
const dynamicFrame: GraphFrame<{score:number},string,DynamicGraphEvent> = dynamicTimeline.sample(5);
project(dynamicFrame);
check(edit.event.type === 'edit' && edit.state.graph.edges[0]?.from === 'B', 'Installed dynamic edit failed');
const dynamicNodeData: number | undefined = edit.state.graph.nodes[0]?.data?.score;
const dynamicEdgeData: string | undefined = edit.state.graph.edges[0]?.data;
function fixedEvent(event: GraphEvent): string {
    switch (event.type) {
        case 'start': case 'mark': case 'layout': case 'done': return event.type;
        default: { const impossible: never = event; return impossible; }
    }
}
check(fixedEvent(initial.event) === 'start', 'The installed fixed event changed');
void dynamicNodeData; void dynamicEdgeData;

export function graphTypeErrors() {
    // @ts-expect-error The fixed GraphEvent excludes topology changes.
    const fixedEdit: GraphEvent = { type: 'edit' };
    // @ts-expect-error A dynamic step can carry an edit.
    const fixedStep: GraphStep<{score:number},string> = edit;
    // @ts-expect-error No default update.
    dynamic.edit();
    // @ts-expect-error Node payload inference is preserved in edit.
    dynamic.edit({ nodes: [{ id: 'C', data: { score: 'three' } }] });
    // @ts-expect-error Edge payload inference is independent.
    dynamic.edit({ edges: [{ id: 'e', from: 'A', to: 'B', data: 2 }] });
    // @ts-expect-error Public edit fields are readonly.
    update.edges = [];
    void fixedEdit; void fixedStep;
    // @ts-expect-error Caption text is a string, never a coerced number.
    trace.mark({ nodeCaptions: [{ id: 'A', text: 1 }] });
    // @ts-expect-error Explicit undefined does not clear a caption.
    trace.mark({ nodeCaptions: [{ id: 'A', text: undefined }] });
    // @ts-expect-error Caption snapshots are readonly.
    done.state.nodeCaptions![0]!.text = 'changed';
    // @ts-expect-error No new event discriminant.
    const captionEvent: GraphEvent = { type: 'captions' };

    // @ts-expect-error Snapshot result is readonly.
    trace.state.result = null;
    // @ts-expect-error Topology arrays are readonly.
    trace.state.graph.nodes.push({ id: 'C' });
    // @ts-expect-error Entity IDs are readonly.
    trace.state.graph.nodes[0]!.id = 'C';
    // @ts-expect-error Positions are readonly.
    trace.state.layout[0]!.x = 1;
    // @ts-expect-error Result selections are readonly.
    done.state.result!.nodeIds.push('C');
    // @ts-expect-error Payload inference must survive the graph API.
    const bad: string = trace.state.graph.nodes[0]!.data!.score;
    // @ts-expect-error String IDs, not numeric indices.
    createGraphTrace({ nodes: [{ id: 0 }], edges: [] });
    // @ts-expect-error Weights are numeric.
    createGraphTrace({ nodes: [], edges: [{ id: 'x', from: 'A', to: 'B', weight: '1' }] });
    // @ts-expect-error Direction is boolean.
    createGraphTrace({ nodes: [], edges: [{ id: 'x', from: 'A', to: 'B', directed: 1 }] });
    // @ts-expect-error Clearing a role requires null.
    trace.mark({ nodes: [{ id: 'A', role: undefined }] });
    // @ts-expect-error Selected IDs are strings.
    trace.done({ result: { edgeIds: [0] } });
    // @ts-expect-error Namespace is mandatory.
    graphScene(trace.state, {});
    // @ts-expect-error Fixed trace has no topology mutation API.
    trace.addNode({ id: 'C' });
    // @ts-expect-error Closed GraphEvent is not a global extensible union.
    const event: GraphEvent = { type: 'visit' };
    // @ts-expect-error Normalized result snapshots require both selections.
    const incomplete: GraphResult = { nodeIds: [] };
    // @ts-expect-error Scene views keep data narrowed by kind.
    const view: GraphNodeView = { node: { id: 'A' }, position: { nodeId: 'A', x: 0, y: 0 }, role: null, result: true, routeCount: 1 };
    void bad; void event; void incomplete; void view;
}
