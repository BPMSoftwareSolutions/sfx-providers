# Swap-in map: the eleven code providers -> declared-data counterparts

**Date:** 2026-09-22. **Companion record:** `../bridge.policy.json`. **Read-only in
`scenario-driven-architecture`; no DB writes, no commits.**

The eleven code providers are the local HTTPS model-provider services `providers/altitude-01.mjs` ..
`altitude-11.mjs` (`providerId` = `sfx-authoring-altitude-NN`, one per authoring altitude). Each holds the
bridge placement of the estate role of the matching `authoring-altitude-model-stubs` port. This map
gives, per provider, the declared-data successor, the exact estate CRUD that installs the counterpart and
retires the code bridge, and the verification that proves the swap. It is the mechanical removal
instruction for the surface admitted in `../bridge.policy.json`.

## Shrink counter

```
providers_retired: 0
providers_remaining: 11
```

Rules: `providers_retired + providers_remaining = 11` (the `bridge.policy.json` baseline) at all times.
`providers_retired` increments once per provider, and only after `model.retire_model_placement` (or the
mechanism-specific retire below) has run **and** the swap proof has been captured: the invocation of the
successor returns the declared outcome and the lane carries the successor's event. `providers_remaining`
never grows; a discovered missing provider is `PROVIDER_BRIDGE_GROWTH_REFUSED`, not a new entry.

## Provider -> bridge placement -> successor

| # | providerId (`providers/altitude-NN.mjs`) | altitudeId | tool | estate bridge placement (retire target) | successor |
| ---: | --- | --- | --- | --- | --- |
| 1 | `sfx-authoring-altitude-01` | altitude-1-feature-parse | `feature.resolve` | `authoring-altitude-model-stubs-port` | B provider binding (admitted) |
| 2 | `sfx-authoring-altitude-02` | altitude-2-capability-meaning | `meaning.author` | `altitude-2-capability-meaning-stub-port` | C projected child |
| 3 | `sfx-authoring-altitude-03` | altitude-3-scenario-io | `scenario.author` | `altitude-3-scenario-io-stub-port` | C projected child |
| 4 | `sfx-authoring-altitude-04` | altitude-4-contracts-schemas | `contract.author` | `altitude-4-contracts-schemas-stub-port` | C projected child |
| 5 | `sfx-authoring-altitude-05` | altitude-5-semantic-authority-envelope | `semantics.author` | `altitude-5-semantic-authority-envelope-stub-port` | C projected child (rides parent) |
| 6 | `sfx-authoring-altitude-06` | altitude-6-transformation-ast | `ast.author` | `altitude-6-transformation-ast-stub-port` | C projected child + D transformation |
| 7 | `sfx-authoring-altitude-07` | altitude-7-execution-authorities-ports | `authority.author` | `altitude-7-execution-authorities-ports-stub-port` | C projected child |
| 8 | `sfx-authoring-altitude-08` | altitude-8-providers-bindings-overlays | `provider.author` | `altitude-8-providers-bindings-overlays-stub-port` | B provider binding (admitted) |
| 9 | `sfx-authoring-altitude-09` | altitude-9-interface-cli-display | `interface.author` | `altitude-9-interface-cli-display-stub-port` | C projected child (rides parent) |
| 10 | `sfx-authoring-altitude-10` | altitude-10-fixtures-proof | `fixture.author` | `altitude-10-fixtures-proof-stub-port` | C projected child (rides parent) |
| 11 | `sfx-authoring-altitude-11` | altitude-11-alignment-evaluation | `alignment.evaluate` | `altitude-11-alignment-evaluation-stub-port` | B provider binding (+ C child) |

## Reference set

- Placement mechanisms and per-mechanism CREATE/READ/UPDATE/RETIRE:
  `docs/model-at-each-authoring-altitude-2026-09-21/altitude-model-placement-sql.md`
  (§A connector, §B governed HTTP exchange, §C projected child, §D transformation; §2 missing writers).
- Admitted change kinds and installer bodies:
  `docs/estate-mcp-and-database-expressiveness-2026-09-21/crud-operations.md`
  (§2 TOOL binding, §3 registry route, §4 candidate filing, §5 kinds C4/C5, §7 alignment C6).
- Stub inventory (bridge placements): `docs/authoring-altitude-model-stubs-2026-09-21/inspection.sql`
  (`i1_stub_altitudes`) and `analysis.md` §1; swap synthesis: `swap-in-plan.md`; procedure fill-in:
  `stub-fill-checklist.md` §2.2.
- Retire writer assumed below (PROPOSED until declared): `model.retire_model_placement` - placement doc §2.3.

## 1. `sfx-authoring-altitude-01` - altitude-1-feature-parse (`feature.resolve`)

