# AGENTS.md

`sfx-providers` is the observation surface of the estate: it reads a selected
capability from the live database and generates the capability deck (circuit,
blueprint, review findings, PowerPoint). It does not author estate meaning. The
north star is
[sidefx-equals-rsi.md](../scenario-driven-architecture/docs/sidefx-equals-rsi.md):
**Governed Recursive Capability Improvement** - the system uses evidence from
its own execution to propose, prove and admit improvements, while independent
authority still decides what becomes durable.

## The loop

Deck generation is where the loop observes. Every contribution is one turn:

1. **Execute a capability** against the live estate.
2. **Observe evidence** - generate the deck for the affected capability and
   read its findings (`node capability-deck.mjs ...`).
3. **Reason from evidence**, not from assumed intent.
4. **Propose a declared change** - an estate migration in `sfx-embody`; never a
   capability-specific edit here.
5. **Conform** - refusals, digests, reference checks, the estate's preflight.
6. **Admit** - the change becomes part of the estate.
7. **Regenerate and verify** - the deck closes its findings.

Each cycle must leave the machinery more capable than it found it: reusable
projection mechanics, fewer rediscoveries, more deterministic coverage.

## Evidence law

The live database is the source of truth. A deck, its snapshot and its JSON/SVG
outputs are projections and hypotheses; they become evidence only when their
facts are checked against the estate's rows in
`sfx-embody/sql/inspect/<topic>/`. Decode retained text with the UTF-8 cast
idiom; always pair lists with counts; a missing slide, panel or finding entry is
not proof of absence. The renderer reports missing associations and prose, it
never invents them.

## Ask first: why isn't this data?

Capability knowledge belongs in the estate as declared authority. Before adding
behavior to a generator, ask whether the concern can be read from rows instead.
If a presentation need genuinely requires executable behavior, it is a
**cross-language request** (three-language obligation, conformance evidence) or
an estate migration in `sfx-embody` - never a local hack. Never encode a
specific capability, scenario, contract or provider identity in the generator:
it is driven by `--capability-id` / `--snapshot` and stays capability-neutral.

The altitude providers under `providers/` are the deliberate exception: a
declared migration bridge, shrink-only, governed by `bridge.policy.json`. They
carry altitude knowledge only until the estate declares the corresponding
writer kind; that set never grows.

## Repair discipline

- Findings are the observation surface: stable deck finding codes (for example
  `BINDING_NOT_INVOKED`) map to declared repairs.
- Every database change is a migration pair authored in `sfx-embody`: a
  preflight ending in `ROLLBACK` and a commit twin ending in `COMMIT`,
  idempotent, keys discovered from rows, with verification inside the
  transaction; inspect sets under `sql/inspect/<topic>/` state what each proves.
- Regenerating the deck from this repository is the acceptance test; every
  finding must map to a declared repair, and closure must be intact.
- If a repair cannot be declared, the missing writer or procedure is the next
  unit of work - record it; never hand-edit rows silently.
- Retire false narratives with rows, not prose.

## Installed writers to prefer (one line each)

- `model.declare_scenario` - declares a capability scenario with operations and ports.
- `model.remove_scenario_operations` - removes operations and their circuit residue.
- `model.remove_capability_scenario` - unlinks a scenario from a capability.
- `model.repoint_capability_feature` - binds a capability to a feature version.
- `model.reconcile_scenario_variants` - reconciles declared outcome variants.
- `model.remove_scenario_circuit_residue` - removes remaining circuit residue.
- `model.declare_capability_envelope` - declares the capability envelope.
- `model.declare_capability_interface` - declares the CLI/interface projection.
- `model.declare_port_overlay_rule` - declares a port overlay rule.
- `model.bind_provider` - binds a provider to a port or platform capability.
- `model.replace_port_configuration` - replaces a port configuration.
- `model.declare_provider_port` - declares a provider platform port.
- `model.declare_provider_mechanic` - declares a provider mechanic.
- `model.declare_contract` - declares a contract schema.
- `model.put_semantic_definition` - writes the semantic definition primitive.

These are installed in the live database and are authoritative for their
concerns. Do not replace one with hand-written INSERT/UPDATE/DELETE unless
inspect evidence shows the procedure cannot express the change.

## Non-negotiables

- Deck generation and findings are the observation surface; finding codes map
  to declared repairs.
- Never encode capability knowledge in the generator.
- A change that names a specific capability, scenario, contract, provider or
  port in generator code is a defect: stop and declare it instead.
- A missing slide or result set is not an empty list.
