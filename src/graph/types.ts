import type { Step, Frame } from "../playback/types.js";

export interface GraphNode<Data = unknown> {
    readonly id: string;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
}
export interface GraphEdge<Data = unknown> {
    readonly id: string;
    readonly from: string;
    readonly to: string;
    readonly directed?: boolean | undefined;
    readonly weight?: number | undefined;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
}
export interface GraphInput<NodeData = unknown, EdgeData = unknown> {
    readonly nodes: readonly GraphNode<NodeData>[];
    readonly edges: readonly GraphEdge<EdgeData>[];
}
export interface GraphPosition {
    readonly nodeId: string;
    readonly x: number;
    readonly y: number;
}
export interface GraphAnnotation {
    readonly id: string;
    readonly role: string;
}
export interface GraphMark {
    readonly id: string;
    readonly role: string | null;
}
export interface GraphNodeCaption {
    readonly id: string;
    readonly text: string;
}
export interface GraphNodeCaptionPatch {
    readonly id: string;
    readonly text: string | null;
}
export interface GraphMarkUpdate {
    readonly nodes?: readonly GraphMark[] | undefined;
    readonly edges?: readonly GraphMark[] | undefined;
    readonly nodeCaptions?: readonly GraphNodeCaptionPatch[] | undefined;
}
export interface GraphResultInput {
    readonly nodeIds?: readonly string[] | undefined;
    readonly edgeIds?: readonly string[] | undefined;
}
export interface GraphResult {
    readonly nodeIds: readonly string[];
    readonly edgeIds: readonly string[];
}
export interface GraphDoneOptions {
    readonly result?: GraphResultInput | undefined;
}
export interface GraphTraceOptions {
    readonly nodeCaptions?: readonly GraphNodeCaption[] | undefined;
    readonly layout?: readonly GraphPosition[] | undefined;
}
export interface GraphSnapshot<NodeData = unknown, EdgeData = unknown> {
    readonly graph: GraphInput<NodeData, EdgeData>;
    readonly layout: readonly GraphPosition[];
    readonly nodeMarks: readonly GraphAnnotation[];
    readonly edgeMarks: readonly GraphAnnotation[];
    readonly result: GraphResult | null;
    readonly nodeCaptions?: readonly GraphNodeCaption[] | undefined;
}
export type GraphEvent = Readonly<
    | { type: "start" }
    | { type: "mark"; nodes: readonly GraphMark[]; edges: readonly GraphMark[];
        nodeCaptions?: readonly GraphNodeCaptionPatch[] | undefined }
    | { type: "layout" }
    | { type: "done" }
>;
export type GraphStep<N = unknown, E = unknown> = Step<GraphSnapshot<N, E>, GraphEvent>;
export type GraphFrame<N = unknown, E = unknown, Event = GraphEvent> = Frame<GraphSnapshot<N, E>, Event>;

export interface GraphTrace<NodeData = unknown, EdgeData = unknown> {
    readonly state: GraphSnapshot<NodeData, EdgeData>;
    start(): GraphStep<NodeData, EdgeData>;
    mark(update: GraphMarkUpdate): GraphStep<NodeData, EdgeData>;
    setLayout(layout: readonly GraphPosition[]): GraphStep<NodeData, EdgeData>;
    done(options?: GraphDoneOptions): GraphStep<NodeData, EdgeData>;
}
export interface GraphSceneOptions {
    readonly namespace: string;
}
export interface GraphNodeView<Data = unknown> {
    readonly node: GraphNode<Data>;
    readonly caption?: string | undefined;
    readonly position: GraphPosition;
    readonly role: string | null;
    readonly result: boolean;
}
export interface GraphEdgeView<Data = unknown> {
    readonly edge: GraphEdge<Data>;
    readonly from: string;
    readonly to: string;
    readonly role: string | null;
    readonly result: boolean;
    readonly routeIndex: number;
    readonly routeCount: number;
}
export type GraphObjects<N = unknown, E = unknown> = {
    graphNode: GraphNodeView<N>;
    graphEdge: GraphEdgeView<E>;
};