- **Bridge placement (retire target):** `authoring-altitude-model-stubs-port` (the root D stub port of
  `authoring-altitude-model-stubs`).
- **Successor:** B governed HTTP exchange, already declared/admitted: the live lane
  `request-capability-from-objective` -> `obtain-governed-model-response` (provider-binding-change.v1,
  `sda-governed-http-exchange-port.v1`). Feature parsing also has the deterministic
  `sda-canonical-capability-feature-resolution-port.v1`.
- **Install counterpart (CRUD):** text lane: no write. `feature.resolve`: declare the consumer overlay
  binding row for `sda-canonical-capability-feature-resolution-port.v1` (DERIVED overlay copy; nearest
  precedent `bind-credential-vault-mechanic-and-realization.sql:12-41`) so the current
  `SEMANTIC_EXECUTION_GRAPH_OVERLAY_BINDING_MISSING` clears. `feature.pin`: `feature-binding-change` kind
  -> `model.install_feature_binding_change` -> `model.declare_capability_feature`
  (`crud-operations.md` §5.2 row 6).
- **Retire code bridge (CRUD):** retire the D stub port via `model.retire_model_placement` (placement doc
  §2.3) or the D-R1 inverse authority re-mint without the operation (placement doc §D DELETE); de-select
  the superseded definition with `DELETE model.estate_definition` (`refresh-os-credential-binding-digest.sql:69-71`).
- **Verification:** `sfx capability invoke request-capability-from-objective --input-type text --input "..."
  --json` (exit 0); lane `provider-exchange-shape.v1` `POST generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent`
  status 200 plus `model-response-shape.v1` `modelResponse` (fallback: bounded `responseShape.body`);
  feature-resolution overlay resolves.
- **Admitted today:** **yes** (live lane).

## 2. `sfx-authoring-altitude-02` - altitude-2-capability-meaning (`meaning.author`)

- **Bridge placement (retire target):** `altitude-2-capability-meaning-stub-port`.
- **Successor:** C projected child `sda-projected-capability-invocation-port.v2` bound to the live child
  `obtain-governed-model-response` (nests B; the retired siblings fail closed and are not restored).
- **Install counterpart (CRUD):** placement doc §C1-C3: `model.put_semantic_definition 'PORT'` with
  `bindingDigest`/`capabilityAuthorityDigest`/`requestPath`/`lineageMode:"retain-nested-execution"`/
  `resultMode`/`resultPath`/`declaredApplication`, insert `model.port_version`, relink
  `model.operation_port_invocation`; or C3b `operation_scenario_invocation` into the live child. Output
  writer: `capability-authoring` (crud §5.2 row 1) -> `model.author_capability_meaning`.
- **Retire code bridge (CRUD):** C-R1 fail-closed retire (`bindingRef`/`bindingBase` -> NULL + new
  `port_version` + relink; runtime throws `PROJECTED_CAPABILITY_V2_CONFIGURATION_MISSING`), C-R2 remove
  the operation link, C-R3 delete the placement row via `model.retire_model_placement` (placement doc §2.3).
- **Verification:** `sfx capability invoke author-one-scenario-candidate --input @fixture.json --json`;
  lane nested `provider-exchange-shape.v1` 200 + `modelResponse`; candidate receipt under
  `sidefx:candidates` (readable once `candidate.read` is declared, crud §4.1).
- **Admitted today:** no (needs `capability-authoring` + placement writer).

## 3. `sfx-authoring-altitude-03` - altitude-3-scenario-io (`scenario.author`)

- **Bridge placement (retire target):** `altitude-3-scenario-io-stub-port`.
- **Successor:** C projected child onto the live child (or C3b invoke-scenario), replacing the conveyor's
  D no-op `model-invoker-port` -> `transform-conveyor-evidence`.
- **Install counterpart (CRUD):** placement doc §C1-C3/C3b as provider 2. Writer: `scenario-authoring`
  (crud §5.2 row 3) -> `model.declare_scenario` `@scenario`/`@operations`/`@port_bindings` + fixtures +
  receipt `<scenarioId>.authored.v1`.
- **Retire code bridge (CRUD):** D-R1 authority re-mint without the no-op operation (placement doc §D
  DELETE) plus C-R1/C-R3 for the stub port.
- **Verification:** `sfx capability invoke author-capability-scenario-conveyor --input @fixture.json
  --json`; lane nested provider exchange 200 + `modelResponse`; scenario `transitions` non-empty (today `[]`).
- **Admitted today:** pinned only (`scenario-registration` is fixed to `say-hello-world`).

## 4. `sfx-authoring-altitude-04` - altitude-4-contracts-schemas (`contract.author`)

