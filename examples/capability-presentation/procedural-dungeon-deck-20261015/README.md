# Procedural dungeon deck — first declared slice

The capability deck for `procedural-dungeon-governed-execution`, generated from
the estate reader after the spec-driven circuit proposal (run `55f4dc84`) was
declared through the governed pipeline (DSL authoring runs `1cbd638a` original,
`b649b469` re-expression; scaffold residue repair committed before generation).

* Live invocation: run `01745a9f` (and `a5b606c4`, `52b62c11`) — GENERATED,
  seed 20261015, 40 rooms, 39 spawns, digest
  `sha256:63845ca450def519210e8f714117ff5c6c7e8531037d29d5e4fa2df70eff7260`,
  reproduced identically by the install probe.
* Named refusal: run `4e224e22` — `DUNGEON_SEED_INVALID` retained.
* Deck: 62 slides, 2 volumes, contentDigest
  `ef375297e3e4b65998bc3e678508564851ac867d2d8c1ff69ae3be8430783634`.
* Regenerate: `node capability-deck.mjs --capability-id procedural-dungeon-governed-execution --output <dir> --pptx`.

Divergences from the proposal (recorded, not worked around): transformation
ports embodied as declared deterministic mechanics; simulated providers embodied
deterministically (no external provider in slice 1); invoke-scenario routing
cycle and outcome variants deferred (scenario outcome variants are the known
missing DSL construct); root scenario id is the capability id per estate root
convention; terminal flag true in the slice.