# Scenario circuit playback contract

Status: implemented in the live circuit viewer and declared by the installed
`deck-live-flow-policy.v1` reading. Updated 2026-09-29.

## Scope

**Scenario playback must not include host startup, database connection, session
setup, authority reads, or graph preparation.** It must also exclude output
rendering, delivery finalization, session teardown, and the remaining command
exit time after the scenario returns.

The animation answers “what happened inside this scenario?” Complete CLI wall
time answers a different measurement question. Both measurements remain available,
but the host's preparation time must never appear as an unexplained pause before
the scenario circuit lights up.

This exclusion concerns host preparation and cleanup. A database read, provider
call, or wait declared as an operation inside the scenario remains included for
its actual captured duration. Do not subtract a scenario operation because its
implementation happens to use a database or another provider.

## Captured window and time origin

The database supplies the replay policy and rates. The current window is:

- Start: the earliest `startedAt` of an own operation receipt joined to an
  operation in the selected deck through the declared semantic address and
  captured graph cell identity.
- End: the latest `completedAt` of an own scenario return joined to a declared
  scenario boundary in the selected deck.
- Scenario duration: end minus start.
- Display time zero: that captured operation start, not CLI `run-start`.

These rules are capability-neutral. Operation names, provider identities,
positions in an array, and slide geometry never invent execution timing.
The enclosing scenario's terminal receipt may measure only the return mechanic;
its individual `durationMilliseconds` must not substitute for elapsed scenario
time from the first operation through return.

All captured operation intervals and cell/edge timestamps within the window
retain their actual offsets. Gaps **inside** that window remain visible and scale
with playback. Cropping the host envelope must not compress internal gaps,
equalize operation durations, reorder receipts, or delete an inconvenient wait.

Missing start/return boundaries, invalid or reversed timestamps, conflicting
graph captures, mismatched run process IDs, and ambiguous invocation overlap
hold playback. Never manufacture timestamps or silently merge different runs.
Unsupported concurrent intervals must not be presented as sequential work.

## Normal, Slow, and Fast

For captured timestamp `t`, captured window start `S`, and selected rate `r`:

```text
scenario offset = t - S
playback deadline = (t - S) / r
playback duration = (E - S) / r
```

| Mode | Rate | Required elapsed playback time |
| --- | ---: | --- |
| Normal | 1× | The captured scenario duration |
| Slow | 0.1× | Ten times the same captured scenario duration |
| Fast | 2× | Half the same captured scenario duration |

Slow starts with the first scenario operation immediately. It must not wait ten
times the excluded startup duration. Changing speed rebases the clock at its
current captured position. Pause/resume preserves the remaining gap; Step selects
the next captured boundary and is explicitly identified as manual stepping.

The clock uses absolute deadlines and catches up after delayed callbacks; it
does not add a fixed delay for each receipt. Browser scheduling and display
refresh can be late. Report measured active playback wall time separately from
captured scenario duration. A paused or manually stepped session is not a
continuous-playback timing benchmark.

## Visual evidence

The original deck SVG, layout, typography, palette, node identities, provider
ownership, and exported connection routes remain authoritative for presentation.
The overlay uses captured evidence over that geometry.

A bright component is the current recorded operation interval, or the latest
receipt in live mode. Completed history is static and dim. Sequential operations
must not keep pulsing together. A new current receipt or interval cancels the
previous moving signal; only the current evidenced connection can move.

Replay can display an operation's recorded start/end interval using its retained
own receipt. This is historical reconstruction, clearly labeled as recorded
execution; it is not a newly emitted start event. Live mode follows received
testimony immediately and cannot claim a start before the emitter publishes
evidence of it. Fast real execution can complete between display frames.

Input highlights preserve their evidence basis. Dashed payload fields mean
contextual participation with field presence unpublished. An outcome variant
lights only at its own matching scenario return; the viewer must not expose a
future result as though it were known during an active operation. Unchosen
variants remain unobserved.

## Excluded timing remains evidence

The verification panel retains the full invocation duration, excluded lead-in
and tail durations, original records outside playback, timestamped delivery
phases, and process-local timing spans.

