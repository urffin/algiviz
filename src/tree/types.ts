import type { Step, Frame } from "../playback/index.js";
import type { Scene } from "../scene/index.js";

export type TreeKind = "ordered" | "binary";
export type TreeBinarySlot = "left" | "right";
export interface TreeNode<Data = unknown> {
    readonly id: string;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
}
export interface TreeOrderedLink<Data = unknown> {
    readonly id: string;
    readonly parentId: string;
    readonly childId: string;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
    readonly slot?: undefined;
}
export interface TreeBinaryLink<Data = unknown> {
    readonly id: string;
    readonly parentId: string;
    readonly childId: string;
    readonly slot: TreeBinarySlot;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
}
export type TreeLink<Data = unknown, Kind extends TreeKind = TreeKind> =
    Kind extends "binary" ? TreeBinaryLink<Data> : TreeOrderedLink<Data>;
export interface TreeOrderedInput<NodeData = unknown, LinkData = unknown> {
    readonly kind: "ordered";
    readonly rootId: string | null;
    readonly nodes: readonly TreeNode<NodeData>[];
    readonly links: readonly TreeOrderedLink<LinkData>[];
}
export interface TreeBinaryInput<NodeData = unknown, LinkData = unknown> {
    readonly kind: "binary";
    readonly rootId: string | null;
    readonly nodes: readonly TreeNode<NodeData>[];
    readonly links: readonly TreeBinaryLink<LinkData>[];
}
export type TreeInput<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> =
    Kind extends "binary" ? TreeBinaryInput<N, L> : TreeOrderedInput<N, L>;
export interface TreePosition {
    readonly nodeId: string;
    readonly x: number;
    readonly y: number;
}
export interface TreeAnnotation {
    readonly id: string;
    readonly role: string;
}
export interface TreeMark {
    readonly id: string;
    readonly role: string | null;
}
export interface TreeNodeCaption {
    readonly id: string;
    readonly text: string;
}
export interface TreeNodeCaptionPatch {
    readonly id: string;
    readonly text: string | null;
}
export interface TreeMarkUpdate {
    readonly nodes?: readonly TreeMark[] | undefined;
    readonly links?: readonly TreeMark[] | undefined;
    readonly nodeCaptions?: readonly TreeNodeCaptionPatch[] | undefined;
}
export interface TreeResultInput {
    readonly nodeIds?: readonly string[] | undefined;
    readonly linkIds?: readonly string[] | undefined;
}
export interface TreeResult {
    readonly nodeIds: readonly string[];
    readonly linkIds: readonly string[];
}
export interface TreeDoneOptions {
    readonly result?: TreeResultInput | undefined;
}
export interface TreeTraceOptions {
    readonly layout: readonly TreePosition[];
    readonly nodeCaptions?: readonly TreeNodeCaption[] | undefined;
}
export interface TreeEdit<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> {
    readonly rootId?: string | null | undefined;
    readonly nodes?: readonly TreeNode<N>[] | undefined;
    readonly links?: readonly TreeLink<L, Kind>[] | undefined;
    readonly layout?: readonly TreePosition[] | undefined;
    readonly kind?: undefined;
}
export interface TreeSnapshot<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> {
    readonly tree: TreeInput<N, L, Kind>;
    readonly layout: readonly TreePosition[];
    readonly nodeMarks: readonly TreeAnnotation[];
    readonly linkMarks: readonly TreeAnnotation[];
    readonly nodeCaptions: readonly TreeNodeCaption[];
    readonly result: TreeResult | null;
}
export type TreeEvent = Readonly<
    | { type: "start" }
    | { type: "edit" }
    | { type: "mark"; nodes: readonly TreeMark[]; links: readonly TreeMark[];
        nodeCaptions: readonly TreeNodeCaptionPatch[] }
    | { type: "layout" }
    | { type: "done" }
>;
export type TreeStep<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> =
    Step<TreeSnapshot<N, L, Kind>, TreeEvent>;
export type TreeFrame<N = unknown, L = unknown, Kind extends TreeKind = TreeKind, Event = TreeEvent> =
    Frame<TreeSnapshot<N, L, Kind>, Event>;
export interface TreeTrace<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> {
    readonly state: TreeSnapshot<N, L, Kind>;
    start(): TreeStep<N, L, Kind>;
    edit(update: TreeEdit<N, L, Kind>): TreeStep<N, L, Kind>;
    mark(update: TreeMarkUpdate): TreeStep<N, L, Kind>;
    setLayout(layout: readonly TreePosition[]): TreeStep<N, L, Kind>;
    done(options?: TreeDoneOptions): TreeStep<N, L, Kind>;
}
export interface TreeSceneOptions {
    readonly namespace: string;
}
export interface TreeNodeView<Data = unknown> {
    readonly node: TreeNode<Data>;
    readonly position: TreePosition;
    readonly caption: string | null;
    readonly role: string | null;
    readonly result: boolean;
    readonly root: boolean;
}
export interface TreeLinkView<Data = unknown, Kind extends TreeKind = TreeKind> {
    readonly link: TreeLink<Data, Kind>;
    readonly from: string;
    readonly to: string;
    readonly role: string | null;
    readonly result: boolean;
}
export type TreeObjects<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> = {
    treeNode: TreeNodeView<N>;
    treeLink: TreeLinkView<L, Kind>;
};