- **Bridge placement (retire target):** `altitude-4-contracts-schemas-stub-port`.
- **Successor:** C projected child onto the live child.
- **Install counterpart (CRUD):** placement doc §C1-C3. Writer: `contract-change` (crud §5.2 row 2) ->
  `model.declare_contract` (new) / `model.configure_contract` (revision); declare the S4 `contract.read`
  row (`crud-operations.md` §2.1 S4) for review.
- **Retire code bridge (CRUD):** C-R1 fail-closed retire + C-R2 operation removal + C-R3 via
  `model.retire_model_placement`.
- **Verification:** invoke the contract unit; lane nested provider exchange 200 + `modelResponse`; the
  returned schema digest equals the written `model.contract_version.definition_digest`.
- **Admitted today:** no.

## 5. `sfx-authoring-altitude-05` - altitude-5-semantic-authority-envelope (`semantics.author`)

- **Bridge placement (retire target):** `altitude-5-semantic-authority-envelope-stub-port`.
- **Successor:** rides the parent altitude's C/B child; the envelope is written by the existing
  `model.put_semantic_definition` (no standalone model port; a standalone wrapper would be new code).
- **Install counterpart (CRUD):** the parent kind installer (`capability-authoring`, crud §5.2 row 1;
  `contract-change`, row 2; `transformation-change`, row 4) passes the model's `normalizedResponse` as the
  `@semantics` argument.
- **Retire code bridge (CRUD):** retire the D stub with the parent swap: `model.retire_model_placement`
  (placement doc §2.3), D-R1 operation removal.
- **Verification:** parent invocation's `modelResponse` + `analysis.v_selected_semantic_definition` shows
  the new selected definition digest with the `$.semantics` keys (Appendix A §5 query).
- **Admitted today:** no (rides the parent kinds).

## 6. `sfx-authoring-altitude-06` - altitude-6-transformation-ast (`ast.author`)

- **Bridge placement (retire target):** `altitude-6-transformation-ast-stub-port`.
- **Successor:** C projected child for generation; D `sda-authority-transformation-port.v1` +
  `model.normalize_transformation_expression` for normalization/execution. The model id stays data in
  `resolve-model-alias-embodiment.v1` (D re-put).
- **Install counterpart (CRUD):** placement doc §C1-C3 + §D1-D3. Writer: `transformation-change`
  (crud §5.2 row 4) -> `model.put_semantic_definition 'TRANSFORMATION'` +
  `model.transformation`/`transformation_version` + `model.normalize_transformation_expression`.
- **Retire code bridge (CRUD):** C-R1; D-R1 authority re-mint without the operation; D-R2
  `model.remove_mechanic` if the stub attached a mechanic; placement row via `model.retire_model_placement`.
- **Verification:** invoke the solution unit; lane nested provider exchange 200 + `modelResponse`; the
  new `transformation_version` digest and normalized node/child counts (Appendix A §6).
- **Admitted today:** no; `ast.repair` has no mechanical-repair unit.

## 7. `sfx-authoring-altitude-07` - altitude-7-execution-authorities-ports (`authority.author`)

- **Bridge placement (retire target):** `altitude-7-execution-authorities-ports-stub-port`.
- **Successor:** C projected child onto the live child.
- **Install counterpart (CRUD):** placement doc §C1-C3. Writer: `execution-authority-change` (crud §5.2
  row 5) -> `model.declare_scenario` authority/port sections + `model.bind_provider` (re-points
  `operation_port_invocation`) + `model.scaffold_composed_capability`.
- **Retire code bridge (CRUD):** C-R1/C-R2; de-select with `DELETE model.estate_definition`; placement row
  via `model.retire_model_placement`.
- **Verification:** invoke the authoring capability - graph compilation passes in preflight; lane nested
  provider exchange 200 + `modelResponse`; Appendix A §7 shows the new authority version and
  `operation_links=1`.
- **Admitted today:** append-only (`provider-binding` cannot revise a route).

## 8. `sfx-authoring-altitude-08` - altitude-8-providers-bindings-overlays (`provider.author`)

- **Bridge placement (retire target):** `altitude-8-providers-bindings-overlays-stub-port`.
- **Successor:** B provider route, already declared/admitted: `provider-binding-change.v1` installed by
  `model.install_provider_binding_change` (`sfx provider add`).
- **Install counterpart (CRUD):** placement doc §B0 (`EXEC model.install_provider_binding_change
  @document=...`; endpoint/credential/mapping/preflight/verify fields at `:51-89`); model proposal half:
  publish `provider-binding-change.v1` as a kernel schema + declare the proposal capability (flywheel
  Phase 0/2, `crud-operations.md` §5.1/§5.2). Overlays stay DERIVED DML (`JSON_MODIFY` row copy).
