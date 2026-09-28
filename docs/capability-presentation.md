# Capability presentations

The circuit provider now also serves `presentation.from-capability`: select a
`capabilityId`, read its current estate declarations, and generate editable
PowerPoint/Google Slides diagrams and evidence sidecars.

## Generation contract

**Generate a slide show for capability X.** One request selects one root capability
by identity, with optional namespace qualification. The same reader, context
projection, blueprint builder and renderer apply to every requested capability;
there is no per-capability slide authoring or example-specific selection step.

The selected estate declarations supply the feature/Gherkin intent, eleven
authoring context layers, scenarios, operations, transitions and bindings. The
declared scenario invocation closure belongs to that selection. A capability
mentioned in prose, a prior conversation or an example invocation does not become
another selected root. Missing evidence stays missing; inferred explanations
cannot supply circuit facts or select additional capabilities.

The acceptance path is `capabilityId` → selected estate snapshot → slide show.
Snapshot replay supports reproducibility. Combining separately selected snapshots
is an explicit composition utility, not evidence that this acceptance path works.
The provider is intended for the entire estate; tests cover representative
structures and identity isolation, not a completed validation of every estate
capability. The size bounds and unexpanded subcircuits below remain applicable.

After PowerPoint export, the [Google Slides migration provider](google-slides-migration.md)
can create and verify a native Google deck. The migration job retains the source
hash and observed file ID, so repeated runs reuse the converted presentation.

The two altitude axes work together:

* **Semantic view** (`view`): `capability` (default), `scenario`, `event`, `mechanic`, `provider`, or `physical`.
* **Authoring context** (`contextAltitude`): `all` (default), or a focus from 1–11.

Every deck retains all eleven context layers and their evidence references. With
`all`, each layer receives a detail slide. A numbered focus keeps the whole
context map and expands the chosen layer. These numbers organize meaning; they
are not an execution sequence or a claim that eleven authoring steps completed.

## Blueprint projections and disclosure

The slide after the cover is complete at the requested observation altitude.
It does not combine every retained fact into one circuit. See the
[projection contract](capability-circuit-visual-contract.md) for the six rendering
rules, authority boundaries and source limitations.

Capability shows root-connected scenarios; selecting a scenario opens its
Input/Event/Outcome frame. Selecting its Event opens all declared operations.
Invoking operations link to explicit port/binding/provider ownership views.
Review markers, declaration inventory and observation state remain separate.
All eleven authoring contexts and feature/Gherkin evidence remain available.

Use `--scenario-id` to select a retained scenario, and `--operation-id` to
select an operation for provider/physical detail. `--transformation-id` selects
a retained expression in mechanic view. Unknown identities are refused.
No capability-specific source changes are needed.

The output retains `circuit-blueprint.json`, `circuit-projection.json`,
`circuit-review.json`, full-size projection SVGs and the editable presentation.
Coverage checks the selected projection separately from the source inventory.
Declared operation-order wires do not prove full canonical routing or monotonic
progress; those missing proofs are explicit review findings. Missing targets are
not fabricated nodes. Runtime selectors remain unresolved references until an
identified invocation provides testimony.

The standalone blueprint-sheet script remains a composition utility for
explicitly selected snapshots. It remaps internal slide links when extracting
or composing the blueprint appendix. The normal capability-ID provider is the
single-capability generation and acceptance path.

## Run

From this repository:

For the complete repeatable workflow, see [Regenerate a capability presentation](capability-presentation-regeneration.md).

```powershell
$capabilityId = Read-Host 'Capability ID'
node capability-deck.mjs --capability-id $capabilityId --view capability --context-altitude all --output outputs/selected-capability --pptx
node capability-deck.mjs --snapshot outputs/selected-capability/snapshot.json --view mechanic --output outputs/selected-mechanics --pptx
```

Use `--namespace-id` when the capability ID is ambiguous. Unknown or ambiguous
identities return `HELD`; the reader never chooses an arbitrary match. Output
directories are created exclusively and cannot overwrite an existing deck.

Omit `--pptx` for dependency-free JSON/SVG compilation from a snapshot. PowerPoint
uses the existing optional `@oai/artifact-tool` adapter and
`CIRCUIT_ARTIFACT_MODULE` configuration described in
[circuit-presentation.md](circuit-presentation.md). It remains a private optional
runtime, not a public npm dependency. `npm run capability-deck -- ...` is equivalent.

Regeneration requires no source edits and no AI agent. After the one-time host
configuration, rerun the command with any selected capability ID and a new output
directory. It rereads the estate and writes `presentation.pptx` containing the
entire deck, including slides beyond the 32-slide transport-volume boundary.
Page numbers continue across volumes. An identical snapshot can instead be
replayed with `--snapshot`.

To avoid setting a runtime environment variable each session, add an absolute
`artifactModule` path to the same ignored local configuration shown below. For
example, point it at the installed `@oai/artifact-tool/dist/artifact_tool.mjs`.
`CIRCUIT_ARTIFACT_MODULE` overrides that setting. This is machine configuration,
not a capability-specific code change.

