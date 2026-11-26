# Tree Canvas API: /canvas/tree

[Русский](ru/tree-canvas-api.md) · [Tree API](tree-api.md) · [Graph Canvas](graph-api.md) · [Viewport](canvas-viewport.md) · [Contract check](checks/tree-canvas-contract-2026-11-18.json)

**Released in 1.2.0, 2026-11-19**, commit 8e1f50b. Independent /canvas/tree
exported createTreeRenderer and four types in that release. Calls require DOM types and a Canvas
2D host; headless /tree remains separate. npm 1.1.0 contains neither entry.
[Release and verification](release-1.2.md) · [Initial implementation](checks/tree-canvas-implementation-2026-11-19.json) ·
[T1 correction](checks/tree-t1-fix-2026-11-19.json) · [Native acceptance](checks/tree-t1-native-2026-11-19.json).
Earlier reports retain their historical scope.

## API and ownership

The factory returns layout and render methods. layout computes data for an
explicit trace construction/edit; render always honors the positions in State.
It never silently recomputes hierarchy layout. Render paints a complete bitmap,
including its background; forest/mixed views use treeScene with custom handlers.
This makes positions part of the
recording, including rewind, Worker delivery and Restart.

```ts
import type { Frame } from "@grundyjs/algiviz/playback";
import type { TreeInput, TreePosition, TreeKind, TreeSnapshot } from "@grundyjs/algiviz/tree";

export interface TreePalette {
    readonly background: string;
    readonly text: string;
    readonly node: string;
    readonly link: string;
    readonly emptySlot: string;
    readonly active: string;
    readonly visited: string;
    readonly queued: string;
    readonly result: string;
}
export interface TreeRendererOptions<N = unknown> {
    readonly theme: "light" | "dark";
    readonly colors?: { readonly [K in keyof TreePalette]?: string | undefined } | undefined;
    readonly roleColors?: Readonly<Record<string, string>> | undefined;
    readonly horizontalGap?: number | undefined;
    readonly levelGap?: number | undefined;
    readonly emptySlots?: "hidden" | "visible" | undefined;
    readonly nodeCaptions?: "auto" | "hidden" | undefined;
    readonly nodeRadius?: number | undefined;
    readonly drawNode?: TreeNodeDrawer<N> | undefined;
}
export interface TreeRenderSize {
    readonly width: number;
    readonly height: number;
}
export interface TreeRenderOptions {
    readonly doubleOutlineNodeIds?: readonly string[] | undefined;
}
export interface TreeRenderer {
    layout<N, L>(tree: TreeInput<N, L>): readonly TreePosition[];
    render<N, L, Kind extends TreeKind, Event>(
        context: CanvasRenderingContext2D,
        frame: Frame<TreeSnapshot<N, L, Kind>, Event>,
        size: TreeRenderSize,
        options?: TreeRenderOptions
    ): void;
}
export declare function createTreeRenderer(
    options: TreeRendererOptions & { readonly drawNode?: undefined }
): TreeRenderer;
export declare function createTreeRenderer<N>(options: TreeRendererOptions<N>): TreeRendererWithNodeData<N>;
export declare function createTreeRenderer(options: TreeRendererOptions): TreeRenderer;
```

Theme is required. Defaults: horizontalGap = 1, levelGap = 2, emptySlots = hidden,
nodeCaptions = auto. Gaps are logical layout units, not CSS-pixel distances or
node diameters. Factory options and own color/role overrides are captured once.
Unknown keys are ignored; recognized accessors are rejected without invocation,
as with /tree plain Object/null-prototype records. Undefined options mean omission.
roleColors includes only own nonempty string keys and nonempty string values;
palette overrides use only declared keys. Actual CSS color support belongs to
Canvas. Options are not read again after construction.

One instance rejects nested layout or render calls with Error before inspecting
arguments; another idle instance is independent. The busy guard is released in
finally, including opaque thrown values. Neither method owns sources, traces,
RAF, Workers, DOM listeners, context lifetime, CSS or bitmap resizing. There is
no dispose method. Render may retain at most two immutable endpoint snapshots
and one matching pair, never an unbounded history or slot-ID table. layout does
not retain its input after return and has no reference-identity/cache promise.

