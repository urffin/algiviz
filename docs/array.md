# Array operations and Canvas

[README](../README.md) · [Русский](ru/array.md)

## User-defined algorithms


New applications use these entry points, which do not import bundled algorithms:

- `@grundyjs/algiviz/array`: array operations and generator definitions.
- `@grundyjs/algiviz/playback`: generic playback of any immutable states and events.
- `@grundyjs/algiviz/scene`: typed objects and user-provided visualizations.
- `@grundyjs/algiviz/canvas`: the ready-made array renderer.

You own the loops, conditions and operation order. No library registration or
changes to AlgiViz are required. For example, reversing an array:

```js
import { defineArrayAlgorithm, createArrayPlayer, createArrayTimeline } from "@grundyjs/algiviz/array";
import { createArrayRenderer } from "@grundyjs/algiviz/canvas";

const reverse = defineArrayAlgorithm(function* (array) {
    yield array.start();
    for (let i = 0; i < Math.floor(array.length / 2); i++) {
        yield array.highlight([i, array.length - 1 - i]);
        yield array.swap(i, array.length - 1 - i);
    }
    yield array.done();
});

const options = { stepDurationMs: 350, finalHoldMs: 1000 };
const ctx = canvas.getContext("2d");
const renderer = createArrayRenderer({ theme: "dark" });
const player = createArrayPlayer(reverse.iterate([1, 2, 3, 4]), {
    ...options,
    render: frame => renderer.render(ctx, frame)
});
// Your animation loop calls player.advance(deltaMs * speed).
// No calls while paused; advance(0) redraws after resizing.
// On teardown: cancel your animation loop and call player.dispose().

// Alternatively, retain history and seek:
const timeline = createArrayTimeline(reverse.steps([1, 2, 3, 4]), options);
renderer.render(ctx, timeline.sample(500));
```

`defineArrayAlgorithm` returns `iterate(values)` and `steps(values)`. Each
iterator owns a separate workspace and copies/validates input on the first
`next()`. `steps` collects the iterator into a frozen array. Yield every
operation immediately, begin with `start`, and end with `done`. Each operation
updates the workspace and returns an immutable snapshot; it does not draw.
The player invokes the supplied `render` initially and on every `advance` or `nextStep`.
Rendering errors close the iterator and propagate to the caller.

## Array operations

| Operation | Effect |
| --- | --- |
| `at(index)`, `held`, `length` | Read a frozen item, the held item or array length |
| `start(regions?)` | Emit initial state; call once |
| `compare(left, right)` | Highlight two positions and count one comparison; either position can be `"held"` |
| `highlight(positions)` | Highlight items for this step without changing counters |
| `swap(left, right, regions?)` | Exchange occupied positions; count two writes (non-adjacent swaps are supported) |
| `select(from, regions?)` | Hold an item and leave a hole; no counted writes |
| `shift(from, to, regions?)` | Move an item into the hole; count one write |
| `insert(to, regions?)` | Fill the hole with the held item; count one write |
| `pass(end, regions?)` | Describe a completed pass without changing items or counters |
| `done(regions?)` | Finish; requires no held item; does not sort or infer sorted regions |

`regions` can contain `sortedPrefixLength` and `sortedSuffixLength`.
Omitted or explicitly `undefined` markers retain their previous values, including
when TypeScript's `exactOptionalPropertyTypes` is enabled. The author decides when regions
are sorted; AlgiViz validates their bounds but does not prove that claim. Positions
are zero-based; invalid positions, occupied destinations and invalid operation
order throw before mutating the workspace. `"held"` is accepted only by `compare`
and `highlight`; `swap` and `shift` require integer indices for both positions.
Read snapshots rather than modifying items yourself. `createArrayTrace(values)` exposes the same operations directly,
with immediate input validation, for authors writing their own generator wrapper.

## Array model guarantees

These guarantees describe snapshots produced by `createArrayTrace`, including
traces created through `defineArrayAlgorithm`. They do not validate arbitrary
handwritten objects supplied to a renderer or player.

### Fixed length and one held item

Input values must be finite numbers; sparse entries, `NaN` and infinities are
rejected. The input is copied. A trace has a fixed number of items: `length` and
`state.slots.length` remain equal to the original input length. Operations reorder
items but do not add/remove them or change their values.

`held` is either `null` or one item. `select` moves an occupied slot into `held`
and leaves `null` at that position. While an item is held, exactly one slot is
`null`; otherwise all slots are occupied. `shift` moves an occupied slot into
that hole, moving the hole to its source position. `insert` fills the hole with
the held item and resets `held` to `null`. Selecting another item while holding
one, swapping an empty position or calling `done` with a held item throws.

