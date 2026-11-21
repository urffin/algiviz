# List Canvas API: /canvas/list

[Русский](ru/list-canvas-api.md) · [Headless list](list-api.md) · [Tree Canvas](tree-canvas-api.md) · [Viewport](canvas-viewport.md) · [Contract check](checks/list-canvas-contract-2026-11-20.json)

**Available since 1.4.0.** The optional `/canvas/list` entry exports
`createListRenderer` and five types.

## Public API and ownership

```ts
import type { ListInput, ListPosition, ListSnapshot, ListNodeView, ListFrame } from "@grundyjs/algiviz/list";

export interface ListPalette {
    readonly background: string;
    readonly node: string;
    readonly border: string;
    readonly text: string;
    readonly caption: string;
    readonly pointer: string;
    readonly nullMarker: string;
    readonly active: string;
    readonly visited: string;
    readonly queued: string;
    readonly result: string;
    readonly resultText: string;
}
export interface ListNodePresentation {
    readonly label?: string | undefined;
    readonly color?: string | undefined;
}
export interface ListRendererOptions<Value = unknown> {
    readonly theme: "light" | "dark";
    readonly colors?: { readonly [K in keyof ListPalette]?: string | undefined } | undefined;
    readonly roleColors?: Readonly<Record<string, string>> | undefined;
    readonly nodeGap?: number | undefined;
    readonly pointerGap?: number | undefined;
    readonly presentNode?: ((this: void, node: ListNodeView<Value>, snapshot: ListSnapshot<Value>) => ListNodePresentation | undefined) | undefined;
    readonly nullPointers?: "visible" | "hidden" | undefined;
    readonly nodeCaptions?: "auto" | "hidden" | undefined;
}
export interface ListRenderSize {
    readonly width: number;
    readonly height: number;
}
export interface ListRenderer<Value = unknown> {
    layout(list: ListInput<Value>): readonly ListPosition[];
    render<Event>(context: CanvasRenderingContext2D, frame: ListFrame<Value, Event>, size: ListRenderSize): void;
}
export declare function createListRenderer<Value = unknown>(options: ListRendererOptions<Value>): ListRenderer<Value>;
```

The factory captures plain Object/null-prototype options and returns a frozen
object with layout and render only. Theme is required. Defaults: nodeGap=4,
pointerGap=1, nullPointers="visible", nodeCaptions="auto", no presenter. Both
gaps are positive finite logical units. nodeGap affects layout only; pointerGap
affects head/null anchors and routing. Unknown fields are ignored; recognized
accessors are rejected without calling them. Optional undefined means omission.
Colors and own nonempty role-name/string-color entries are copied once. CSS
parsing/support belongs to Canvas. Changing captured input objects later has
no effect. ListPointerId and ListObjects remain unchanged.

The caller owns context, bitmap/CSS size, DPR, viewport, source, RAF and disposal.
There is no renderer dispose, automatic resizing or source control. layout
retains no input; render retains no context, snapshot, frame, presenter output
or history after return. One renderer rejects nested layout/render with Error
before inspecting arguments; another idle renderer is independent. Busy covers
capture, callbacks, measurements, drawing and restoration, and clears in finally.

The entry requires DOM declarations because render names CanvasRenderingContext2D.
Import/factory/layout do not access DOM/Worker globals or allocate external
resources. /list remains ES2022-only and independent. The first host is HTML
Canvas 2D, not OffscreenCanvas/SVG/retained DOM. This optional entry may load list
validation/projection and generic scene matching, but not the list trace builder,
Player, Worker or other stock backends. No existing entry loads it implicitly.

## Layout is explicit snapshot data

layout validates a complete ListInput in /list order, without traversing opaque
values or inspecting captions/results. It does not accept ListSnapshot, a partial
edit or an allocated working arena. Trace phase/retired IDs are not part of its
stateless validation. Follow headId/nextId iteratively and assign rank i:
x=i*nodeGap, y=0. Return a copied/frozen complete ListPosition array in **nodes
storage order**, not traversal order. Empty input returns []; the head is (0,0).
Nonfinite derived coordinates are RangeError. Finite rounding collapse is not
a topology change. No recursive-depth dependence or automatic wrapping/layout
based on values, font, theme, viewport, draw order or previous frames.

| Input / policy | Expected positions in storage order |
| --- | --- |
| Empty | [] |
| Single A | A=(0,0) |
| A→B→C, stored [C,A,B], default gap | C=(8,0), A=(0,0), B=(4,0) |
| C→B→A, stored [A,B,C], default gap | A=(8,0), B=(4,0), C=(0,0) |
| A→X→B, stored [A,B,X], nodeGap=2 | A=(0,0), B=(4,0), X=(2,0) |