The entry needs DOM declarations because render names CanvasRenderingContext2D.
Importing it and calling layout access no DOM globals and allocate no external
resources. This does not make the entry's declarations ES2022-only. /tree remains
independent and DOM-free. OffscreenCanvas, SVG and retained DOM rendering are not
selected here; custom backends use treeScene. No reciprocal /tree dependency on
Canvas or change to /canvas, /canvas/graph, Player or the existing unions is made.
The optional entry may load tree validation/projection and generic scene matching,
not Player, Worker, array/graph backends or the tree trace builder. Other entries
must not load it without an explicit static/dynamic import.

## Node radius

Since 1.10.0, `nodeRadius` sets the preferred radius of every tree node in
logical Canvas pixels. It must be finite and positive and defaults to 16.
The renderer uses the smallest of this value, width / 8 and height / 8. This radius is used for
links, double outlines, captions and the geometry passed to `drawNode`.
The coordinates returned by `layout()` are independent of this option.

## Pure layout: ordered and binary

layout accepts a complete TreeInput, not a partial edit or TreeSnapshot. It first
validates kind, root, IDs, links, ordered/binary constraints and reachability in
/tree order, without inspecting application payload. Trace phase/retired-ID
history is not part of this stateless input check. The result is a copied, frozen
complete TreePosition array in **tree.nodes storage order**, one entry per ID.
It contains no marks, virtual nodes, captions, DOM measurements or events.
Empty input returns []. Coordinates do not depend on node/link label/data,
theme, viewport, font metrics, caption/slot visibility, visit order or a prior draw.

The selected logical-coordinate algorithms are part of the layout method's
contract; they are not undocumented pixel defaults:

- Ordered: child order comes from filtering links by parent. Assign leaves
  consecutive unit ranks 0,1,... in depth-first child order. A leaf keeps its
  rank; an internal node gets the midpoint of its first and last child's ranks
  (one child therefore shares x). Let r be that rank and rRoot the root's rank.
  Return x = (r - rRoot) * horizontalGap, y = depth * levelGap.
- Binary: consider the finite extended tree with one terminal virtual leaf for
  each absent left/right child of each real node. Virtual leaves have no children;
  they are not expanded to a complete 2^depth tree. Number this extended tree in
  in-order, starting at zero, visiting left slot, real node, right slot. If i is
  a real node's ordinal and iRoot is the root's ordinal, return
  x = (i - iRoot) * horizontalGap, y = depth * levelGap. Output only real nodes.
  The conceptual extended tree has 2*N+1 entries for nonempty N-node binary input.
- Both modes put the root at (0,0). Depth follows the validated root, not node
  array position. Floating-point rounding applies; representational collapse and
  small fitted distances do not change logical sibling/slot meanings.
- Unsupported topology is rejected before producing output. Nonfinite resulting
  coordinates or unrepresentable arithmetic give RangeError. No recursive-depth
  limit, text measurement, force layout or exponential empty-level allocation
  is part of this API. The implementation uses iterative, depth-safe traversal.

With default gaps, these independently specified positions are checked against
the implemented layout:

| Tree | Expected real positions |
| --- | --- |
| Empty, either kind | [] |
| Single root R, either kind | R=(0,0) |
| Ordered R children A,B; A child X | R=(0,0), A=(-0.5,2), B=(0.5,2), X=(-0.5,4) |
| Binary R with only right B | R=(0,0), B=(2,2) |
| Binary R with only left B | R=(0,0), B=(-2,2) |
| Binary R with left A and right B | R=(0,0), A=(-2,2), B=(2,2) |

Binary in-order layout deliberately preserves left/right and empty slots; it does
not promise that a parent is the midpoint of its real child roots. Ordered layout
has no implicit binary slots. Changing gaps or topology changes positions only
when the application explicitly calls layout and records the returned values.

## Recording layout atomically

This example requires npm 1.2.0 or the corresponding local build/archive.
Do not spread candidate.kind into edit: the headless trace rejects a defined value.