UTC timestamped phase pairs may be placed on an invocation timeline. Process-local
spans may be reported with their own clock domain, process identity, phase,
duration, and hierarchy. Without an explicit clock alignment, they cannot be
assigned exact positions in the invocation's UTC timeline. Nested span durations
must not be added together as independent wall time.

A runtime phase absent from the scenario deck is not permission to invent an
operation or connector. Report the missing mapping or clock coverage separately.
Excluding host preparation from scenario playback does not prove that every host
mechanic is declared, embodied, or formally covered.

## Verification and example

Acceptance requires a real, complete, unambiguous capture:

1. The first replay boundary is at scenario time zero and the final boundary is
   the own scenario return.
2. Every displayed cell/edge timestamp and operation interval equals its captured
   offset after rebasing. Host-only records never become scenario frames.
3. In-scope records plus separately retained out-of-scope records account for the
   entire captured invocation, preserving evidence identity and order.
4. Normal, 0.1×, and 2× meet the scaling equations under a deterministic scheduler;
   pause/resume, stepping, speed changes, and delayed callbacks are checked.
5. Declared sequential edges have non-overlapping captured operation intervals.
   Browser inspection confirms earlier calls become static history before later
   calls become current, and only the matching final variant lights.
6. Continuous Normal and 0.1× playback are measured in the actual browser.
   Record the capture identity, expected duration, actual wall time, and deviation.
7. Mixed-run and damaged-timestamp captures are refused rather than repaired by
   guessed timing.

The retained real capture `timing-live.sse` illustrates the distinction:

| Measurement | Captured duration |
| --- | ---: |
| Entire invocation | 3,578.240 ms |
| Excluded time before first scenario operation | 2,647.829 ms |
| Scenario, first operation through own return | 479.317 ms |
| Excluded time after scenario return | 451.094 ms |
| Expected Normal scenario playback | 479.317 ms |
| Expected Slow 0.1× scenario playback | 4,793.169 ms |

These are observations from that capture, not constants used by the renderer.
Earlier invocation-length replay measurements do not validate this revised
scenario-only scope. Tests of a controlled scheduler also do not replace browser
timing measurements.

Timing and identity checks are bounded evidence. The current stream lacks
selected definition digests needed to prove equality with the deck's exact
execution generation. Replaying a real trace also does not prove an external
service was called when the declared provider selected a simulated path.

## Browser acceptance, 2026-09-29

Continuous playback was measured against the real capture
`evidence/live-circuit-deck/scenario-live.sse` retained in sfx-embody:

| Mode | Captured scenario | Expected playback | Measured browser playback | Scheduling deviation |
| --- | ---: | ---: | ---: | ---: |
| Normal 1× | 455.205 ms | 455.205 ms | 459.900 ms | +4.695 ms |
| Slow 0.1× | 455.205 ms | 4,552.046 ms | 4,556.400 ms | +4.354 ms |

The 2,373.204 ms lead-in and 187.528 ms tail were excluded from both runs.
The first scenario operation was current immediately; no moving signal remained
after completion. This was uninterrupted playback, with no stepping or pause.
The acceptance check used a 50 ms browser scheduling tolerance; it is a measured
result on this host, not a universal real-time guarantee.

Reproducible evidence: `scenario-verification.json` (captured offsets and
deterministic clock checks) and `scenario-browser-proof.json` (browser wall-time
readings), alongside that capture in `evidence/live-circuit-deck/`.

## Repository responsibility

This repository exports the selected scenario's declaration geometry and
identities: `storyboard.json`, `circuit-blueprint.json`, original SVG slides, and
the presentation. The live viewer consumes those data in sfx-embody.

Deck generation must preserve actual scenario operation order, event ownership,
provider-port ownership, and exported routes. It must not add host startup,
database connection, session setup, authority reads, or graph preparation as
scenario nodes merely to fill playback time. An operation can appear only when
the estate declares it; missing mappings become findings and declared repairs.

Snapshot regeneration (`--snapshot`) reproduces a frozen deck. It is distinct
from timed execution replay. Static inspection findings and proof readings on a
slide remain snapshot evidence and do not become live execution proof.

See [the visual contract](capability-circuit-visual-contract.md) and
[capability presentation](capability-presentation.md) for the export surface.