Google conversion also runs without an agent through the migration CLI and an
authenticated host. That host requires one-time OAuth setup and token refresh.
A connected Codex Google account is not automatically a standalone CLI login.
See [standalone Google migration](google-slides-migration.md#run-unattended-from-an-authenticated-application).

## Database host binding

The SQL reader accepts `openSql(): Promise<{pool, sql}>`, where `sql` is the
`mssql` driver and `pool` is an open, dedicated connection pool. The reader closes
that pool after each request. A host owns driver installation, connection policy
and credential release. No connection string is accepted in presentation input.

For a custom host, set `CAPABILITY_ESTATE_HOST_MODULE` to an absolute local module
that exports `openSql`. See [host.example.mjs](../examples/capability-presentation/host.example.mjs).
For the existing SDA vault ground, create the ignored local host configuration:

```json
{
  "bootstrapRoot": "C:/path/to/selected/SDA/languages/typescript/src/kernel/bootstrap"
}
```

Save it as `config/capability-presentation.local.json`. The optional SDA host imports
only `runtime-configuration.mjs` and `database-connect-boundary.mjs` from that
operator-selected location. Credentials stay inside its vault/connect boundary.
This development adapter can point at the present bootstrap checkout; it is a
named hand-authored bridge, not an estate-admitted runtime dependency. Replace
the host with an installed realization when that ground is available. No estate
or kernel files are edited or required by offline replay.

The fixed [read-estate.sql](../src/capability-presentation/read-estate.sql) is
parameterized, runs on one **SNAPSHOT transaction**, and is rolled back. It requires
SQL Server snapshot isolation to be enabled and SELECT access to the named
model/source/analysis objects. It never changes isolation settings, invokes a
capability, calls its providers, or installs authority. Each read pins:

* The current estate and its selected capability version/definition.
* Scenario versions from that capability and its declared invocation closure.
* `analysis.capability_graph_source` with namespace qualification.
* Linked feature versions, exact retained Gherkin bytes, authored scenario prose,
  fixture assertions, observable conditions and proof obligations.
* The eleven context declarations in `authoring-altitude-model-stubs`.

The recipe follows the selected-version and closure probes in the supplied
`sql-queries.txt` index, especially `ver-1-state.sql`, `ver-2-graph.sql`,
`e1-graph.sql`, `scenario-faces.sql`, and `equity-effect-bindings.sql`. Those
temporary files are research inputs, not runtime dependencies.

## What each projection shows

| View | Diagram meaning |
| --- | --- |
| Capability | Root-connected scenario topology. Calls collapse their owning operation while retaining the source edge ID. |
| Scenario | The selected scenario's declared Input, Event and Outcome, with a link into the Event. |
| Event | All operations in the selected Event and their declared order. Runtime routing and monotonic progress remain separate proof questions. |
| Mechanic | The selected declared expression operand tree. Literal payloads are not executable AST nodes. |
| Provider | The selected operation → port → binding → platform/provider chain. Unused bindings belong in inventory. |
| Physical | The selected binding's declared endpoint origins/paths and realization fields. Actual process, timing and network testimony is not inferred. |

Cross-page links retain peer node IDs and page references. Cycles and joins are
kept. The generator checks coverage of every node and relationship in its
projection; full details remain in the sidecars. A shared transformation is one
subcircuit with multiple incoming bindings. Dispatch/edge-group policy IDs and
digests are retained; this presentation adapter does not implement or simulate
their scheduling semantics.

Each of the eleven authoring layers has its own evidence interpretation:

| # | Layer | Evidence carried into the presentation |
| ---: | --- | --- |
| 1 | Feature | Original Gherkin writeup, feature title/narrative, exact source digest, version selection, parsed feature scenarios and their descriptions/steps/examples |
| 2 | Capability meaning | Retained actor, intent, outcome and experience promise, including the selected authority envelope when normalized prose columns are empty |
| 3 | Scenario | Selected scenario Given/When/Then, descriptions, tables, doc strings and examples, alongside input/event/outcome responsibilities and contracts |
| 4 | Contract | Field types, required members, descriptions, constraints, references and digests |
| 5 | Semantic authority | Estate selection, feature-version provenance, authority root versus graph root and source digests |
| 6 | Transformation | AST operator structure, input paths, literal types, branch counts and expression digests |
| 7 | Execution authority | Ordered operations, port and scenario references |
| 8 | Provider | Binding, selector paths, authority source, nested-execution lineage policy, input admission, platform/provider and destination metadata |
| 9 | Interface | Input type, display selection/format, platform and declared root scenario |
| 10 | Fixtures and proof | Case expectations, assertion paths/operators/expected-value digests and obligation statements; no invented passing result |
| 11 | Alignment | Feature/scenario version correspondence, root consistency and all reference checks, including gaps and unqueried receipts |

Missing associations or prose are reported, not invented. The current reader
does not fetch execution or alignment receipts. A digest establishes content
identity, not semantic correctness or successful execution.

Feature selection first reads exact `estate_capability_feature` and
`capability_feature` version bindings. If neither exists, it follows
`capability.feature_pk` through `analysis.v_selected_semantic_definition`.
That fallback is **identity context**, not an invented canonical version binding.
It never selects an arbitrary historical feature by filename or maximum version.
The database view's estate-selection semantics remain explicit in provenance.
Feature definitions resolve `semantics.content_digest` to `source.content_object`;
the reader verifies the SHA-256 of the retained UTF-8 writeup. The English source
header extractor supplies a display title/narrative only. Authored scenario
structure comes from declared scenario JSON, not an ad hoc Gherkin parser.
Non-English writeups remain intact and use the normalized title when needed.

Feature scenarios and selected execution scenarios remain separate. A mismatch
in IDs or versions is a finding, as is parsed scenario text that differs from
retained feature bytes. The renderer does not repair or overwrite estate meaning.
Long prose paginates. Exact source, tags and structured attachments remain in the
snapshot and notes. Schema defaults/examples/literal enum values, arbitrary
provider config, credentials and literal AST payloads are not projected.

Every run writes `context-audit.json` with all eleven context summaries, evidence
references, remaining context gaps and cross-layer findings. See the
[sda-cli-invoke audit](capability-presentation-context-audit.md) for a live example.

## Inference seam

Default explanations are deterministic, based on retained prose and counted
facts. ID humanization is presentation wording, not a replacement declaration.
A trusted optional `--narrator C:/path/to/narrator.mjs` module can export
`narrate({capability, view, contexts, slides})` and return:

```json
[
  {"slideId":"slide-1","text":"An explanation grounded in these facts.","evidenceRefs":["model:capability_version/123"]}
]
```

References must exist on that slide. Added explanations are labeled **inferred**
in the speaker notes; they cannot change circuit nodes, edges, source facts or
slide titles. The host controls any model call. JSON input cannot select code,
SQL, modules, paths or a remote inference endpoint. No model is called by default.
An evidence reference is traceability, not automatic verification of a narrative
claim; review inferred wording before publishing.

## API and retained output

```text
POST https://localhost:8790/circuit-presentation/presentation.from-capability
```

The request is [examples/capability-presentation/request.json](../examples/capability-presentation/request.json).
Schemas live in `contracts/capability-presentation/`. The existing
`GET /circuit-presentation/health` lists both tools. A host can inject a reader
directly with `presentCapability(input, {readEstate, narrator})` for tests or a
future declared adapter.

The CLI retains `request.json`, `context-audit.json`, the compact content-addressed `snapshot.json`,
`circuit-model.json`, `storyboard.json`, and `receipt.json`. Each `volume-NN/`
contains editable Google request batches, notes, SVGs and `presentation.json`.
Large decks are divided into 32-slide transport volumes.
With `--pptx`, the output root also contains the complete `presentation.pptx`.
Long labels may be shortened visually; full identities and details remain in
notes and the sidecars. Large notes are explicitly abbreviated in the deck.
The receipt records the requested capability/namespace and the selected estate,
capability version and root scenario beside the snapshot digest, so a generated
artifact can be checked against the request without relying on its slide title.

Bounds are explicit: 16 KiB request, 64 MiB source graph, 8 MiB compact snapshot,
256 generated slides / 8 volumes, and 48 MiB output. Oversized inputs are refused
without silently dropping graph elements. The HTTP tool returns data; it neither
publishes to Google nor exports files on the server.

The hand-authored provider and contracts remain **PROPOSED / not declared** in
the estate. Later migration can replace the read binding and inference binding
without changing the retained circuit model or native diagram renderer.

## Scenario inspection evidence

Live generation also reads the installed `analysis.read_capability_inspection`
procedure in the **same snapshot transaction** as the diagram. The estate owns
the reading profile, detector definitions, selected statements, proof receipts,
and repair map. The generator does not contain a capability-specific reading
list. No target execution or repair is dispatched by deck generation.

The scenario blueprint remains slide 02. Findings address existing inputs,
events, outcomes, operations, ports, bindings and edges. Binding-only findings
roll up through declared port ownership. Findings with no resolved component
remain visible as unlocated/global findings. Inspection overlays add no circuit
nodes or edges. The coverage strip links to bounded reading results and evidence
pages; each preserves the raw property, basis, source references, and repair
readiness. A mapped repair is not an executed repair.

`PROVED` counts are returned rows, often overlapping; they are not independent
guarantees or runtime testimony. Empty results, held readings, missing readers,
old snapshots and subject-version mismatches remain explicit. The collector may
hold an observed failing statement by its exact digest in its declared profile;
changing the statement causes re-evaluation. Unexpected SQL failure can refuse
generation; it must never become an empty findings array.

`inspection-evidence.json` retains the database envelope; `inspection-projection.json`
retains resolved addresses, coverage and repair states. Both also participate in
the ordinary snapshot/storyboard receipts. Regenerate with the usual command;
no source edit is needed:

```powershell
node capability-deck.mjs --capability-id request-capability-from-objective --view capability --output outputs/capability-estate/anchor-inspection-new --pptx
```

Snapshot replay is an inspection of that frozen snapshot, not a fresh database
assessment. Evidence labeled `SNAPSHOT_MATCH` agrees with its captured subject;
it does not claim the live estate has remained unchanged after export.