```ts
import { createTreeTrace } from "@grundyjs/algiviz/tree";
import { createTreeRenderer } from "@grundyjs/algiviz/canvas/tree";

const renderer = createTreeRenderer({ theme: "light", emptySlots: "visible" });
const input = {
    kind: "binary", rootId: "A",
    nodes: [{ id: "A", label: "2" }, { id: "B", label: "3" }],
    links: [{ id: "relation", parentId: "A", childId: "B", slot: "right" }],
} as const;
function* rotate() {
    const tree = createTreeTrace(input, { layout: renderer.layout(input) });
    yield tree.start();
    const update = {
        rootId: "B",
        links: [{ id: "relation", parentId: "B", childId: "A", slot: "left" }],
    } as const;
    const candidate = { ...tree.state.tree, ...update };
    yield tree.edit({ ...update, layout: renderer.layout(candidate) });
    yield tree.done({ result: { nodeIds: ["B"], linkIds: ["relation"] } });
}
```

Existing Player.stepSource/isTerminal carries these steps. Its render callback
can call renderer.render(context, frame, logicalSize). The application owns that
context and logical size, for example through /canvas/viewport. Computing layout
is synchronous source work before yield; maxStepsPerFrame cannot interrupt one
expensive layout/edit/render. The helper does not run inside render or on resize.
Changing renderer policy never rewrites already retained snapshots. For a general
TreeEdit, resolve omitted/undefined rootId/nodes/links against the current tree
before calling layout; plain object spread alone does not implement edit's
undefined-as-omitted rule. The example uses only explicitly defined update fields.

## Double outlines for trie terminals

Available since 1.10.0.

Pass `doubleOutlineNodeIds` in the fourth argument of `render` to draw an
inner stroke and an outer ring around selected nodes. Both outlines follow the
node's role, result and opacity. Their outer radius is reserved for captions,
link labels and empty-slot markers. Node positions and link anchors stay
fixed. Omit the option for the default drawing.

For an ordered trie, keep the end-of-word flag in each snapshot's node data.
Derive the IDs inside Player's render callback so that seeking via
`stepHistory` restores the selection from the displayed frame.

```ts
render: frame => {
    const doubleOutlineNodeIds = frame.current.tree.nodes
        .filter(node => node.data?.terminal)
        .map(node => node.id);
    renderer.render(context, frame, logicalSize, { doubleOutlineNodeIds });
}
```

The option accepts a dense array of nonempty IDs. Repeated IDs have the same
effect as a single ID. An ID absent from both snapshots has no effect. If a
node leaves the scene, include its ID while it should retain the ring as it
fades out.

## Custom node drawing

Since 1.10.0, `drawNode` runs once for each visible
node and receives the read-only `view`, `center`, `radius`, `outerRadius`,
the Canvas context `ctx`, and `drawDefault()`. Geometry uses the same logical
pixels as `TreeRenderSize`. `outerRadius` includes the reserved space for the
double outline, if selected.

`drawDefault()` draws the node body and any double outline at the point where
you call it. Draw after the call to add a foreground detail, or omit the call
to supply the whole body. The renderer draws node text and captions separately.
Keep custom details within the reserved outline if they need to coexist with
automatically placed labels.

```ts
const renderer = createTreeRenderer<{ terminal: boolean }>({
    theme: "light",
    nodeRadius: 21,
    horizontalGap: 2.7,
    drawNode({ ctx, view, center, radius, drawDefault }) {
        drawDefault();
        if (!view.node.data?.terminal) return;
        ctx.fillStyle = "#db2777";
        ctx.beginPath();
        ctx.arc(center.x + radius * .55, center.y - radius * .55,
            radius * .15, 0, 2 * Math.PI);
        ctx.fill();
    },
});
```

The callback runs synchronously with the node's interpolated position and
opacity already applied. Balance any `ctx.save()` / `ctx.restore()` calls
inside it and use the drawing helper during the callback only. Other nodes and
the renderer's labels get their own Canvas drawing state. An explicit node data
type constrains the snapshots accepted by the returned renderer.
The entry exports `TreeNodeDrawContext<N>`, `TreeNodeDrawer<N>` and
`TreeRendererWithNodeData<N>` for explicit type annotations.

To match a site's typography, store the character in node data and set the
node's `label` to an empty string. The callback can then paint its own text
and role-based fill and outlines.

## Empty binary slots

A missing left/right link means one missing slot of its **real parent**, not a
null-ended link, allocated node or next empty level. No object or ID is added to
TreeSnapshot, treeScene or TreeObjects. Internal decoration identity is the tuple
(owner node ID, left/right), not an occupied relation's link ID. Slots cannot be
marked or selected as results. Ordered trees and empty trees have no such markers.

