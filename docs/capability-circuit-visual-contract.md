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

The [readable execution reference](references/readable-execution-circuit.png)
sets the full Event sheet's row rhythm, numbered rails and action colors. The
[scenario reference](references/scenario-circuit-summary.png) and its
[Input/Event](references/scenario-input-event-detail.png),
[Outcome](references/scenario-outcome-detail.png), and
[observation](references/scenario-observation-detail.png) details establish card,
icon and boundary fidelity. Their stage labels and illustrative execution cells
are not copied into authority.

The user’s six rules are the rendering contract:

1. **One observation altitude per primary projection.** Capability shows
   root-connected scenario topology with declared provider involvement summarized
   above its owning scenarios. Scenario shows its declared Input, Event
   and Outcome. Event shows its own operations. Provider and mechanic detail
   are separate projections, reached through disclosure.
2. **Diagnostics are overlays, not topology.** Affected identities receive
   compact review markers. The review link opens source-bound findings.
3. **Unconnected declarations belong in inventory.** Retained scenarios,
   operations and bindings without a root path stay outside the active circuit.
4. **Every provider has explicit ownership.** Provider detail retains the
   operation → port → binding → platform → provider chain for explicit binding
   configuration. A provider named in a transformation connects directly to its
   owning binding with a dashed reference edge. No floating providers.
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

Capability provider links collapse the exact scenario → operation → port →
binding → platform → provider path. Each link retains all contributing operation
IDs, binding IDs and source edge references; repeated uses share one provider
glyph. The provider label opens an involvement register with every contributing
operation, declaration basis and binding; operation links open the binding view.
These violet links express declared involvement, not calls between providers or
evidence of execution. Unused bindings and unreachable scenarios contribute no
providers. Sharing a platform capability does not grant another binding's
providers. No execution cells are flattened into this summary.

Transformation AST object fields with literal `providerId` values are retained
as provider references, with their expression paths and optional `bindingId`.
References under `providerTestimony` are identified as declared testimony.
They establish a declared output identity, not ownership of another operation's
HTTP exchange or evidence of execution. Literal payload objects are not walked
as AST authority. Arbitrary payloads, credentials and request bodies remain
excluded. Older snapshots without this inspection data generate a refresh gap.

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

The linked scenario blueprint keeps Input → Event → Outcome as its primary
semantics. Inside When, numbered provider-reference cells disclose only real
operations that contribute a provider identity. Every wire terminates at that
operation's provider; solid violet means explicit binding identity and dashed
violet means a declared testimony reference. The disclosed operations are not
joined into a fabricated execution sequence. The Event cell opens the complete
execution sheet. Input field paths and outcome variants come from the selected
contracts. Check/cross icons reflect declared success/failure classification,
not an observed result. Unknown classification gets a document symbol.

An amber annotation exposes exchange operations missing provider identities.
The separate observation band reports invocation selection and circuit state;
it does not invent the reference image's telemetry channels. The renderer places
this scenario blueprint directly after the cover, as slide 02, and follows it
with the selected primary projection. All native destinations and slide numbers
are remapped deterministically; the selected Event links back to this blueprint.

Native PowerPoint links connect capability → scenario → Event → operation port
detail and back. Google migration checks the converted internal destinations.
The complete `presentation.pptx` owns the global slide navigation; JSON
transport volumes are not separate navigable PowerPoint files.

## Geometry and signal language

### Component symbols from data

The retained [component reference](references/component-shape-fidelity.png) comes
from the announcement deck's provider-binding design. Active blueprint nodes now
use a shared, versioned
[JSON shape map](../src/capability-presentation/styles/component-glyphs.v1.json).
The renderer selects symbols by declared component kind:

| Declared component | Native drafting symbol |
| --- | --- |
| Port | Socket with a central contact and crossbars |
| Binding | Adapter body with edge contacts |
| Provider | Pinned module with a header accent |
| Platform capability | Hexagon |
| Input / Outcome | Double-ring terminal |
| Operation / Event / Scenario | Execution body with a header accent |
| Physical metadata / endpoint | Document form |
| Declared `if` expression | Diamond gate |

`roles` maps kinds to named glyphs. `glyphs` contains normalized native primitives,
heading/label frames and connector anchors. Editing those recipes changes future
generation without per-capability code changes. Exact-kind/exact-label rules may
select a declared construct such as an `if` expression. An operation named
`select-route` does not become a gate merely because its identifier sounds like
one. Unknown kinds retain a neutral execution body.

Glyph coordinates scale with their node envelope. Routing uses glyph anchors,
including the narrow socket contacts, and retains the original edge identities.
The dense Event sheet preserves its numbered rail and measured caption frames;
the scenario summary preserves its contract cards and provider-reference layout.
These are disclosure layouts around the shared component symbols.

