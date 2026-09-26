# Capability presentations

The circuit provider now also serves `presentation.from-capability`: select a
`capabilityId`, read its current estate declarations, and generate editable
PowerPoint/Google Slides diagrams and evidence sidecars.

The two altitude axes work together:

* **Semantic view** (`view`): `scenario`, `mechanic`, `provider`, or `physical`.
* **Authoring context** (`contextAltitude`): `all` (default), or a focus from 1–11.

Every deck retains all eleven context layers and their evidence references. With
`all`, each layer receives a detail slide. A numbered focus keeps the whole
context map and expands the chosen layer. These numbers organize meaning; they
are not an execution sequence or a claim that eleven authoring steps completed.

## Run

From this repository:

```powershell
node capability-deck.mjs --capability-id request-capability-from-objective --view scenario --context-altitude all --output outputs/objective-scenario --pptx
node capability-deck.mjs --capability-id resolve-equity-market-price-evidence --view provider --context-altitude 8 --output outputs/equity-providers --pptx
node capability-deck.mjs --snapshot outputs/objective-scenario/snapshot.json --view mechanic --output outputs/objective-mechanics --pptx
```

Use `--namespace-id` when the capability ID is ambiguous. Unknown or ambiguous
identities return `HELD`; the reader never chooses an arbitrary match. Output
directories are created exclusively and cannot overwrite an existing deck.

Omit `--pptx` for dependency-free JSON/SVG compilation from a snapshot. PowerPoint
uses the existing optional `@oai/artifact-tool` adapter and
`CIRCUIT_ARTIFACT_MODULE` configuration described in
[circuit-presentation.md](circuit-presentation.md). It remains a private optional
runtime, not a public npm dependency. `npm run capability-deck -- ...` is equivalent.

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
* Linked selected features, fixture cases and proof obligations.
* The eleven context declarations in `authoring-altitude-model-stubs`.

The recipe follows the selected-version and closure probes in the supplied
`sql-queries.txt` index, especially `ver-1-state.sql`, `ver-2-graph.sql`,
`e1-graph.sql`, `scenario-faces.sql`, and `equity-effect-bindings.sql`. Those
temporary files are research inputs, not runtime dependencies.

## What each projection shows

| View | Diagram meaning |
| --- | --- |
| Scenario | Retained scenarios, declared transition branches, and scenario calls. Calls and transitions remain distinct. |
| Mechanic | Authority operation order, scenario calls, transformation bindings, and the first three levels of expression operators. Larger expressions are collapsed with complete operator counts and digests. Literal payloads are not treated as executable AST. |
| Provider | Port → platform/provider bindings, including retained unused bindings. Unresolved operation ports remain visible. |
| Physical | Declared endpoint origins/paths and host realization fields, where present. Actual process, device, timing and network testimony is not inferred from these declarations. |

Cross-page links retain peer node IDs and page references. Cycles and joins are
kept. The generator checks coverage of every node and relationship in its
projection; full details remain in the sidecars. A shared transformation is one
subcircuit with multiple incoming bindings. Dispatch/edge-group policy IDs and
digests are retained; this presentation adapter does not implement or simulate
their scheduling semantics.

Each of the eleven authoring layers has its own evidence interpretation:

| # | Layer | Evidence carried into the presentation |
| ---: | --- | --- |
| 1 | Feature | Selected feature association, identity and version |
| 2 | Capability meaning | Retained actor, intent, outcome and experience promise, including the selected authority envelope when normalized prose columns are empty |
| 3 | Scenario | Input, event, outcome, contracts and terminal declaration |
| 4 | Contract | Schema identities, required fields, property names and digests |
| 5 | Semantic authority | Estate selection, version/definition identities and source digests |
| 6 | Transformation | AST operator structure, branch counts and expression digests |
| 7 | Execution authority | Ordered operations, port and scenario references |
| 8 | Provider | Binding, platform, provider, credential-reference and destination metadata |
| 9 | Interface | Selected interface identity, configuration keys and digest |
| 10 | Fixtures and proof | Declared case expectations, assertion counts and obligations; no invented passing test result |
| 11 | Alignment | Computed reference checks and explicit evidence gaps; no invented estate alignment decision |

Missing associations or prose are reported, not invented. The current reader
does not fetch execution or alignment receipts. A digest establishes content
identity, not semantic correctness or successful execution.

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

The CLI retains `request.json`, the compact content-addressed `snapshot.json`,
`circuit-model.json`, `storyboard.json`, and `receipt.json`. Each `volume-NN/`
contains editable Google request batches, notes, SVGs, `presentation.json`, and
optional `presentation.pptx`. Large decks are divided into 32-slide volumes.
Long labels may be shortened visually; full identities and details remain in
notes and the sidecars. Large notes are explicitly abbreviated in the deck.

Bounds are explicit: 16 KiB request, 64 MiB source graph, 8 MiB compact snapshot,
256 generated slides / 8 volumes, and 48 MiB output. Oversized inputs are refused
without silently dropping graph elements. The HTTP tool returns data; it neither
publishes to Google nor exports files on the server.

The hand-authored provider and contracts remain **PROPOSED / not declared** in
the estate. Later migration can replace the read binding and inference binding
without changing the retained circuit model or native diagram renderer.
