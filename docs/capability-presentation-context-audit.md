# Capability presentation context audit

Read on 2026-09-26, using a read-only SQL Server SNAPSHOT transaction.
Subject: `sidefx:capabilities/sda-cli-invoke`, estate 34, capability version
1161235, definition 211112. The estate was not changed or invoked.

The earlier deck lost real source context. The reader queried only
`estate_capability_feature`, then discarded feature prose even when a row existed.
It also omitted selected scenario Gherkin, field constraints, provider selector
paths and CLI behavior. A missing reader result did not establish a missing feature.

## Feature evidence and selection

The capability has `feature_pk=749`. The estate-selected feature version is
171665, definition 211105. No exact version binding was returned from either
`estate_capability_feature` or `capability_feature` for capability version 1161235.
The provider now follows the forward feature identity and labels its selection
as identity context, preserving that distinction.

| Source | Retained meaning |
| --- | --- |
| `source.content_object/184877`, `features/sda-cli-invoke.feature` | “Write the configured text to standard output.” The scenario describes a configured message and greeting. |
| Feature version 171665 | “sda-cli-invoke greeting.” Its narrative says a caller supplies a name and receives a configured greeting. |
| Feature scenario version 102139 | Given a caller name; when the greeting is requested; then the caller receives the greeting with the name substituted. |
| Selected execution scenario `invoke`, version 102140 | Given one declared capability identity and admitted input; when the CLI invoke carrier runs the selected capability; then the declared scenario output is delivered. |
| Capability authority definition 211112 | Declared root `sda-cli-invoke`, standard-output user story and experience promise. |
| Selected graph | Root `invoke`, one `invoke-port` operation bound to `sda-node-consumer-runtime.v1`. |
| Selected CLI interface | Root `sda-cli-invoke`, JSON input, select `outcome`, display JSON. |

Retained feature content SHA-256:
`7f2a7f93a06e5a9322827276ef7732339a43c5254128cd95918fd83fa7d7bc49`.

These declarations disagree. The presentation must show the original feature
intent and the selected execution semantics with source labels. Replacing either
with inferred prose would hide the discrepancy. Feature normalization also
differs from the retained source's step wording; both versions are preserved.

## All eleven altitudes

| Altitude | Strong context previously missing | Provider coverage now | Remaining boundary for this capability |
| ---: | --- | --- | --- |
| 1 Feature parse | Gherkin title, narrative, authored scenario set, exact source lineage | Retained writeup, parsed feature narrative/scenarios, exact feature version and byte digest | The linked feature describes greeting behavior; no capability-version binding was returned. |
| 2 Capability meaning | Experience promise and observable success conditions | Actor/intent/outcome, experience promise, condition IDs and available statements | `message-delivered-to-standard-output` has no separate statement returned. Intent still describes greeting behavior. |
| 3 Scenario inputs/events/outcomes | Given/When/Then meaning, scenario descriptions, examples and attachments | Selected scenario prose plus feature scenario prose, kept distinct; input/event/outcome descriptions retained | Selected `invoke@102140` differs from feature `sda-cli-invoke@102139`. Neither declares examples here. |
| 4 Contracts and schemas | Field meaning, types, required status and validation constraints | Request/result field semantics, required members, minimum lengths and `additionalProperties:false` | `input` and `result` are unconstrained schemas. The provider does not invent their payload shape. Defaults/examples/literal enum values are omitted. |
| 5 Semantic authority envelope | Root selection and which declarations establish meaning | Authority root, graph root, feature selection and version evidence | Authority root `sda-cli-invoke` differs from graph root `invoke`. No admission receipt is inferred from selected definitions. |
| 6 Transformation AST | Input paths, output field structure, retained versus referenced expressions | Operator preview, input paths, literal types, counts and digest | The retained greeting transformation has no binding from the invoked port. Deeper operators remain collapsed in diagrams. Literal payload values are omitted. |
| 7 Execution authorities and ports | Actual operation kind, ordinal, scenario ownership and nested invocation boundary | `invoke` owns one `invoke-port` operation, `sda-cli-invoke-port` | The target capability depends on request `capabilityId`; it is not a statically declared scenario-call edge. No execution trace was collected. |
| 8 Providers/bindings/overlays | Semantic selector paths and authority/lineage policy | `capabilityIdPath`, `requestPath`, `namespacePath`, `scenarioPath`, `resultPath`, `authoritySource=DATABASE`, `lineageMode=retain-nested-execution`, input admission | The graph names a platform, not an explicit provider ID. Provider qualification, binding scopes and overlay resolution beyond `graph_source` remain unqueried. |
| 9 Interface and CLI display | Input admission and output presentation behavior | JSON input, selected output `outcome`, JSON display, interface platform and root | Interface root still names `sda-cli-invoke`, absent from the graph. The user's AVGO command is an invocation example, not observed execution evidence. |
| 10 Fixtures and proof | Assertion conditions, expected dispositions and obligation statements | Case/assertion metadata and proof statements when linked; expectations stay distinct from outcomes | No linked fixture or proof obligation returned for this selected capability/closure. Gherkin Then clauses provide intended behavior, not passing test results. |
| 11 Alignment evaluation | Cross-layer correspondence and review/admission evidence | Checks now expose feature-version, feature/source prose, authority-root and interface-root disagreements; every check appears in the deck | Alignment, reviewer-decision and admission receipts remain unqueried. Reference checks do not evaluate all semantic alignment dimensions. |

The eleven authoring layers are contextual dimensions. The catalog's scenario
names still contain `STUB`; their names alone do not establish completed
authoring, proof or evaluation. A separate alignment evaluation has ten dimensions
(intent, scenario, semantic-altitude, estate, topology, authority, provider,
proof, novelty, admission). These must not be confused with the eleven authoring
altitudes or with the renderer's computed reference checks. The declared
`record-align-evaluation-receipt-and-admission.sql` migration describes that
receipt shape and its stub provenance; this audit does not claim that an
evaluation exists for `sda-cli-invoke`.

## Reusable result

`presentation.from-capability` and `capability-deck.mjs` retain these contexts for
future capabilities. Each run emits a `context-audit.json` alongside the snapshot,
storyboard and circuit model. This audit is a dated example, not a runtime input.
The source evidence is sufficient to regenerate the deck offline without
invoking `sda-cli-invoke` or the nested equity-price capability.

The dated [snapshot](../examples/capability-presentation/sda-cli-invoke.snapshot.json)
is retained in version control for replay, including the original Gherkin bytes.
It is presentation evidence, not replacement estate authority:

```powershell
node capability-deck.mjs --snapshot examples/capability-presentation/sda-cli-invoke.snapshot.json --view scenario --context-altitude all --output outputs/sda-cli-context-replay --pptx
```
