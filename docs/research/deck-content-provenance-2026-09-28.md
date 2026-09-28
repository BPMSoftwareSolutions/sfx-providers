# Published deck content provenance audit

Audit of the 72-slide `request-capability-from-objective` deck published as
`1zabhHGky03gEObEBPwXGabhIfvBtq7dlFIAqQz5ZhmM`, snapshot
`64c08b4579968557` (prefix), generator commit `c5ce8ea`.
This audits the retained generation and its source code, not today's live estate.
[Machine-readable inventory](deck-content-provenance-2026-09-28.json) records every
slide's retained references, interpretation, content family, and source hashes.
It is an audit artifact, not declared estate authority.

## Finding

The deck is capability-id driven, but it is not wholly driven by declared SQL
readings. Database-backed facts, locally authored SQL selection, local semantic
derivations, local presentation rules, and generated artifacts are distinct.
All 72 slides have locally implemented composition and rendering. Database
provenance for an input does not authorize every conclusion produced from it.

There is no per-text-run authority/derivation manifest, so a percentage of all
content that is authoritative cannot be measured honestly from current receipts.
The page-family counts below describe composition, not semantic authority share.

## Page inventory

| Pages | Count | Content origin |
| --- | ---: | --- |
| 01-15 | 15 | Database identities, declarations and graph source; local blueprint construction, provider grouping, projection, captions and glyph selection. Slide 02 also summarizes inspection coverage. |
| 16 | 1 | Three local coverage warnings and one SQL detector finding. Local review presentation and counting. |
| 17-44 | 28 | Database feature/Gherkin, contracts, authority, expressions, bindings, CLI and fixture declarations through local SQL. Local altitude questions, summaries, selection and omission rules. |
| 45-46 | 2 | Local reference-consistency checks, labeled alignment evaluation; not an estate alignment verdict. |
| 47-49 | 3 | Local source inventory, context gap assessment and digest/replay explanation over captured database data. |
| 50 | 1 | Local summary of the inspection envelope. |
| 51-70 | 20 | 57 property/obligation rows from SQL readings, one declared held-reading summary, and two locally synthesized NO_ROWS summaries. Three display records per slide. |
| 71 | 1 | Three local coverage findings plus database repair-map statuses. |
| 72 | 1 | Database feature-binding detection finding plus database repair mapping. |

Thus 23 pages are the new inspection appendix; the preceding 49 are the existing
declaration/projection/context section with inspection signals added. It would
be incorrect to describe this as 23 entirely SQL-authorized pages and 49 invented
pages: both sections mix source facts with local selection and presentation.

## Source layers

### 1. Declared SQL reading statements

`analysis.read_capability_inspection` reads the declared inspection profile and
the selected port statements belonging to `governed-detection`,
`governed-formal-verification`, and `derive-capability-proof-obligations`.
It executes those statements as `sidefx_reader`, retaining version and digest
provenance. It does not invoke each reading capability's entire selector circuit.
Deck generation calls the procedure directly; it does not dispatch the installed
`inspect-capability-circuit` capability through its normal invocation path.

The captured envelope has 14 configured readings: five detection, eight
verification and one obligations reading. Thirteen returned and witnesses was
held. Detection produced one feature-binding warning. Verification/obligation
display has 60 records: 57 SQL rows, the held result, and two local empty-result
summaries. Repair mappings are SQL evidence; mapped/held display labels are local
translations and do not establish repair execution.

The 48 PROVED count is local aggregation of database dispositions. It includes
overlapping obligations and 18 expression-vocabulary rows whose basis says
"no estate use". It is not 48 independent proofs of this capability's behavior.

### 2. Other database evidence selected by local SQL

`src/capability-presentation/read-estate.sql` is a repository-authored query batch.
It selects capability/scenario versions, feature bytes and parsed Gherkin,
contracts, fixtures, proof obligations, altitude catalog, conditions, blueprint
candidates and platform implementation declarations. Its graph comes from
`analysis.capability_graph_source`. Those are database inputs, but the batch is
not a declared reading capability. Its joins, closure selection and feature
binding fallback live in the local file.

