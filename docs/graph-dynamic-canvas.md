# Dynamic topology in /canvas/graph

[Русский](ru/graph-dynamic-canvas.md) · [Headless contract](graph-dynamic-topology.md) · [Canvas API](graph-api.md#declarations-canvasgraph) · [Edge contraction](examples.md#edge-contraction)

Available since 1.5.0. Select the mode explicitly when
creating the renderer. The default applies to independently authored snapshots
as well.

## Public API

The new optional `GraphRendererOptions.topologyTransitions` field enables
dynamic transitions. The factory uses the same return type.

```ts
import type { GraphPalette, GraphRenderer } from "@grundyjs/algiviz/canvas/graph";

export interface GraphRendererOptions {
    readonly theme: "light" | "dark";
    readonly colors?: { readonly [K in keyof GraphPalette]?: string | undefined } | undefined;
    readonly roleColors?: Readonly<Record<string, string>> | undefined;
    readonly nodeCaptions?: "auto" | "hidden" | undefined;
    readonly topologyTransitions?: boolean | undefined;
}

export declare function createGraphRenderer(options: GraphRendererOptions): GraphRenderer;
```

| Value of `topologyTransitions` | Mode |
| --- | --- |
| Omitted, `undefined` or `false` | Default renderer behavior, including curve interpolation when edge endpoints change. |
| `true` | Dynamic transitions as defined below. |

The factory captures the setting once. Own data property rules apply. Other
values, including `null`, `0`, the string `"true"` and a boxed `Boolean`, throw
a synchronous `TypeError`. An own accessor is rejected without invocation.
Inherited fields are ignored on accepted plain records. The factory checks
the new descriptor and value after the existing options, so an existing
validation error wins when both are invalid. An exception from a Proxy
descriptor trap propagates unchanged.

`theme` remains required. The defaults are the theme's colors, an empty
custom role map and `nodeCaptions: "auto"`. Both modes use
`GraphPalette`, `GraphRenderSize`, the closed caption setting and
`GraphRenderer.render<N, E, Event>(context, frame, size)`. The mode is set per
renderer and accepts ordinary and dynamic `GraphSnapshot` frames, including
frames without an event. The application opts in independently of the trace
factory and event type.

`topologyTransitions` is reserved in the options record. A field with that
name is interpreted according to the table above. A standard call still
takes the existing options object.

```ts
import { createGraphRenderer } from "@grundyjs/algiviz/canvas/graph";

const standard = createGraphRenderer({ theme: "dark" });
const dynamic = createGraphRenderer({ theme: "dark", topologyTransitions: true });
```

The option compiles alongside existing factory and options types. `render`
accepts ordinary and dynamic frames, as well as frames with `event: undefined`.

## Frames and object visibility

The mode takes the existing `Frame<GraphSnapshot<N, E>, Event>` and uses
`graphScene` for each snapshot. It matches identities using the two snapshots.
The same rules apply to frames with an `edit` event or with `event: undefined`.
In this table, `p` is `Frame.progress` in the range from 0 to 1.

| Object | Position or route | Opacity |
| --- | --- | --- |
| Entering node | Current position | `p` |
| Exiting node | Previous position | `1 − p` |
| Retained node | Linear position interpolation | 1 |
| Entering edge | Current endpoints and lane | `p` |
| Exiting edge | Previous endpoints and lane | `1 − p` |
| Retained edge with the same endpoints and direction | One route with a smooth lane shift | 1 |
| Redirected edge | Old and new routes for one edge ID | `1 − p` and `p` |

Strokes, arrows and displayed text use their object's or route's opacity.
Edge opacity is independent of node opacity. Both snapshots are validated
first. Zero-opacity objects and routes contribute to the fitting bounds.
Painting and caption placement use visible objects and routes.

## Redirects with the same ID

A directed edge uses an ordered endpoint pair. Reversing the arrow changes
the route. An undirected edge uses an unordered pair. Swapping `from` and
`to` keeps one route, with a consistent orientation for lane calculations.
A change between directed and undirected uses a crossfade. An omitted `directed`
field and `false` are equivalent. A transition to or from a loop follows
the same rules.

The scene still has one `graphEdge` with phase `update`. Drawing can use
two routes for it. Resolve the old route's endpoints in previous, and the new
route's endpoints in current. When a node exists in both snapshots, both
routes use its interpolated position. Entering and exiting nodes use their
position from the available snapshot. An arrow follows its route's tangent
at the target node boundary.

For `e: A → B` changing to `e: A → C`, the midpoint has two translucent
routes. The old one ends at B and the new one at C. At `p = 0` only the old
route is visible, and at `p = 1` only the new one is visible. These are
visibility rules within the transition's shared fitting transform.

The old route uses the previous role, result and direction. The new route
uses the corresponding current data. Result color priority applies to each
route. Other retained objects use the current role and result. A redirected
edge displays at most one label. Select the old route's text for `p < 0.5`
and the new route's text for `p ≥ 0.5`, with the selected route's label
position and opacity. The usual label and weight rules apply, including
explicitly hiding text with an empty label.

Draw edges first, followed by nodes and captions. Edges follow scene order.
Within a two-route edge, draw the old route first. Node caption placement
accounts for both visible curves, their arrows and the displayed edge label.

## Parallel edges and loops

Each snapshot supplies its own `routeIndex` and `routeCount`. Ordinary and
antiparallel edges with the same unordered endpoint pair share a group.
Loops are grouped by their node. A redirect can free a lane in the old
group and occupy one in the new group.

Entering, exiting and redirected routes use the lane of their own snapshot.
A retained route with the same endpoints and direction interpolates the
geometric lane offset. For loops, interpolate the corresponding loop geometry.
The integers `routeIndex` and `routeCount` remain snapshot data. Temporary
overlap is valid, for example when retained edges exchange lanes or an arrow
reverses.

The shared transition transform fits node positions in both snapshots and
reserves room for old and new lanes, loops, arrows and strokes. It stays
fixed for the same pair as `p` changes. The application supplies the Canvas
size and DPR. Current readability limits apply in tight viewports.

## Rewind, Restart and Canvas

For the same ordered pair of snapshots, progress, logical size, bitmap,
options and font metrics, rendering produces the same result regardless of
frame order. Previous and Seek draw the supplied pair. Restart draws the
initial frame. With nonzero logical and bitmap dimensions, every frame
clears the bitmap on the caller's unclipped context before drawing the background and graph, including
an empty graph or a transparent background. An earlier route or result
highlight therefore disappears after a jump in history.
Resizing fits the given pair again. Current input validation, Canvas error
handling, context restoration and two-snapshot cache rules apply.

In the `A → B` to `A → C` example, the default draws one fully opaque
interpolating curve for that ID. With the option enabled, the midpoint
shows two attached routes, each at opacity 0.5.

## Regression checks

[Canvas command tests](../test/graph-topology-canvas.test.mjs) run both in the
repository and against the installed archive. After building, serve the
[native fixture](../test/graph-canvas-browser.html) with
`scripts/test-grid-canvas-browser.mjs --report <path>`.

- Drawing command parity for an unchanged call, `undefined` and `false`.
  Check explicit opt-in, capture at construction, error classes and precedence.
- Add and remove nodes with incident edges at `p = 0, 0.25, 0.5, 1`,
  including transitions from and to an empty graph.
- Redirect to an entering node while removing the old target, move a shared
  endpoint, transition to a loop, reverse an arrow and swap the endpoints
  of an undirected edge. Check attachment, opacity and labels.
- Shrink and expand parallel groups, including antiparallel edges and multiple
  loops. Check retained lane motion, fitting, and captions near both routes.
- Revisit frames through Seek and Previous, restart with the original result
  state, and redraw after resize. Verify both themes, DPR, transparent
  background cleanup and context restoration on a real Canvas.
