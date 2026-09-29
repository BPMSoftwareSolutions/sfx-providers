# Live circuit data and navigation

The live circuit discovers capabilities through the installed kernel's catalog
command. An export directory is optional historical evidence, never a condition
for selecting a capability. The catalog's retained-publication availability flag
does not establish whether live scenario authority can be read or executed.

`read-live-scenario-circuit` reads the selected estate's base tables. Its request
selects a capability, namespace and optional scenario. Scenario membership comes
from owned scenarios and the transitive closure of declared scenario invocations.
An unresolved root or boundary returns `DECLARATION_INCOMPLETE` with findings;
the capability stays discoverable. Unknown and foreign selections are refused.
Opening a circuit never executes the selected subject capability.

## Presentation and navigation authority

The `live-scenario-circuit.v1` response carries SVG, geometry, node and edge
identities, observation addresses, replay policy, scenario membership, navigation
items and typed links. Presentation is declared SQL authority. The browser
displays returned scenes and follows opaque targets. It must not contain a
capability, scenario, contract, port, provider, or transformation allowlist or
special-case branch. Labels do not establish relationships. The host's reader
identities are boot configuration in `demo/circuit/circuit-host.json`.

Scenario pages link to complete event pages. Every operation is disclosed in
declared order, including operations without an explicit provider identity.
Component navigation includes containing capability/scenario authority, the
capability scenario list, operation ownership, called scenarios, selected
ports and their binding metadata, provider declarations, platform implementation
catalogs, explicit operation mechanics, referenced transformations, input/output
contracts and outcome variants. Reverse links are derived only from the returned
links. Shared provider identity does not assert a count of runtime instances.
Platform capability IDs are not assumed to be mechanic IDs.

The browser fetches component bodies and `detailSlides` only when opened. It sends `detailId`, an optional escaped JSON `detailPointer`, and
`expectedSnapshotDigest`; a changed snapshot is refused with
`LIVE_CIRCUIT_SNAPSHOT_CHANGED`. The digest covers selected declaration identities,
port generations, navigation relationships and component body digests. The
separate presentation digest covers returned slide content. Missing or ambiguous
provider declarations are labelled explicitly. An unqualified transformation
reference with multiple namespaces exposes its candidate declarations and a
`REFERENCE_NAMESPACE_AMBIGUOUS` finding instead of choosing one. Port configuration member names,
types and digests are visible; SQL statements, credentials and embedded application
bodies are not published through that detail view.

Drill-downs are rendered scenes, with the deck's Arial typography, palette,
drafting surface and normalized component glyph declarations. Complete execution
pages use ordered rows and binding-selected symbols; provider ownership uses
operation, socket, binding, platform and explicitly declared provider components.
Scenario meaning keeps the Given/When/Then geometry. Transformation operands use
the deck's depth layout and linked subtrees; contracts use its member fan;
provider and platform catalogs use its reference register. The capability
portfolio uses scenario cards, root input fields and root outcome variants.
All layout selection, geometry, labels and targets come from the database reader.
Clients neither recreate a diagram nor select its meaning from a capability name.

Large scenes paginate: every operation, scenario card, contract member and
operand remains reachable. Portfolio calls retain both endpoints, including
calls between pages. Operand containment is not execution sequencing. Glyph
contacts are decoration, not additional declared ports. Raw declaration trees
and JSON remain secondary inspection beneath the rendered scene. They expand
lazily in batches and retain all returned members. Page/detail/operand links
support browser Back/Forward and reloadable URLs. Changing the page or opening a
detail preserves the captured run and current replay clock. Changing the selected
scenario stops its previous replay because the observation scope has changed.

Historical exports retain their original SVG, internal links and inspection
readings. Live component navigation does not re-label those historical review
readings as current inspection results. Generation equality between declaration
and captured execution remains `NOT_FORMALLY_OBSERVABLE` until testimony carries
the necessary selected definition digests.

## Portable host boundary

The local HTTP host invokes the admitted, installed `KernelEntry.exe` over the
closed `sfx-command-delivery.v1` stdin envelope. It does not import a generator,
use a sibling checkout, install a package or author subject behavior. A website,
desktop or other client can consume the same scene and navigation contract.
The loopback demo transport is not a public deployment/authentication design.

The API is GET-only: `/api/circuit/v1/capabilities` and
`/api/circuit/v1/scenario`. It validates selection bounds and response identities,
coalesces identical pending reads, limits concurrent reads and queued work, and
uses an LRU cache bounded by entries, bytes and TTL. The configured TTL is 30
seconds; **Refresh from database** bypasses it. ETags support conditional reads.
Reader diagnostics do not enter the subject's observer stream. Aborted or stale
browser selections cannot replace the current scene. Component reads do not
constitute subject execution testimony.

## Execution honesty

The [scenario playback contract](scenario-playback-contract.md) remains binding.
Startup, database connection, session setup, authority reads and graph preparation
are excluded from playback. A declared database operation *inside* the scenario
retains its actual duration. Normal uses captured offsets at 1×; Slow 0.1× uses
the same offsets multiplied by ten. No mock receipts, invented waits or simultaneous
lighting substitute for captured execution. Provider declarations and implementation
catalog entries do not prove installation or execution; exact testimony identity
is required. Input field presence and exact outcome variants retain their existing
evidence requirements.

## Verification

`sql/inspect/live-scenario-circuit/` reads every selected scenario without invoking
its subject and checks operation coverage, provider-call coverage, SVG validity,
scene bounds and navigation targets. `demo/circuit/verify-live.mjs` checks real API
catalog, scene and component reads, snapshot mismatch refusal, unknown selections
and conditional cache reads, drill-down geometry and links, nested declaration
pointers, and refusal of unknown components and members. `verify-timing.mjs` accepts a saved live scene JSON
and a real SSE capture, checking exact timing at every declared playback rate,
pause, resume, stepping and invalid-capture refusals. Browser checks additionally
cover navigation, reload, Back, called scenarios and visible replay behavior.