The seven operation identities and ordinals, two provider associations,
input/outcome contracts, CLI selector, model binding selectors and variant
classifications are captured database facts. They are not handwritten per-deck
JSON authoring. Outcome classifications in this snapshot are success for
ADMITTED and failure for PROVIDER_UNAVAILABLE and REFUSED.

### 3. Local derivation and interpretation

- `snapshot.mjs` and `context-evidence.mjs` normalize, redact and select data,
  walk expression ASTs, extract provider references and schema fields, derive
  shape evidence and construct bounded previews. Snapshot JSON is already a
  transformed projection, not a raw database dump.
- `blueprint.mjs` creates graph presentation nodes and relationships. This
  snapshot has no selected canonical blueprint sources. Its 37 local edge
  records include six sequencing arrows derived from seven operation ordinals,
  two semantic Input/Event/Outcome links, and provider/binding relationships.
  They retain source references, but are not 37 returned canonical edge rows.
- `model.mjs` hard-codes the 11 altitude labels/questions, evidence-to-altitude
  mapping, context summaries, gap rules and reference checks. Database altitude
  stub records are linked as context; they do not supply these local rules.
- `blueprint-review.mjs`, `invocation-evidence.mjs` and
  `boundary-inspection.mjs` implement diagnostic logic and severity decisions
  locally. The observability and monotonic-proof coverage gaps are appended
  unconditionally by the blueprint builder. They state reader limitations,
  not database findings that the capability lacks those properties.
- `inspection-evidence.mjs` maps addresses, merges findings, creates coverage
  records and counts, maps COUNTEREXAMPLE to error, and interprets repair-map
  status. Matching local findings keep local severity during deduplication.
- `storyboard.mjs` selects and orders topics, chooses examples and leading
  expressions/bindings, creates explanatory prose and paginates. Headline
  summaries are not all returned SQL fields.
- `event-sheet.mjs` assigns action colors by identifier prefixes (build, bind,
  observe, select/normalize). Component glyphs use a separate local exact-kind
  and platform mapping. Neither mapping is a database classification reading.

These are deterministic rules written in code. Deterministic does not mean
declared, admitted or formally verified.

### 4. Local authored JSON and rendering code

`styles/component-glyphs.v1.json` is hand-authored local presentation data:
role/platform-to-shape mappings, primitive geometry and labels.
`component-glyphs.mjs` loads it from disk. Its contract name and digest do not
make it an admitted estate declaration. Themes, sizing, connector routing,
overflow rules, slide ordering and PowerPoint/Google serialization are local.
These are reusable rendering mechanics; semantic conclusions mixed into them
need a separate authority boundary.

### 5. Generated JSON artifacts

| Artifact | Role |
| --- | --- |
| `snapshot.json` | Normalized, redacted database snapshot plus derived fields and inspection capture. Can become input to frozen replay. |
| `inspection-evidence.json` | Captured SQL envelope plus host-added graph digest/capture basis. |
| `inspection-projection.json` | Locally resolved checks, coverage, aggregates and repair states. |
| `circuit-model.json`, `circuit-blueprint.json` | Locally constructed projections, relationships and diagnostics. |
| `storyboard.json` | Generated text, layout commands, slide metadata, notes and source references. |
| `presentation.json`, `google-batch.json` | Generated renderer/transport payloads. |
| `receipt.json` | Generation metadata, digests, coverage and review results; not an admission receipt. |

These files preserve replayability; they are not independent authorities.
`--snapshot` bypasses a new database read. Its digest proves consistency with
the retained JSON, not continued agreement with the live estate or correctness
of the generator's interpretations.

The receipt reports `inference.mode = deterministic-context`, `applied = 0`:
no host narrator enrichment was applied. Agent-authored templates and heuristics
still participate; absence of live model narration does not remove inference.

## Consequence

The boundary to establish is between estate-owned assertions and presentation
mechanics. Reading selection, diagnostic rules, severity/admission policy,
coverage obligations, altitude meaning and canonical relationships need explicit
declared authority and traceable results. Layout, geometry and serialization can
remain reusable code without deciding those assertions.

A future content contract should tag each assertion as a declared source value,
a declared reading result, a local derivation, a presentation annotation, or
unavailable evidence, retaining the source and derivation authority. This is a
recommendation, not an implemented or admitted policy. No runtime, database or
deck behavior was changed in this audit.