- **Retire code bridge (CRUD):** retire the code-authored document path once the proposal capability
  installs the same document; the installed B route is the successor and is not retired. Route revision
  remains append-only (new route id; same `routeId` returns `already_installed`).
- **Verification:** `sfx provider add --input @spec.json --dry-run` -> `ROLLED_BACK` + preflight
  testimony, then install -> `provider-change-installed.v1`; invoke the target capability and assert
  `provider-exchange-shape.v1` from the installed host + replay `already_installed`; placement doc §B READ
  (injection rule/header/endpoint digest/`operation_links`).
- **Admitted today:** **yes** (route install).

## 9. `sfx-authoring-altitude-09` - altitude-9-interface-cli-display (`interface.author`)

- **Bridge placement (retire target):** `altitude-9-interface-cli-display-stub-port`.
- **Successor:** rides the parent `capability-authoring` C/B call; CLI document written by
  `model.configure_interface` and delivered by `sda-json-cli.v1`.
- **Install counterpart (CRUD):** parent kind installer (`capability-authoring`, crud §5.2 row 1);
  `model.configure_interface` with `{"input":{type,contract,path},"display":{select,as},"defaults"}`.
- **Retire code bridge (CRUD):** parent swap; `model.retire_model_placement` for the stub port.
- **Verification:** invoke the capability `--json`; lane nested provider exchange 200 + `modelResponse`;
  read `$.semantics.cli` and the assembled interface authority (Appendix A §9).
- **Admitted today:** no.

## 10. `sfx-authoring-altitude-10` - altitude-10-fixtures-proof (`fixture.author`)

- **Bridge placement (retire target):** `altitude-10-fixtures-proof-stub-port`.
- **Successor:** rides the parent `scenario-authoring`/`capability-authoring` C/B call; fixtures written by
  `model.add_example` or the `$.fixtures` block of `model.install_scenario_change`.
- **Install counterpart (CRUD):** parent kind installer + fixture member (crud §5.2 rows 1/3); contract
  `consumer-capability-fixtures.v1`; executed by the `capability-fixtures` verification recipe.
- **Retire code bridge (CRUD):** parent swap; `model.retire_model_placement`; no proof-obligation writer
  exists, so the proof-obligation half stays a named gap, not a bridge entry.
- **Verification:** `capability-fixtures` preflight (terminal scenario + sequence + outcome assertions);
  `sfx capability observe <capability> --input @fixture.json --json`; lane nested provider exchange 200 +
  `modelResponse` (Appendix A §10).
- **Admitted today:** pinned only (fixtures only for `say-hello-world`).

## 11. `sfx-authoring-altitude-11` - altitude-11-alignment-evaluation (`alignment.evaluate`)

- **Bridge placement (retire target):** `altitude-11-alignment-evaluation-stub-port`.
- **Successor:** B evaluator capability route (plus C child) with receipt-only writers
  `alignment-evaluation` -> `model.record_alignment_evaluation` and `candidate-decision` ->
  `model.record_candidate_decision` (`crud-operations.md` §7.1), and declaration-controlled concurrent
  dispatch (`mode:"concurrent"`, `maximumActiveBranches`, all-required join; precedent
  `switch-dispatch-pair-demo-concurrent.sql`).
- **Install counterpart (CRUD):** declare the evaluator capability + B route (placement doc §B0 or C via
  §C1-C3); declare the two kinds with the ACCEPTED-receipt gate (crud §7.2); the
  `alignment-evaluation.v1` contract is already live.
- **Retire code bridge (CRUD):** retire the D stub via `model.retire_model_placement` (placement doc
  §2.3); D-R1 operation removal.
- **Verification:** broadcast `run-declared-change prepare -> dry-run -> preflight -> install -> verify`;
  lane one `provider-exchange-shape.v1` + `modelResponse` per provider branch; `candidate.read` returns
  the ten dimensions + `convergenceDistance`.
- **Admitted today:** no.

## Shared machinery the swaps depend on

- Placement writers (PROPOSED): `model.install_model_placement_change`, `model.replace_port_configuration`,
  `model.retire_model_placement` (placement doc §2) - every swap except A1/A8 needs the first and third.
- Output-writer kinds (PROPOSED): `capability-authoring`, `contract-change`, `scenario-authoring`,
  `transformation-change`, `execution-authority-change`, `feature-binding-change`
  (`crud-operations.md` §5.1/§5.2) plus the ACCEPTED gate (§7.2).
- Reads: re-pointed `list-tools` (crud §1.3), `select-authoring-tool` route (crud §3), `candidate.read`
  (crud §4.1).
- Evidence rule: a retirement without the invocation + lane proof above is unrecorded; `providers_retired`
  does not move and the state remains `PROVIDER_BRIDGE_SUCCESSOR_OVERDUE` once the successor is admitted.