For a missing slot, its raw anchor is parent position plus
(-horizontalGap, levelGap) for left or (+horizontalGap, levelGap) for right. With
layout's binary output these are exactly the extended tree's virtual-leaf points.
Custom snapshots remain valid; choose gaps that suit their coordinate units.
The renderer does not repair a custom layout that places a right child on the left.

emptySlots:visible draws a muted dashed stub from the parent's corresponding
lower diagonal port to a small hollow square. Both absent children of a leaf may
be shown. Hidden suppresses these decorations, not the reservations in layout or
fit bounds, so visibility alone does not reflow the real nodes. Stock decoration
sizes are presentation defaults. A marker/stub may be omitted when it cannot fit
safely; the state and reserved layout do not change. No tooltip/report API is added.

Match virtual slots independently at the two endpoints. A slot absent at both
ends follows its interpolated owner at alpha 1; newly empty slots fade in with
p and newly occupied slots fade out with 1-p. An entering/exiting owner carries
the same enter/exit alpha for its slots. There is no placeholder-to-real-node
morph or persistent previous-null cache. Safe omission may switch discretely.

## Fitting, nodes and relation interpolation

render validates both complete snapshots, then uses one uniform contain transform
for the joint endpoint bounds: all real node centers and all missing-slot anchors,
including hidden slots and zero-presence entering/exiting endpoints. Center
single-point/degenerate axes and retain padding for glyphs. The transform is fixed
for every p in this endpoint pair; it uses explicit logical size, never DOM reads.
Pair bounds can change at a step boundary, so global camera continuity is not
promised. Tiny canvases/coincident custom positions need not remain legible.

A retained node linearly interpolates its recorded previous/current position
using raw progress p; entering/exiting nodes use their available position and
alpha p/1-p. No easing, source reads or progress-dependent hierarchy layout.

Relations use parent-to-child cubic paths: ordered parent bottom port or binary
left/right lower diagonal port, toward the child top port. Ports lie on the real
node circle; controls stay finite. No arrows, loops or parallel-lane API is needed
for this valid tree model. Stroke/radius/font/padding equations are presentation
defaults, not a pixel identity promise. Custom geometry may cross or overlap.

- If parentId, childId and binary slot are unchanged for a retained link, draw
  one route between its currently interpolated endpoint nodes at alpha 1.
- If any endpoint/slot changes, retain the logical link ID but draw **two routes**:
  the previous relation at alpha 1-p and the current relation at alpha p. Each
  branch resolves its own endpoint IDs/generation through scene.get, then uses
  those nodes' currently interpolated positions (or their available enter/exit
  positions). Each start port uses that branch's old/new slot.
- Entering links draw the current route at p; exiting links draw the previous
  route at 1-p. Resolve exiting endpoint nodes even at presence zero.
- Never interpolate node IDs, use only the new references for both branches,
  or blend unrelated parent centers into a single detached endpoint. One scene
  treeLink may paint two internal branches; no extra public scene kind is added.
  Crossfading can show temporary parallel/crossing routes; it is not a third tree.

Primary labels, roles, result membership and caption text use current state for
retained/entering objects throughout the frame, including p=0. Exiting objects
use previous state. Current empty/null text does not fall back to stale text.
Retained rewiring branches use the current logical link's styles/text; link text
may appear on both visible routes. Opacity is branch presence, not source history.
Geometry and omissions are deterministic for fixed endpoints/options/progress,
logical size and supplied font metrics, independent of playback visit order.

## Labels, captions, slots and safe omission

Primary text is node.label, falling back to node.id only when label is undefined;
empty label suppresses it. Do not inspect/stringify node.data or link.data.
Only an explicit link.label supplies relation text: no ID or weight fallback.
Node captions come from state.nodeCaptions through treeScene, not Event/callbacks.
Caption null means absent; empty/whitespace-only strings paint nothing.

All text is plain one-line text. Normalize runs of TAB/CR/LF/U+2028/U+2029 to a
space for drawing only; retained source strings stay unchanged. The initial font
is 12px sans-serif. Primary text uses a width bound inside the circle; the full
measured ink cell is conservatively reserved. Secondary text is not truncated or
squeezed: reserve measured ink/advance bounds, at least 16px cell height, 4px
horizontal and 2px vertical padding, and omit boxes wider than 120 logical CSS px
or the usable viewport. All text uses palette.text, independent of result color.

