# Result markers in /array: selected contract

[Русский](ru/array-result.md) · [Current array API](array.md) · [Current status](current-api.md) · [Compatibility policy](api-compatibility.md)

**Available since 1.0.0; unchanged in 1.3.1.**
The package supports done({ result }), resultItemIds and colors.result.
[Current API](current-api.md) defines release status; dated evidence below retains
its original verification scope.

## Application API

Extend the existing completion call, without adding another step or method:

```js
// @grundyjs/algiviz >= 1.0.0
yield array.done({ result: [min] });
```

`result` contains zero-based occupied **positions at completion time**. The
trace resolves them to stable item IDs. One item, multiple items and no items
use the same shape:

```js
yield array.done({ result: [min] });          // One selected result.
yield array.done({ result: [left, right] });  // Several selected results.
yield array.done({ result: [] });             // No selected result, including empty input.
```

These are alternative completions of separate traces, not consecutive calls.
An empty trace may complete with no result, but `result: [0]` is invalid.
Omitting result or passing result: undefined means no result marker. It does
not preserve or infer the last highlight. `null` is invalid; use an empty array.

Sorted-region options remain available in the same object. Existing calls such
as `done()` and `done({ sortedPrefixLength: array.length })` keep their meaning.
Result selection does not claim sortedness, reorder items, compare values,
choose a minimum automatically or affect comparison/write counters. The
algorithm remains responsible for the answer; the library only records it.

These guarantees are provided by createArrayTrace, including traces passed to
defineArrayAlgorithm. Application-owned ArrayTrace implementations retain their
old structural compatibility; supporting the new optional feature in such an
implementation remains the application's work.

First scope: result selection **only on done**. No new `result()` method,
mid-trace marker management, held-result selector, arbitrary color per item,
new event discriminant, implicit last-highlight retention or asynchronous work.

## Public types and state

The intended declaration additions are:

```ts
// /array: new type-only export; SortedRegions stays unchanged.
export interface ArrayDoneOptions extends SortedRegions {
    readonly result?: readonly number[] | undefined;
}

// Replacement signature inside the existing ArrayTrace interface.
done(options?: ArrayDoneOptions): ArrayStep;

// New optional member of the existing ArraySnapshot interface.
readonly resultItemIds?: readonly string[] | undefined;

// New optional member of the existing /canvas ArrayPalette interface.
readonly result?: string | undefined;
```

The last three declarations show members in their respective interfaces, not
top-level declarations to paste verbatim. `ArrayPaletteOverrides` consequently
accepts `colors: { result: '#047857' }`. No new runtime export is added.

The event is still exactly the existing frozen `{ type: 'done' }`; ArrayEvent
remains its current closed union. The final snapshot, not the event or Player,
contains the selected IDs. ArrayStep/ArrayFrame retain their existing types.

Nonterminal trace snapshots omit resultItemIds. A completion without result
(including result: undefined) also omits it, preserving the old trace shape.
An explicit result array produces an owned, frozen resultItemIds array in the
final frozen snapshot, including a frozen empty array for result: []. IDs are
unique, in first-occurrence order; duplicate input positions are accepted and
deduplicated after validation. The caller's array is never retained. Later
mutation of that input cannot change an emitted snapshot.

The ID array is an annotation, not a result value or result-index getter.
Item references, slots, length, counters and the existing step index rules stay
unchanged. Earlier snapshots remain unchanged. IDs belong to one trace/session;
Restart may reuse ID strings but creates fresh state without a result marker.

The new snapshot/palette fields are optional specifically so older handwritten
snapshots, six-role palettes and structural fixtures remain assignable.
Consumers treat absent/undefined resultItemIds as no selection. Trace outputs
guarantee valid owned IDs; handwritten immutable snapshots may contain unknown
IDs, which simply match no visible item. No complete handwritten-state validator
or new clone/freeze policy for caller-owned snapshots is introduced.

## Validation, atomicity and errors

Keep the current lifecycle rules: done requires a started, unfinished trace and
no held item. Calls before start/after completion or with a held item retain
the existing generic Error domain; this proposal does not add an error class.

For an eligible completion, use this validation order before committing any
trace-owned state:

1. Read/validate sortedPrefixLength, then sortedSuffixLength under their current
   rules: omitted/undefined preserves the marker; an invalid length is RangeError.
2. Read result. If defined, it must be an actual dense array of positions;
   iterable-only objects, Sets, typed arrays and null are TypeError. Read its
   length and each entry once. A malformed reported array length is TypeError
   without coercion; every index must be an own array entry. Sparse
   input is TypeError, even if an inherited numeric property fills a hole.
3. Validate each position in input order. It must be a primitive integer in
   `[0, array.length)`. Strings, boxed numbers, NaN, infinities, fractions,
   negative/out-of-range values and 'held' give RangeError, consistently with
   existing array position operations. Validate every entry, including duplicates.
4. Resolve IDs and create the owned immutable annotation, then commit sorted
   markers, completion phase and one done step together.

