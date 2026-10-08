# landing-circuit declaration

A declaration-data instance of the circuit presentation pipeline (`capability-deck.mjs`).
The deck is produced from `declaration.json`; no slide is hand-authored and no database read is
needed to regenerate it.

## Sources

* `landing-circuit.base.json` — the landing circuit, its login entry, the four region circuits,
  the provider drill-down circuit, the user-action lighting transitions and the host/region
  bindings, transcribed from:
  * `sfx-platform/docs/sfx-website-product-evolution/landing-blueprint.md` (revision 2)
  * `sfx-platform/docs/sfx-website-product-evolution/ui-explorer-region-blueprint.md` (revision 2)
  * `sfx-platform/docs/sfx-website-product-evolution/ui-circuit-blueprint-strategy.md`
  * `sfx-providers/providers/ui-explorer-region/ui-explorer-region.mjs` (region identities, roles,
    port and operation names)
  * `sfx-platform/live-circuit/circuit/circuit-host.json` (readers and identity circuit pointer)
  * `sfx-embody/sql/migrations/declare-authenticate-ide-user.sql` and
    `bind-authenticate-ide-user-private-host.sql` (login contracts, providers, three server
    operations and their live HTTP bindings)
* `imports` — the retained `request-capability-from-objective-v3` closure (scenario name and
  descriptions, eleven-operation authority, ten port bindings, two contracts, five
  transformations, one interface) copied from a capability-presentation snapshot by
  `extract-closures.mjs`. The import keeps the source file and digest in
  `provenance.imports`.

`declaration.json` is the committed generation input. Regenerate the import block with:

```powershell
node extract-closures.mjs --objective-snapshot <request-capability-from-objective-v3>/snapshot.json
```

## Generate

```powershell
node capability-deck.mjs --declaration examples/capability-presentation/landing-circuit/declaration.json `
  --view capability --context-altitude all --output <new-directory> --pptx
```

Deterministic: the same declaration yields the same `contentDigest`; the written `snapshot.json`
replays through `--snapshot` to the same digest. The one `error` review finding is the declared
`readiness.execution: HELD` state of the proposal; the warnings are the five host-reader
platform bindings that declare no provider identity and the standard declaration-only gaps.
