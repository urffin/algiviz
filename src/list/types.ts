import type { Step, Frame } from "../playback/index.js";
import type { Scene } from "../scene/index.js";

export interface ListNode<Value = unknown> {
    readonly id: string;
    readonly value: Value;
    readonly nextId: string | null;
}
export interface ListInput<Value = unknown> {
    readonly headId: string | null;
    readonly nodes: readonly ListNode<Value>[];
}
export interface ListPosition {
    readonly nodeId: string;
    readonly x: number;
    readonly y: number;
}
export type ListPointerId = Readonly<
    | { kind: "head" }
    | { kind: "next"; nodeId: string }
>;
export interface ListAnnotation {
    readonly id: string;
    readonly role: string;
}
export interface ListMark {
    readonly id: string;
    readonly role: string | null;
}
export interface ListPointerAnnotation {
    readonly id: ListPointerId;
    readonly role: string;
}
export interface ListPointerMark {
    readonly id: ListPointerId;
    readonly role: string | null;
}
export interface ListNodeCaption {
    readonly id: string;
    readonly text: string;
}
export interface ListNodeCaptionPatch {
    readonly id: string;
    readonly text: string | null;
}
export interface ListMarkUpdate {
    readonly nodes?: readonly ListMark[] | undefined;
    readonly pointers?: readonly ListPointerMark[] | undefined;
    readonly nodeCaptions?: readonly ListNodeCaptionPatch[] | undefined;
}
export interface ListResultInput {
    readonly nodeIds?: readonly string[] | undefined;
    readonly pointerIds?: readonly ListPointerId[] | undefined;
}
export interface ListResult {
    readonly nodeIds: readonly string[];
    readonly pointerIds: readonly ListPointerId[];
}
export interface ListDoneOptions {
    readonly result?: ListResultInput | undefined;
}
export interface ListTraceOptions {
    readonly layout: readonly ListPosition[];
    readonly nodeCaptions?: readonly ListNodeCaption[] | undefined;
}
export interface ListEdit<Value = unknown> {
    readonly headId?: string | null | undefined;
    readonly nodes?: readonly ListNode<Value>[] | undefined;
    readonly layout?: readonly ListPosition[] | undefined;
    readonly marks?: ListMarkUpdate | undefined;
}
export interface ListSnapshot<Value = unknown> {
    readonly list: ListInput<Value>;
    readonly layout: readonly ListPosition[];
    readonly nodeMarks: readonly ListAnnotation[];
    readonly pointerMarks: readonly ListPointerAnnotation[];
    readonly nodeCaptions: readonly ListNodeCaption[];
    readonly result: ListResult | null;
}
export type ListEvent = Readonly<
    | { type: "start" }
    | { type: "edit" }
    | { type: "mark"; nodes: readonly ListMark[];
        pointers: readonly ListPointerMark[];
        nodeCaptions: readonly ListNodeCaptionPatch[] }
    | { type: "layout" }
    | { type: "done" }
>;
export type ListStep<Value = unknown> = Step<ListSnapshot<Value>, ListEvent>;
export type ListFrame<Value = unknown, Event = ListEvent> = Frame<ListSnapshot<Value>, Event>;
export interface ListTrace<Value = unknown> {
    readonly state: ListSnapshot<Value>;
    start(): ListStep<Value>;
    edit(update: ListEdit<Value>): ListStep<Value>;
    mark(update: ListMarkUpdate): ListStep<Value>;
    setLayout(layout: readonly ListPosition[]): ListStep<Value>;
    done(options?: ListDoneOptions): ListStep<Value>;
}
export interface ListSceneOptions {
    readonly namespace: string;
}
export interface ListNodeView<Value = unknown> {
    readonly node: ListNode<Value>;
    readonly position: ListPosition;
    readonly caption: string | null;
    readonly role: string | null;
    readonly result: boolean;
    readonly head: boolean;
    readonly tail: boolean;
}
export interface ListPointerView {
    readonly pointer: ListPointerId;
    readonly from: string | null;
    readonly to: string | null;
    readonly role: string | null;
    readonly result: boolean;
}
export type ListObjects<Value = unknown> = {
    listNode: ListNodeView<Value>;
    listPointer: ListPointerView;
};