Capture each option field once, in the order above. Getter/proxy exceptions
preserve the original unknown value, including undefined. A failure leaves
trace-owned slots, held, markers, counters, phase and next emitted step index
unchanged, so a valid completion can be retried. This is validation atomicity;
application getter side effects are not rolled back. No new ArrayTrace callback
or reentrancy guard is introduced; U1 continues to cover headless playback.

This preserves error precedence for old completion calls: lifecycle, held,
sorted prefix, sorted suffix. An invalid sorted marker wins before result is
read. No normalization into Player/Worker errors or change to source ownership.

## Stock Canvas presentation

One existing renderer reads resultItemIds from `frame.current`. Its `result`
palette role defaults to green: light `#047857`, dark `#34d399`. `colors.result`
is an independent optional override; overriding sorted or active does not
override result. Palette capture/undefined handling and the identical
createSortRenderer alias retain their current behavior.

Color priority becomes **held > active > result > sorted > ordinary bar**.
For frames without result IDs, all existing priorities and defaults are
unchanged. At a standard done event no element is active, so selected result
bars are green while unselected bars retain their normal/sorted colors. Empty
input has no green bar. Several result IDs highlight all matching visible bars.
If a handwritten frame combines a result with an active or held item, those
existing higher-priority roles win. Unknown IDs do not color another item.

Markers use current-frame state, like events and sorted regions, without color
interpolation or remembered render history. They apply when a transition enters
the marked current snapshot, and remain at its endpoint/hold. Repainting,
resizing, reverse seeking and retained-step replay all derive the same colors
from that frame. Rewinding to a snapshot without result IDs removes the marker;
Restart removes it with the fresh session. There is no implicit carry-forward.

No changes to layout, labels, value text, context restoration, arrayScene's
object/data shape, scene matching, DPR/viewport ownership or renderer lifecycle.
The Canvas header continues to say done; there is no event substitution or
second renderer. Result metadata is ordinary serializable snapshot data and
does not add Worker behavior or a new supported environment.

## Quickstart integration

The fixed nonempty quickstart keeps the local min index and its text output.
Its completion is:

```js
result.textContent = 'Minimum: ' + array.at(min).value;
yield array.done({ result: [min] });
```

Use the ordinary single renderer:

```js
const renderer = createArrayRenderer({ theme: 'light' });
const player = new Player(container, {
  viewport: canvas,
  stepSource: () => minimum([7, 3, 5, 2, 6]),
  isTerminal: step => step.event.type === 'done',
  render: frame => renderer.render(ctx, frame),
});
```

The current Player and manual quickstarts use **31 JS lines** each, a fixed
nonempty input, one renderer and the stock result marker. The original design
count of 33 supported empty input in the example; the later user instruction
removed that branch. Library empty-array support remains part of this contract.
The existing source/asyncSource/history rules are unaffected. Player and the
headless array player still finish on done, independently of whether results
are selected. `closed`, disposal, buffering and scheduling have no new contract.

## Historical compatibility and implementation acceptance

The pre-1.0.0 design stage follows. Array results shipped in 1.0.0;
[U3](api-compatibility.md) governs later changes.

Under U3 this is designed as an **additive** feature: a new type-only export,
optional options/state/palette fields, no new required ArrayTrace member and no
widening of ArrayEvent or other closed discriminants. Existing supported calls,
structural implementations, default rendering, import boundaries and old traces
must remain compatible. The old SortedRegions type stays unchanged.
Adding required result fields, a new event case or changing old done/highlight
behavior would be a different, breaking proposal. Optional new keys do not
promise compatibility for exhaustive keyof maps or undocumented custom fields.

This classification applies to this result-marker proposal only. The already
implemented Player source-union extension has its own breaking classification;
this document does not reclassify it, certify candidate 5e2fd18 or authorize a
new candidate/publication. The implementation report below records actual runtime/type/package checks;
new release evidence remains necessary before any separately authorized publication.

Acceptance must cover:

- Legacy completion, handmade snapshots/palettes/ArrayTrace implementations and
  combined sorted/result options; readonly/exact-optional declarations, the new
  type-only export and invalid input types under the selected compiler matrix.
- Empty/single/multiple results, ties, negative/zero values, duplicated positions,
  stable IDs after reordering, immutable owned arrays and unchanged counters/index.
- Invalid arrays/positions, sparse/inherited entries, getter throws including
  falsy values, combined validation order, atomic failure and successful retry.
- Both themes and independent colors.result; overlap with sorted/active/held,
  absent/unknown IDs, unchanged six-role defaults and the renderer alias.
- Stateless repaint/seek/rewind/hold, fresh Restart and normal cleanup; no new
  terminal event or dependency between headless /array and DOM /canvas.
- EN/RU minimum examples with one renderer, one done({ result }) call, direct
  frames, visible green answer and no custom result snapshot/event conversion.

An isolated strict TypeScript probe accompanies the design record below; it
does not change the actual declarations or replace implementation/full-matrix
tests. The previous 542-test runtime result belongs to the implementation stage,
not coverage of the result API; use the implementation report for fresh results.
[Design record](checks/array-result-contract-2026-11-16.json).

Implementation verification: [local report](checks/array-result-implementation-2026-11-16.json).
