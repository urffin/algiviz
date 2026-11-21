import { createListRenderer } from "@grundyjs/algiviz/canvas/list";
import type { ListPalette, ListNodePresentation, ListRendererOptions, ListRenderSize, ListRenderer } from "@grundyjs/algiviz/canvas/list";
import { createListTrace } from "@grundyjs/algiviz/list";
import type { ListFrame } from "@grundyjs/algiviz/list";
import type { PlayerOptions } from "@grundyjs/algiviz/player";

export type PublicListCanvasTypes = [ListPalette, ListNodePresentation, ListRendererOptions, ListRenderSize, ListRenderer];
const renderer = createListRenderer<number>({
    theme: "light",
    presentNode: view => ({ label: view.node.value.toFixed() }),
    nullPointers: "visible",
    colors: { result: undefined }
});
const list = { headId: "A", nodes: [{ id: "A", value: 4, nextId: null }] };
const layout = renderer.layout(list);
if (layout[0]?.x !== 0 || !Object.isFrozen(layout)) throw new Error("Installed list layout incorrect");

export function options(context: CanvasRenderingContext2D, size: ListRenderSize): PlayerOptions<
    ListFrame<number>["current"], ListFrame<number>["event"]> {
    return {
        *stepSource() {
            const trace = createListTrace(list, { layout });
            yield trace.start();
            yield trace.done({ result: { pointerIds: [{ kind: "head" }] } });
        },
        isTerminal: step => step.event.type === "done",
        rewindCapacity: 2,
        render: frame => renderer.render(context, frame, size)
    };
}

export function assertTypeBoundary(context: CanvasRenderingContext2D, frame: ListFrame<number>) {
    renderer.render(context, { ...frame, event: undefined }, { width: 120, height: 80 });
    // @ts-expect-error theme is required
    createListRenderer({});
    // @ts-expect-error async presentation is unsupported
    createListRenderer({ theme: "light", presentNode: async () => ({ label: "value" }) });
    // @ts-expect-error a layout result is immutable
    layout[0]!.x = 1;
    // @ts-expect-error state is not a frame
    renderer.render(context, frame.current, { width: 120, height: 80 });
    // @ts-expect-error a renderer preserves the payload domain
    renderer.render(context, {} as ListFrame<string>, { width: 120, height: 80 });
    // @ts-expect-error null visibility is a closed option
    createListRenderer({ theme: "light", nullPointers: "auto" });
    // @ts-expect-error the renderer does not own disposal
    renderer.dispose();
}
