# Host postMessage errors: selected U5 contract

[Русский](ru/worker-post-errors.md) · [Worker API](worker-source-api.md) · [Current status](current-api.md) · [Compatibility](api-compatibility.md)

**U5 selected and covered by permanent regressions locally, 2026-11-14; unreleased.**
Preserve the original host `postMessage` exception as `unknown`, without wrapping
it in a transport `WorkerSourceError`. Put transport context in the session's
existing report. This agrees with the current implementation on the probed paths;
it introduces no export, field, code, exception class or wire message.

## Boundary and rationale

The rule covers synchronous exceptions while obtaining/calling `worker.postMessage`
for an actual host **init, pull or cancel send**. It applies equally to native
DOMExceptions and custom host-method throws. Preserve the exact thrown value
by `Object.is`, including `undefined`, null, false, zero, strings, symbols,
opaque objects and an already constructed WorkerSourceError. Do not inspect,
stringify, clone, mutate or attach metadata/cause to that value. Separate
occurrences are not deduplicated merely because they throw the same object.

Identity preserves existing local-error handling and arbitrary application
values without adding an unbounded cause field or losing information. The
tradeoff is deliberate: `instanceof WorkerSourceError` and `caught.code` cannot
classify all failures. A DOMException may have an unrelated numeric code; a
thrown WorkerSourceError may carry its own unrelated metadata. Session report
`origin`/`phase` or cleanup-issue context identify the adapter action instead.

This does not reclassify earlier Worker/input factory or handle-validation
failures. For example, a postMessage property getter throwing during initial
handle validation is still acquisition phase `create`; the same getter throwing
when a send is attempted is phase `post`. Preflight data validation remains
`serialization`/`serialize`; remote errors, Worker error/messageerror events and
other adapter-generated failures keep their existing normalization. No error-name
heuristic turns a native send throw into a serialization or cancellation result.
The native method is synchronous/void; awaiting promises returned by an async
replacement is outside this contract.

## Active send and terminal precedence

| Situation when the exception is caught | Observable result |
| --- | --- |
| Init/pull fails before a terminal outcome is latched | Reject the pending transport read promptly with the exact value; latch failed, origin host, phase post, then start shutdown |
| Earlier operational failure already won | Retain its primary error/outcome; a later init/pull throw before final closure can occupy the first lateReadError slot with host/post context |
| Owner abort/return already won during an active send | Keep disposed and its reason; an ensuing init/pull throw before final closure is lateReadError, not a new primary or cleanup error |
| Cancel send throws during shutdown | Record a real host/post cleanup issue with the original value; retain the already latched failure/disposal |
| Transport is fully closed | Do not reopen or mutate its frozen report, repeat cleanup or schedule new work |

“First” means host observation order, not cross-thread timestamps. The primary
value `undefined` is still an existing failure; presence of an issue is determined
by its wrapper/discriminant, never the truthiness of its error. A late read
failure is not automatically a cleanup failure. A failed init/pull is not counted
again as cleanup merely because shutdown follows it; a distinct cancel throw is
a new cleanup occurrence even if its value is identical to the primary.

No retry, clone fallback, automatic new Worker or duplicate pull is introduced.
Throwing does not promise that the native call had no delivery/detachment effects;
the adapter does not roll them back or resend. Shutdown retains one cancel attempt,
the existing non-extendable grace deadline and at-most-once terminate/teardown.
A failed cancel does not prove remote acknowledgement or stop the forced path.
No physical browser exit acknowledgement is promised.

## Transport closed and direct iterator return

`session.closed` remains stable, never rejecting, and resolves after the existing
shutdown/teardown barrier. Its fields retain their existing meanings:

| Field/path | Selected behavior |
| --- | --- |
| `kind: "failed"`, `error`, `origin`, `phase` | If init/pull won, error is the exact original value, origin host and phase post. Cleanup cannot replace this primary |
| `kind: "disposed"`, `reason` | An owner cancellation that won stays disposed with its original reason, even when cancel posting fails |
| `cleanup.count` / `cleanup.first` | Count real cleanup occurrences; first issue follows observation order and holds `{ origin: "host", phase: "post", error: original }` when the first issue was the cancel throw |
| `lateReadError` | Null or the first genuine late operational issue, preserving its original value and context, including thrown undefined |
| `termination` | Actual not-created/acknowledged/forced outcome and requested/failed terminate status, independent of primary/cleanup identity |