Record layout(initial) in createListTrace options and layout(completeCandidate)
in the same atomic edit as insertion/deletion/reversal. Render honors recorded
positions and never calls layout, including on resize/Restart. Resolve omitted/
undefined edit fields against the committed list before layout; object spread
alone does not implement undefined-as-omitted. Custom finite layouts are allowed;
the renderer does not repair their order, overlap or routing crossings.

### Player integration

This example uses a local build. The application supplies the context and current logical dimensions, for example from /canvas/viewport.

The repository demo shows insertion, removal and reversal with these APIs. [Linked list demo](../examples/list-player.html)

```ts
import { createListTrace } from "@grundyjs/algiviz/list";
import { createListRenderer } from "@grundyjs/algiviz/canvas/list";
import { Player } from "@grundyjs/algiviz/player";
import type { ListRenderSize } from "@grundyjs/algiviz/canvas/list";

const drawing = createListRenderer<number>({
    theme: "light",
    presentNode: ({ node }) => ({ label: String(node.value) }),
});
function* insert() {
    const initial = { headId: "A", nodes: [
        { id: "A", value: 7, nextId: "B" },
        { id: "B", value: 3, nextId: null },
    ] };
    const list = createListTrace(initial, { layout: drawing.layout(initial) });
    yield list.start();
    const candidate = { headId: "A", nodes: [
        { id: "A", value: 7, nextId: "X" },
        { id: "B", value: 3, nextId: null },
        { id: "X", value: 5, nextId: "B" },
    ] };
    yield list.edit({ ...candidate, layout: drawing.layout(candidate),
        marks: { pointers: [{ id: { kind: "next", nodeId: "A" }, role: "active" }] },
    });
    yield list.done({ result: { nodeIds: ["X"], pointerIds: [{ kind: "next", nodeId: "A" }] } });
}
export function mount(container: HTMLElement, context: CanvasRenderingContext2D, size: () => ListRenderSize) {
    return new Player(container, { stepSource: insert, isTerminal: step => step.event.type === "done",
        rewindCapacity: 8, render: frame => drawing.render(context, frame, size()),
    });
}
```

## Recorded nodes, head and null slots

A node is a rectangular value compartment plus its right next compartment.
For logical center (x,y), the stock body spans [x-1,x+1] × [y-0.5,y+0.5];
the divider is at x+0.5. This is renderer geometry, not extra ListSnapshot data.
The node selection colors the value compartment; the next-slot selection colors
the pointer compartment and its route/null marker independently. A small output
dot/port identifies next even when no null marker is visible. Null is not a fake
node, sentinel allocation, missing endpoint or new scene kind.

For each endpoint let minX/minY be minima of its recorded real node centers,
or (0,0) for empty input. The head badge center is
H=(minX-1-pointerGap, minY-0.5-pointerGap); its logical size is 1.2×0.5 and its
label is "head". This external anchor does not follow the head target's ID.
Interpolate previous/current H for a moving badge. For a next slot, a null
marker center is owner+(1+pointerGap,0). For null head, it is
H+(0,1+pointerGap). Null markers are 1×0.5 boxes labeled "null". Geometry of head
and null decorations belongs to the existing pointer slot, not a public node ID.

nullPointers:"hidden" suppresses null branch strokes/boxes/text, not next/head
compartments, roles or result selection. Head badge stays visible even for the
empty list. A potential null box for every slot is reserved at both endpoints, even for a
non-null target or hidden marker, so null changes/visibility alone cannot reflow
the fit for otherwise unchanged geometry. It does
not hide non-null links. Head/slot labels can be safely omitted when they do not
fit, while their shapes and state identity remain.

## Fitting and interpolation

Use raw p in [0,1], without easing/clamping. A retained node linearly interpolates
its recorded centers; enter/exit uses its available endpoint at alpha p/1-p.
Next compartments use their owner's position/presence. No numeric/value or
color interpolation. Current values/captions/roles/results apply to retained/
entering objects even at p=0; exits use previous data. The head slot always exists.

