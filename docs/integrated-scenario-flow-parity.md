# Integrated scenario flow parity

The live database circuit now embeds the complete ordered execution row inside
the scenario's When/Event area. Operations retain the deck's glyph grammar,
palette, labels and drill-down identities. Provider call ports connect to their
owning operation; the expanded execution view remains reachable.

This is a reusable database presentation change in `sfx-embody`, installed by
the `declare-integrated-scenario-flow` migration pair. No capability-specific
generator branch, export-directory prerequisite or runtime import from this
repository is introduced. The existing local scenario-sheet work is independent
and was not overwritten by the live viewer change.

The live acceptance contract includes all of the following:

- A persistent replay dot travels Given/Input → ordered operations → actual
  Then/Outcome, using captured operation boundaries and admitted handoff edges.
- A calling step stays lit through its port/provider round trip; the return
  direction is green. Sequential operations do not all illuminate together.
- Declared provider identity and observed executor profile remain distinct.
  A selected platform rule must match the operation's own receipt before a
  binding route animates. This does not establish a separate provider instance.
- Within an operation, path position is schematic progress through its measured
  interval. Request transit, provider dwell and response transit are not
  independently timestamped and must not be presented as measured subspans.
- Normal playback preserves the captured scenario duration; 0.1× scales it by
  ten. Pause, resume and speed changes preserve position, with no per-step delay.
- Startup, database connection, session setup, authority reads and graph
  preparation stay outside scenario playback, retained as invocation evidence.
- Only the scenario's exact returned contract/variant lights an outcome. Field
  presence requires published payload-shape evidence; missing field evidence is
  contextual, not fabricated.
- Repeated or overlapping own spans retain their occurrence/concurrency. Missing
  edges, ambiguous captures and executor mismatches are explicit evidence gaps.
- Operation coverage and drill-down navigation survive pagination. Follow mode
  changes viewport pages; manual inspection disables automatic following.
- The current completion-only live stream supports latest-observed landmarks.
  The continuous timed journey is reconstructed from a completed capture. A
  future in-flight live view needs start/phase telemetry; the renderer must not
  invent it.

The full product contract is `sfx-embody/docs/integrated-scenario-flow.md`.
Acceptance is recorded in the estate's `docs/live-circuit-verification.md` and
`evidence/live-circuit-catalog/integrated-*` receipts. The deck regeneration for
the declared reader is `outputs/capability-estate/integrated-live-flow-20260929`.
