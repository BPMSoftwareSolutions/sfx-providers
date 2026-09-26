# Capability circuit projection contract

Status: implemented as a hand-authored presentation provider. This contract
governs rendering; it is not estate admission or proof of monotonic execution.

## Authority and visual references

The [fidelity reference](references/capability-blueprint-fidelity.png) establishes
the drafting quality: fine grid, precise capability and scenario boundaries,
numbered cells, explicit connector ownership and stable signal colors. The
[earlier reference](references/capability-circuit-blueprint.png) and
[projection review](references/capability-blueprint-projection-review.txt) are
retained for design lineage. Their illustrative cells, provider names, metrics,
eight-step sequence and telemetry channels are not estate declarations.

The user’s six rules are the rendering contract:

1. **One observation altitude per primary projection.** Capability shows
   root-connected scenario topology. Scenario shows its declared Input, Event
   and Outcome. Event shows its own operations. Provider and mechanic detail
   are separate projections, reached through disclosure.
2. **Diagnostics are overlays, not topology.** Affected identities receive
   compact review markers. The review link opens source-bound findings.
3. **Unconnected declarations belong in inventory.** Retained scenarios,
   operations and bindings without a root path stay outside the active circuit.
4. **Every provider has explicit ownership.** Provider detail retains the
   operation → port → binding → platform → provider chain. No floating providers.
5. **No invented cells, edges or ports.** Missing targets are references in the
   review, not fabricated target nodes. No semantic grouping is inferred merely
   to reduce the operation count. Outcome variants express membership unless
   source transitions declare routing.
6. **Observation remains separate.** Runtime state may decorate known IDs.
   It cannot create nodes, move them or rewrite architecture.

The numbered authoring altitudes 1–11 remain a separate context axis. Feature
writeups, retained Gherkin and context evidence are not discarded when the
selected circuit projection is small.

## Deterministic implementation

`buildBlueprint` retains the selected source graph and its identities once.
`projectBlueprint` selects altitude and scope. `layoutBlueprint` depends only
on that projection’s nodes and edges. Review and observation overlays are
computed separately. Each projection records a topology digest, source pointers,
snapshot digest, and exact visible identities.

Capability call edges collapse the owning operation but retain the source edge
ID. Shared execution authorities retain each owning scenario. Declared
transitions preserve selectors, topology kind and progress metadata. Layout
does not turn multiple incoming alternatives into an all-required convergence.

The current reader retains ordered operation declarations. Wires labelled
“declared order” show those declarations, not proven runtime routing. It does
not manufacture input-to-outcome completion, reverse testimony wires, junction
rules or bounded recursion. Unresolved runtime selectors name their source path
in the review; examples in prose cannot resolve them.

The complete Event sheet includes every selected operation and its retained
order relationships. Dense sheets have readable identity registers and full-size
SVG projections. They do not force all bindings and AST nodes onto that sheet.
Short diagram captions remove repeated identifier context deterministically;
full identifiers remain in source registers, notes and JSON.

Native PowerPoint links connect capability → scenario → Event → operation port
detail and back. Google migration checks the converted internal destinations.
The complete `presentation.pptx` owns the global slide navigation; JSON
transport volumes are not separate navigable PowerPoint files.

## Geometry and signal language

- Amber: Input; blue: scenario, Event and execution responsibility.
- Violet: explicit port/binding/provider relationships.
- Green: Outcome; red: declared failure classification or an error overlay.
- Connector circles terminate existing edges; they are drafting anchors, not
  newly declared governed ports.
- Dashed wires identify calls or retained order, and are labelled as such.
- Outcome membership is separate from selected routing or measured success.
- The observation band says “unobserved” until identified testimony exists.

## Review and observation boundaries

`circuit-review.json` distinguishes errors from incomplete evidence. Findings
identify affected nodes and retained sources. Checks include disconnected
scenarios, absent targets/bindings, unused bindings, unresolved selectors,
self-calls without retained bounds, and missing branch selector/variant
declarations. This is a bounded structural review, not exhaustive verification
of all possible circuit defects or an admission decision.

`applyObservationFrame` is a presentation-side adapter function. It requires
the matching snapshot digest, an invocation ID, a known node ID and a supported
state. Unknown identities or mixed invocations are rejected. It updates a
separate state map without changing topology. It is not a declared estate
protocol, a live subscription, or evidence that a capability executed.

## Source limitations

The reader returns selected blueprint-version metadata, including candidate
disposition and node/edge counts, alongside the selected declaration graph.
It does not yet retrieve and reconcile every compiled canonical edge or a
monotonic-progress proof. Canonical completeness is therefore false and the
review exposes that limitation. Rendering must never use a “monotonic” title
as if visual left-to-right placement proved it.

This provider does not execute the selected capability, call its external
providers, or create telemetry testimony. Migration into a declared provider
in the sfx-embody estate remains later work.