Fit both endpoints jointly, including zero-presence nodes, head badges and all
potential null boxes, even for non-null/hidden slots. Include full logical glyph rectangles;
expand the joint raw rectangle by pointerGap on each side for routing gutters.
This is a conservative envelope for all interpolated centers/branches. Contain
uniformly and center it using s=min(48,(width-24)/spanX,(height-24)/spanY).
The 12 CSS px padding per side reserves **4 px painted margin plus 8 px for
stroke/arrow extents**; include complete strokes/markers, not centers alone.
Borders/arrows use round joins and bounded extents within that 8 px reservation.
Fixed endpoint-pair fitting never depends on progress, text, roles or result.
A new pair may change the camera; global camera continuity is not promised.

Width/height and bitmap dimensions must be finite nonnegative numbers. Zero
logical or bitmap size is a no-op after validating both snapshots and dimensions.
If either positive logical side is <=24, clear/paint background only: no node
presenters, geometry or text measurements. Otherwise every reserved coordinate,
positive glyph extent, span, transform and route must be representable/finite
before pixels, including
hidden/zero-alpha branches; failures are RangeError. No minimum readable size,
collision-free custom layout or forced separation of crossing moving nodes is
promised. Clip diagram primitives to the 4 px interior as a final safety guard;
clipping is not a substitute for full-stroke fit bounds.

### Arrow routes and retargeting

Next routes start at the owner's right port (x+1,y), ending at the target's left
port (x-1,y). If end.x>=start.x, use an orthogonal route through the midpoint x:
[start,(midX,start.y),(midX,end.y),end]. Otherwise use the lower gutter:
[start,(start.x+g,start.y),(start.x+g,Y),(end.x-g,Y),(end.x-g,end.y),end],
where g=pointerGap and Y=max(owner.y+0.5,target.y+0.5)+g. For null next, the end
is the marker's left port and its bottom bound is center.y+0.25 in the
same gutter formula.
Head routes start at the head badge's bottom port and end at the head node/null
marker's top port, through the midpoint y. Omit repeated zero-length segments;
arrow direction follows the last nonzero segment. No arrows between equal
values or implicit extra edge objects. Custom routes may cross other routes.

The same rules apply at currently interpolated node/head positions. Resolve
**each branch's own previous/current references** through scene.get, including
entering/exiting target nodes at zero presence. Never use only the new target
for both branches or interpolate ID strings. A retained slot with unchanged
target paints one attached route at alpha 1. A target change, including null,
paints previous at 1-p and current at p, previous first. Entering/exiting slots
paint their available branch at p/1-p. Do not multiply the same slot/owner fade
twice. Null marker presence follows its branch, with one marker for unchanged
null. The head badge/next compartment is painted once with slot presence/current
style, even when two routes are painted. No phantom ListSnapshot is introduced.

| Retained slot changes B→X or null→X | Previous branch/marker | Current branch/marker |
| --- | --- | --- |
| p=0 | 1 | 0 |
| p=0.5 | 0.5 | 0.5 |
| p=1 | 0 | 1 |

## Presentation, text and independent result colors

No presenter means no primary value label; there is no automatic String(Value),
ID fallback or payload-property inspection. Captions are independent state data.
For a drawable render, capture/copy/freeze both complete endpoint containers
before calling application code; opaque Value references remain caller-owned.
Invoke presentNode once per union node: current storage order, then previous-only
nodes. Retained/entering use current view/current captured snapshot; exits use
previous view/previous captured snapshot. This includes zero-presence objects and
identical endpoint references. Invoke with undefined this, no event or context.
Capture each return before the next callback; no presentation cache survives a
call. No presenters for empty union or nondrawable sizes defined above.

Callbacks must be pure over supplied immutable data/captured configuration.
Undefined/{} means no overrides; null, Promise or non-plain return is TypeError.
Optional label is a primitive string (empty suppresses it), color a nonempty
primitive string. Recognized accessors are rejected without invocation; unknown
fields ignored. All results are validated even when roles/result/zero presence
hide their visual effect. Original throws, including falsy values, propagate.

| Palette | light | dark |
| --- | --- | --- |
| background | #f8fafc | #101827 |
| node | #e2e8f0 | #334155 |
| border | #94a3b8 | #64748b |
| text | #0f172a | #f1f5f9 |
| caption | #475569 | #cbd5e1 |
| pointer | #475569 | #94a3b8 |
| nullMarker | #64748b | #94a3b8 |
| active | #fbbf24 | #fbbf24 |
| visited | #94a3b8 | #64748b |
| queued | #c4b5fd | #a78bfa |
| result | #047857 | #34d399 |
| resultText | #ffffff | #052e16 |