Contacts and header accents are drafting details. Their decorative pin count
does not declare additional ports, binding fields, branches, or runtime state.
Shared-looking paths cannot introduce a junction or alter source topology.
Each rendered symbol records its source node ID, selected glyph, envelope and
anchors; the blueprint records the style contract and digest.

`validateComponentStyle` rejects unknown recipes, unsupported primitives,
nonfinite/out-of-range coordinates, clipped text frames, invalid contact lines
and invalid paint tokens. Label fitting and connector validation still apply.
All output remains editable native PowerPoint/Google shapes and lines, with SVG
generated from the same rendering commands.

Transport volumes adapt to the existing command and native-request budgets as
composite symbols add primitives. This does not split, omit, or renumber logical
slides; the complete presentation retains all global navigation destinations.

- Amber: Input; blue: scenario, Event and execution responsibility.
- Violet: explicit port/binding/provider relationships.
- Green: Outcome; red: declared failure classification or an error overlay.
- Connector circles terminate existing edges; they are drafting anchors, not
  newly declared governed ports.
- Dashed wires identify calls or retained order in the older altitude sheets.
  The full Event sheet uses solid arrows with an explicit “declared order” legend.
  Dashed violet provider wires identify testimony references, not exchange calls.
- Outcome membership is separate from selected routing or measured success.
- The observation band says “unobserved” until identified testimony exists.

### Automatic geometry and text fitting

Each projection uses one scale factor, the smaller of its available width and
height ratios, capped at 1. Node shapes, ports and route coordinates share that
factor. Text then wraps by measured glyph advances and shrinks in quarter-point
steps within its scaled frame. Provider identifiers are preserved without
ellipsis. Ordinal text frames reserve native insets around the circle's digits.
Review markers reserve space for all attached finding IDs.

`scripts/blueprint_font_metrics.py` uses Python Pillow/FreeType to measure Arial
regular and bold. The larger advance for each glyph is retained in
`src/circuit-presentation/font-metrics/arial.json`, with font hashes. Generation
uses those versioned measurements without requiring Python on every invocation.
Unknown glyphs receive a conservative one-em advance.

The fit contract reserves 16 points horizontally, 7.2 points vertically and a
1.24 line-height factor for native text-frame padding, line metrics and rounding.
It permits a 4-point micro-label floor on dense overviews; full-size SVGs,
identity registers and operation links provide the inspection detail. If text
cannot fit at that floor, rendering fails with
`CAPABILITY_BLUEPRINT_TEXT_OVERFLOW`; it must not clip or drop declarations.
The Python `--inspect` pass independently measures generated blueprint labels.
Native Google/PPTX rendering still requires visual review because font
substitution and application layout can differ from these measurements.

### Readable full Event sheet

`event-sheet.mjs` gives the complete selected Event a full-slide drafting surface.
It places at most seven cells per row and sizes row heights to the available
surface. Row headings and ordinal ranges are layout groups, never inferred
semantic stages. Cells retain exact operation IDs and links to binding detail.
Action colors classify only identifier prefixes: build, bind, observe, and
select/normalize; other identifiers retain neutral execution blue.

The `event-sheet-layout.v1` rendering record contains every cell, fitted text
frame, source identity and routed edge. Its validator rejects omitted or duplicate
identities, changed endpoints, out-of-bounds cells, invalid connector segments,
and wires crossing unrelated cells. Continuations run through the outer margins
and inter-row gutters; no extra operation or edge is introduced by wrapping.
Labels fit from 10.25 down to an 8-point floor. A sheet that cannot preserve that
floor fails rather than hiding operations or overflowing a card. Ordinary
regeneration uses the same grammar for any selected capability or scenario.

### Connector routing validation

Every generated blueprint route carries an explicit rendering policy. When a
forward corridor between cell boundaries is unobstructed, use `routing: forward`:
a straight connector or an orthogonal connector with at most two bends. Its path
length must equal the Manhattan distance between its anchors. Reversals, spikes,
and extra zigzags are rejected with `CIRCUIT_CONNECTOR_INVALID` before native
PowerPoint, Google Slides or SVG output is authored. Each segment must be nonzero
and horizontal or vertical. The public `route` command exposes the same policy.

The router checks other cell bounds, including provider double frames, before
selecting this policy. Fan-out branches share the midpoint of the clear column
gap. Wrapped rows, recurrence and blocked corridors use `routing: orthogonal`,
which permits necessary detours but still rejects invalid segments. This is a
rendering rule, not a claim that execution is monotonic; route choices never
alter the source edge IDs or endpoints. Existing hand-authored commands without
a policy retain their prior behavior.

## Review and observation boundaries

`circuit-review.json` distinguishes errors from incomplete evidence. Findings
identify affected nodes and retained sources. Checks include disconnected
scenarios, absent targets/bindings, unused bindings, unresolved selectors,
self-calls without retained bounds, missing branch selector/variant declarations,
and endpoint bindings without a declared provider identity. A later
transformation's testimony identity does not erase the latter finding.
This is a bounded structural review, not exhaustive verification
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