`insert` returns an existing held item; it does not insert a new value or grow
the array. An empty input is supported: emit `start` followed by `done` without
indexed operations. `pass(end)` takes a zero-based position, not a length or pass
count, so it cannot be called on an empty array.

### Stable identities and immutable snapshots

Every original item has an `id` unique within that trace. The identity stays with
the item through swaps, selection, shifts and insertion; equal numeric values
still have distinct IDs. Every original item occurs exactly once across occupied
`slots` and `held`. IDs are not globally unique across traces or restarts. When
combining several traces into one scene, the application must namespace their IDs.

Each successful operation returns a frozen step, event, state and `slots` array;
items and highlight ID arrays are frozen too. Later operations do not change
earlier snapshots. Items may be shared between snapshots because they are immutable.
The snapshots describe the state immediately after the operation; `index` starts
at zero and increases by one for each emitted step.

### Counters

`comparisons` and `writes` start at zero and accumulate within a trace:

| Operation | Comparisons | Writes |
| --- | --- | --- |
| `compare` | +1 | 0 |
| `swap` | 0 | +2 |
| `shift`, `insert` | 0 | +1 |
| `start`, `select`, `highlight`, `pass`, `done` | 0 | 0 |

`compare` records a comparison; it does not compute or return an ordering result.
The algorithm reads item values and decides what to do. Reads through `at`,
`held` and `length` emit no step and change no counters. Counters measure trace
operations, not literal JavaScript assignments: representing selection as a hole
does not count as an array write. Rejected operations preserve workspace items,
markers, counters and the next step index; the trace can continue afterwards.

### Sorted-region markers

`sortedPrefixLength = k` marks the first `k` positions; `sortedSuffixLength = k`
marks the last `k` positions. These are author-supplied annotations. The library
checks that a supplied length is an integer from `0` through `length`; it does
not compare values, prove sortedness or infer that an item is in its final place.

The prefix starts at `0`. The suffix may be absent until first assigned; treat
an absent suffix as `0`, as the Canvas renderer does. Omitted or explicitly
`undefined` input fields preserve their previous values; pass `0` to reset a
marker. Prefix and suffix are independent: decreasing them or allowing them to
overlap is permitted, and their sum is not required to be at most `length`.
The application is responsible for making these annotations meaningful.

Markers do not reorder items or affect counters. `pass` and `done` do not update
them unless `regions` is supplied. In particular, `done()` only completes the
trace: a reverse operation may finish successfully with unsorted values and
zero sorted markers. A sorting algorithm should explicitly mark the regions it
has established.

Insertion and bubble sort implementations live in [examples/algorithms.mjs](https://github.com/urffin/algiviz/blob/master/examples/algorithms.mjs).
The algorithms belong to the application; they require no changes to the library.

## Canvas rendering

The array renderer expects immutable snapshots. It uses Canvas bitmap dimensions
for layout, draws a full frame and restores context state. Negative values use
magnitude for bar height and retain their sign in labels; this is not a signed-axis
plot. Dense charts hide labels. For recording, use a canvas with fixed export
dimensions. Rendering does not start an animation loop or record video.

### Custom array colors

The renderer accepts partial palette overrides on both `createArrayRenderer`
and its compatible alias `createSortRenderer`:

```ts
import { createArrayRenderer, type ArrayPaletteOverrides } from '@grundyjs/algiviz/canvas';
const colors: ArrayPaletteOverrides = { background: '#ffffff', text: '#182230', active: '#e87900' };
const renderer = createArrayRenderer({ theme: 'light', colors });
renderer.render(ctx, currentFrame);
```

`ArrayPalette` defines six string roles: `background` (full canvas), `text`
(all labels), `bar` (ordinary bars), `sorted` (sorted prefix/suffix), `active`
(highlighted/compared/moved items), and `held` (the held item, taking precedence
over active and sorted). `ArrayPaletteOverrides` is its partial form;
`ArrayRendererOptions` describes the options object. Values are Canvas color
strings, passed through without CSS validation. Omitted or undefined roles use
the selected theme. Existing theme-only calls and default colors are unchanged.

Overrides are copied when creating a renderer. Changing the input object later
has no effect. To switch theme or palette, create a new renderer and render the
same current frame. This changes colors only, not playback, snapshots, layout or
bitmap/DPR handling. Try the theme presets, six color inputs and reset control
in [Sorting lab](https://github.com/urffin/algiviz/blob/master/examples/index.html).