Value-compartment fill priority: node result → custom role → active/visited/
queued → presenter color → palette.node. Next compartment/head badge priority:
pointer result → custom role → built-in role → palette.node. Pointer route/null
outline priority is the same with palette.pointer/nullMarker as the base.
Selected value compartments and the selected head badge use resultText. The
outlined null marker uses palette.text for its label over the canvas background,
including when its outline is green.
Selecting a node never selects its next/head pointer or vice versa. A role named
result selects nothing. Retained rewiring branches use the current slot's style,
including its result flag. Stock green survives done/hold and disappears when
rewinding to a snapshot without that selection; no remembered event is needed.

Normalize TAB/CR/LF/U+2028/U+2029 runs to one space for drawing only. Measure plain
sans-serif text; never ellipsize, stringify opaque values or squeeze fillText.
Value label sizes 14..8 CSS px, caption 11..8; first try both with a 2 px gap,
then label alone, then caption alone, within the value compartment inset 2 px.
Prefer largest label size, then largest caption size that fits. Hidden captions
are not measured but remain validated. Head uses 12..8 and null uses 11..8. Hidden null text is not measured,
but its geometry remains validated and reserved.
Use advance/actual-ink unions and conservative font bounds [-0.8s,0.2s]; missing
ink metrics use fallback bounds, provided metrics must be finite and advance
width nonnegative. Invalid/unrepresentable metrics are RangeError before pixels.

Plan text deterministically: current node order then exits, followed by head,
then null labels in slot order (previous branch before current). Reject a text
box that intersects another visible, nonzero-presence node/badge body or earlier accepted
text, with a 2 CSS px gap. Omit unsafe text without moving glyphs or changing fit.
Zero-presence geometry remains in fit but reserves no painted text obstacle.
Clip routes out of all accepted text boxes expanded 1 px, even with transparent
fills. Paint routes, node/head/null shapes, then text; no later fill covers an
accepted label. Node crossings/custom overlaps can therefore omit labels.

## Validation, context and completion boundary

Factory captures theme/colors/roleColors/nodeGap/pointerGap/presentNode/
nullPointers/nodeCaptions descriptors in declaration order, then validates in
that order. Wrong options/types/enums/accessors are TypeError; nonpositive or
nonfinite numeric gaps are RangeError. No callback runs at construction.

Render precedence: busy; size width/height; frame descriptors in progress/
previous/current order; p in [0,1]; previous then current complete /list snapshot
validation and owned capture; canvas/bitmap dimensions; zero/tiny-size branch;
finite geometry/fit; presentation results; context save/reset and all metrics/
clipping plans; clear/background/paint; restore. Event/stepIndex are never read,
even if accessors. Invalid hidden snapshots/slots/captions remain errors. There
is no retired-ID history or trace lifecycle validation between endpoint snapshots.
layout uses busy then complete /list input validation then finite rank arithmetic.
Original Proxy/callback/native exceptions escape unchanged; no new error class.

After a successful save, set bitmap/logical transform from canvas.width/size.width
and canvas.height/size.height, neutralize alpha/composite/filter/shadow/dash/text
state and plan before the first pixel. Clear the full logical bitmap, then paint
background, including transparent backgrounds, so redraw/rewind does not leave
old strokes. The caller supplies an unclipped context and owns its current path;
save/restore does not preserve path contents. Never restore a save that failed.
Unwind every acquired nested save in reverse order. First setup/measurement/
paint error wins over restore failure, including undefined/null/false; standalone
restore error propagates. Busy always resets. Already painted pixels and external
callback/Proxy side effects are not rolled back. A later redraw after ordinary
bitmap/context reset needs no renderer reconstruction. Forced GPU restoration,
new browser support, dirty regions and frame-time guarantees are not promised.

Player.stepSource/isTerminal, history, bounded Previous/Next, Pause, Restart,
async/Worker state-only frames and disposal keep their current API. Work is
synchronous; Player's read budget cannot preempt one layout/presenter/render.
Intermediate assignments/detached nodes are application-owned arenas/custom
scenes and are rejected here as invalid lists. No staging mode is added.

## Verification

Repository tests cover layout, retargeting, text, result selection, dimensions, Canvas context restoration and Player integration. Package checks exercise the installed archive, DOM type boundary and independent static and lazy imports.

The implementation report records the repository, package and browser results. [Verification report](checks/list-canvas-implementation-2026-11-20.json)

To run the real Canvas checks after building, start `node scripts/test-grid-canvas-browser.mjs --report <local-report.json>` and open `/test/list-canvas-browser.html` at the printed address. The fixture checks both themes, bitmap scaling, rewind and Restart, Player controls and context restoration.