After a primary post failure, later direct `next()` calls reject with the same
primary value. Direct `return()` observes cleanup: it completes if cleanup was
successful, rather than rethrowing the already delivered primary. If cleanup
failed, outstanding cancelled transport reads and direct return reject with the
same existing **cleanup summary WorkerSourceError** (`code: "cleanup"`). Repeated
return does not repeat shutdown; return-promise identity is not promised.

That summary is not normalization of the original send error. Its cleanup first
issue retains the original value, and the wrapper's origin/phase come from the
first cleanup issue, which may precede the post failure. A raw cancel throw does
not itself become a `code: "transport"` wrapper. No new cause/remote descriptor
is added for a host throw. Counts remain saturated and reports retain one first
cleanup issue/one late issue, not an error history. Reference preservation bounds
the number of retained diagnostics, not the size of application-owned object graphs.
Existing natural-EOF/cleanup-promotion rules are unchanged; EOF does not send cancel.

## Async adapter and Player

An active send failure through `createAsyncSource` rejects its public read with
the same primary value; its failed report keeps that value. A secondary shutdown
failure is delivered through the existing iterator-return cleanup path, so the
outer report has a return cleanup error without replacing its primary.

If owner disposal wins first, the outer public read promptly resolves cancelled
and its report stays disposed. A subsequent cancel-send failure reaches
`cleanupErrors` through return as the shared cleanup summary; the cancelled
internal transport read can also appear as `lateReadError` with that summary.
This does not create a second primary or turn normal owner cancellation into an
active-read failure. Reports from the transport and outer adapter are distinct.

Player retains its existing preparation/Restart cleanup barrier and error/report
delivery rules. A cleanup failure can prevent replacement; disposal still removes
UI immediately, and late source cleanup does not issue new UI callbacks. U5 adds
no Player callback, status, recovery policy or automatic source restart.

## Acceptance and evidence

The public suite [worker-post-errors.test.mjs](../test/worker-post-errors.test.mjs)
now covers this matrix with 75 regressions; it also runs against the installed
archive. No production source change was needed. The acceptance matrix is:

| Scenario | Required observation |
| --- | --- |
| Init/pull native DOMException, Error, non-Error/undefined/hostile value | Exact identity in prompt read rejection, subsequent reads and failed report; host/post context, no coercion/mutation/retry |
| Actual-send getter versus initial handle validation | Correct post versus create phase without changing factory/input/serialization rules |
| Primary post error plus cancel/terminate/teardown errors | Primary unchanged; real secondary issues counted once by occurrence; cleanup first context and shared cleanup wrapper retained |
| Cancellation before send throw and cancel-send failure | Disposed/reason wins; genuine late operational issue distinct from actual cleanup; no truthiness bug for undefined |
| Direct transport versus createAsyncSource and Player | Existing return cleanup barrier, outer cancelled/failed result and reports, no duplicate primary/UI notifications |
| Success, EOF, repeated return/disposal and late replies | Existing data/transfer behavior, no cancel at natural EOF, at-most-once release and immutable settled reports |

Historical [design verification](checks/u5-post-errors-contract-2026-11-14.json) records 30
read-only fault-injection probes of the unchanged public adapter, using the real
endpoint with the existing in-process cloned-message transport and fake clock.
They cover init/pull values/getters, primary-versus-cancel failures, direct/outer
cancellation and cancellation-before-throw. This is neither a native browser
failure reproduction nor a new installed-package/full-suite/CI run. The original
0.16.0 audit remains historical evidence; U5 is now resolved as a contract.
The subsequent permanent suite passed all 75 cases, including getter create/post
boundaries, all send kinds, first late/cleanup issue, repeated return, true EOF,
copy/transfer, posted-then-thrown messages and Player Start/Next/Restart/disposal.
All 503 repository tests pass. [Regression verification](checks/u5-post-errors-regressions-2026-11-14.json)
records installed consumers and unchanged production/declaration/build hashes.
This is real adapter/endpoint coverage over the existing in-process transport,
not a new native-browser or CI run. F1/U1/U2 and the new tests remain local and
unreleased; baseline/candidate review and publication remain separate tasks.
