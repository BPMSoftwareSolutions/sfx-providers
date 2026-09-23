# Code providers are an admitted migration bridge

The eleven authoring-altitude code providers (the local HTTPS services `providers/altitude-01.mjs` ..
`altitude-11.mjs`, `providerId` = `sfx-authoring-altitude-NN`, recorded in `../bridge.policy.json`, baseline
11, recorded 2026-09-22) are admitted once, as a migration bridge, so the authoring surface can run before
every declared-data counterpart exists. A code provider may only shrink: `providers_remaining` never
exceeds the recorded baseline, no additional code provider may be added to the admitted surface
(`PROVIDER_BRIDGE_GROWTH_REFUSED`), and each retirement is evidenced - the declared-data counterpart is
installed (`docs/swap-in-map.md` per provider), the bridge placement is retired, and the swap is proven by
an invocation plus its lane event before `providers_retired` is incremented. Any provider whose successor
is admitted while the code bridge is still selected is overdue (`PROVIDER_BRIDGE_SUCCESSOR_OVERDUE`);
declaring data remains the destination, and the bridge only buys time.

For the broader architectural rationale, see
[Capability estate modernization](capability-estate-modernization.md), the
[evidence model](modernization-evidence-model.md), and the
[absorption playbook](capability-absorption-playbook.md). Those proposals do not
change this bridge's admission ceiling, successor requirements, or retirement proof.