Before the first pixel write, plan reservations deterministically:

1. Real node circles, primary text bounds and every nonzero-presence real route
   are obstacles. Include both visible rewiring branches, not a sampled centerline.
2. In stored link order, previous branch then current branch, try two label-box
   candidates on opposite normals of the curve midpoint, offset enough for the
   box and safety gap. A zero tangent has a deterministic axis fallback. Accept
   the first safe candidate; otherwise omit that branch label.
3. For visible slots use current node order, then exiting owners, left before
   right. Reject a stub/square that intersects real nodes/primary text, real
   routes, accepted link labels or earlier slot decorations, except its intended
   contact with its own parent circle. Include the entire stub, not just its tip.
4. For node captions use current node order, then exits. Try below, above, right,
   left, lower-right, lower-left, upper-right, upper-left. Accept the first safe
   full box or omit it. Avoid nodes, real routes, link labels, accepted slot
   decorations and earlier captions. No role/result priority or pinned winner.

Keep accepted secondary boxes/decorations at least 4 CSS px inside the viewport
and a conservative 2px safety gap from unrelated painted/reserved bounds. Curve
exclusion must be conservative over the whole path; unchecked sparse samples are
not sufficient. Reservations never move nodes, enlarge the bitmap or reroute links.
Clear the full bitmap, then paint background, real routes, accepted slot decorations, real nodes/primary text,
then accepted link labels and node captions with background-colored box backing.

If reliable primary ink bounds are unavailable, omit optional text/decorations
whose safety cannot be established. Unusable secondary bounds omit that item.
Required metric fields are width and actualBoundingBoxLeft/Right/Ascent/Descent.
After all supplied numeric values of those fields are checked, missing/nonnumeric bounds
mean omission without coercion. Nonfinite numeric metrics, negative width or
unrepresentable computed geometry give RangeError before pixels. A measureText
throw propagates unchanged. Hidden captions need no caption-only measurements;
primary/link-label/slot safety measurements may still be needed.

This is a reservation guarantee under the supplied metrics, not a proof of every
antialiased pixel, font, size or intermediate layout. Default-size fixtures must
remain readable; omission is not permission to hide all captions/slots generally.
Runtime and real-Canvas evidence is recorded in the implementation report.

## Green result and styles

Stock result is green: dark #34d399, light #047857. Palette fields are independent
from GraphPalette: tree uses link and emptySlot. Defaults for background/text/node/
link/active/visited/queued follow the stock graph themes; emptySlot is dark
#64748b, light #94a3b8. Overrides must be nonempty primitive strings.

For each real entity: result selection > roleColors[role] > stock active/visited/
queued role color > base node/link. Text stays text-colored. Unknown roles fall
back to base; a role called result is not a result selection. Selected nodes fill
green and selected links stroke green, independently; neither selects incident
entities. Empty slots always use emptySlot and never inherit a parent's green.

No final-step color memory is kept. done preserves result in State, so final
hold/repaint/resize remain green. Previous restores its own result flags and
Restart restores a fresh initial state. Pause retains the frame. dispose/source
cleanup and event-free history/async/Worker delivery keep current Player contracts.

## Validation, context state and errors

Factory validates options envelope, theme, palette overrides, own role colors,
horizontalGap, levelGap, emptySlots, nodeCaptions, drawNode and nodeRadius in that order. Missing/invalid
theme, enum values, containers, accessors or empty/non-string colors give TypeError.
Wrong gap type gives TypeError; nonpositive/nonfinite gap gives RangeError.
layout validates TreeInput as /tree, then computes/validates complete positions.
Original Proxy throws, including opaque/falsy values, remain original.

render order: busy guard; size envelope and width/height; frame envelope and
progress; optional doubleOutlineNodeIds; previous snapshot; current snapshot; matching tree kind;
then ctx.canvas bitmap dimensions and numeric drawing plan. Only previous/current/
progress are consumed from Frame: event and stepIndex are not read or validated.
Frame/size must be plain records with recognized own data properties. Capture
frame fields in progress/previous/current order; accessors are rejected before
scalar validation. Both endpoint kinds must match, even for empty trees; mismatch
is RangeError. A renderer may draw either kind in separate calls.
Snapshot validation/canonical order is exactly /tree, including hidden text/slots.
Wrong scalar types give TypeError; negative/nonfinite sizes, out-of-[0,1] progress
or unrepresentable geometry give RangeError. No new error class/code is added.

