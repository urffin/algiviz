import type { Step, Frame } from "../playback/index.js";

export interface GridCoordinate {
    readonly row: number;
    readonly column: number;
}
export interface GridInput<Value = unknown> {
    readonly rows: number;
    readonly columns: number;
    readonly values: readonly Value[];
}
export interface GridWrite<Value = unknown> extends GridCoordinate {
    readonly value: Value;
}
export interface GridAnnotation extends GridCoordinate {
    readonly role: string;
}
export interface GridMark extends GridCoordinate {
    readonly role: string | null;
}
export interface GridCellCaption extends GridCoordinate {
    readonly text: string;
}
export interface GridCellCaptionPatch extends GridCoordinate {
    readonly text: string | null;
}
export interface GridMarkUpdate {
    readonly cells?: readonly GridMark[] | undefined;
    readonly cellCaptions?: readonly GridCellCaptionPatch[] | undefined;
}
export interface GridResultInput {
    readonly cells?: readonly GridCoordinate[] | undefined;
    readonly path?: readonly GridCoordinate[] | undefined;
}
export interface GridResult {
    readonly cells: readonly GridCoordinate[];
    readonly path: readonly GridCoordinate[];
}
export interface GridDoneOptions {
    readonly result?: GridResultInput | undefined;
}
export interface GridTraceOptions {
    readonly cellCaptions?: readonly GridCellCaption[] | undefined;
}
export type GridEdit<Value = unknown> = Readonly<{
    readonly rows?: undefined;
    readonly columns?: undefined;
    readonly marks?: GridMarkUpdate | undefined;
} & (
    | { readonly values: readonly Value[]; readonly writes?: undefined }
    | { readonly values?: undefined; readonly writes?: readonly GridWrite<Value>[] | undefined }
)>;
export interface GridSnapshot<Value = unknown> {
    readonly grid: GridInput<Value>;
    readonly cellMarks: readonly GridAnnotation[];
    readonly cellCaptions: readonly GridCellCaption[];
    readonly result: GridResult | null;
}
export type GridEvent = Readonly<
    | { type: "start" }
    | { type: "edit" }
    | { type: "mark"; cells: readonly GridMark[]; cellCaptions: readonly GridCellCaptionPatch[] }
    | { type: "done" }
>;
export type GridStep<Value = unknown> = Step<GridSnapshot<Value>, GridEvent>;
export type GridFrame<Value = unknown, Event = GridEvent> = Frame<GridSnapshot<Value>, Event>;
export interface GridTrace<Value = unknown> {
    readonly state: GridSnapshot<Value>;
    start(): GridStep<Value>;
    edit(update: GridEdit<Value>): GridStep<Value>;
    mark(update: GridMarkUpdate): GridStep<Value>;
    done(options?: GridDoneOptions): GridStep<Value>;
}
export interface GridSceneOptions {
    readonly namespace: string;
}
export interface GridCellView<Value = unknown> extends GridCoordinate {
    readonly value: Value;
    readonly caption: string | null;
    readonly role: string | null;
    readonly result: boolean;
}
export interface GridPathView {
    readonly cellIds: readonly string[];
}
export type GridObjects<Value = unknown> = {
    gridCell: GridCellView<Value>;
    gridPath: GridPathView;
};