Zero logical or bitmap size is a no-op after frame/snapshot/kind/bitmap validation,
without save, measurement or paint; skipped fitting has no geometry guarantee.
Malformed data makes no Canvas method calls. Bitmap property getters and later
Canvas method throws retain native identity. No bitmap/CSS resize is performed.
For a drawable bitmap use save, set the bitmap/logical transform, neutralize
alpha/composite/filter/shadow/dash/text state, plan text, clearRect the full logical
rectangle, paint, then restore. Clearing occurs only after planning succeeds and
also makes transparent background overrides independent of earlier pixels.
The caller supplies an unclipped context and owns its current path: save/restore
does not restore paths. The renderer retains neither context nor canvas after return.

If save throws, do not restore an unacquired save. After a successful save always
attempt restore. A drawing/measurement/state-setup failure wins over a secondary
restore failure, including falsy exceptions; a standalone restore failure escapes.
Working restore is assumed; pixels already painted are not rolled back. Input/
geometry failures retain no partial drawing plan. The current implementation
retains no endpoint/history cache; host failure does not mutate caller snapshots.
Subsequent calls remain usable after ordinary host recovery, with busy released
in finally.

## Verification and release boundary

The [implementation report](checks/tree-canvas-implementation-2026-11-19.json)
records permanent layout/render/control regressions, packed consumers, bundle
isolation and native Canvas. The old contract report is historical design evidence.
The implementation currently retains no endpoint/history cache after a call.
Regression coverage includes:

| Area | Required cases |
| --- | --- |
| Layout | Empty/singleton, ordered reorder/unary chain, sparse left/right binary trees, rotations/root changes, custom gaps, arbitrary storage order, deep/skewed trees, finite overflow, frozen copies and no payload/DOM reads |
| Slots | N+1 terminal slots for nonempty binary trees, no ordered/empty markers, hidden-layout parity, slot-owner identity, occupied/empty transitions, collision omission and no extra model objects |
| Links | Persistent/reparented/reversed/slot-changed links, both endpoint generations, enter/exit endpoints, p=0/0.5/1, attached crossfade routes, no detached hybrid endpoint |
| Text/result | Label/caption clearing, current versus exiting text, safe measured placement, missing/bad metrics, green independent selections in both themes, rewind/Restart/resize without stale colors, transparent-background repaint |
| Host | Invalid data before Canvas, zero sizes, DPR/backing-store ratios, context setup/restore and primary opaque errors, recursive layout/render, recovery and bounded caches |
| Package/control | Standalone optional entry, no reverse headless dependency, real installed consumer types/private paths, supported compiler matrix, unchanged existing modules, Pause/Next/history/rewind/Restart/dispose |

Real Canvas fixtures cover ordered and sparse binary seven-node trees at
960x480 and 390x280, both themes and backing-store ratios 1/1.25/2. All three
short captions and the link label paint; all eight binary empty markers paint.
An independent native raster-mask oracle checks text boxes against node/primary
text, route and decoration obstacles. Tiny/overlapping custom layouts permit
safe omission; p=0.5 rotations are checked separately for attached crossfades.
Player checks cover stream/history, Pause, Next, rewind, Restart, viewport/DPR
resize and dispose. Recovery checks cover host exceptions and bitmap/context
reset, not forced GPU context loss or a cross-browser certification.

To rerun after npm run build, start:

```sh
node scripts/test-tree-canvas-browser.mjs --report ./tree-canvas-native.json
```

Open the printed localhost URL. The page runs automatically and writes the local
report. Its fixture and oracle remain in test/tree-canvas-browser.mjs.

Changes still follow the documented-default/behavior policy in [U3](api-compatibility.md).
Lack of pixel identity is not permission to change layout coordinates, result
priority, omission safety or error classes without compatibility review.

The [insertion/rotation example](../examples/tree-player.html) uses these APIs with Player;
the detailed custom traversal remains separate. The [1.2.0 release notes](release-1.2.md)
record the outcome of the T1 fix and acceptance checks.
