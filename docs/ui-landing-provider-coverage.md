# UI landing providers — closeout handoff

Updated 2026-10-09 after live local acceptance. This replaces the earlier
uninstalled-binding and blocked-acceptance status.

## Accepted

The hosted provider API is deployed from commit 9703942 at
https://sfx-ui-providers.azurewebsites.net. Each declared provider has its own
folder with the identical provider name. Header, left sidebar, middle, right
sidebar and drill-down are version 0.1.0; footer is 0.2.0; tokens are 0.1.1.
The API's deterministic read-only invocations are public.

The estate now has all six hosted providers bound and installed. Its circuit
uses the existing equity credential/HTTPS carrier and the previously stored
UI credential reference. The public provider API does not require that key.
No new credential or kernel change is needed to run the accepted circuit.

Request:

```json
{"contractId":"ui-page-request.v1","payload":{"path":"/circuit/explorer"}}
```

The installed-kernel acceptance captured six completed provider exchanges:
header, left, middle, right and footer returned AUTHORED; drill-down and landing
returned READ. The SQL migration history and the six-provider receipt are in
sfx-embody/docs/research/ui-landing/ (through commit 6441cce).

The subsequent browser Run API invocation on localhost:8788 completed as
03fdc8c6-147d-474b-9d35-f1da0377b8f1: READ, exit 0, 5.15 seconds,
364 cell and 363 edge observations. The request path is /circuit/explorer.
The platform's docs/ui-landing-acceptance/ records that browser result and a
separate preceding capture used for regression verification. Local run storage
is in memory; do not treat its URL as durable after a restart.

## Explorer receipt fix

Composed child scenarios have a declared return edge to their caller, rather
than a parentCellId. The platform now follows that exact graph relationship
and requires matching admitted return evidence to light the completed call.
Four root calls pass, including live activity before return; 32 malformed or
missing-evidence cases remain unlit with named diagnostics.

The two matching shared browser-module edits in this repository are still
uncommitted. Their provider packages need versioned publication and updated
consumer selections before the full browser-provider rollout. They must not
be silently published under an already selected asset manifest.

## What remains

1. Finish Stage B: the platform becomes a thin consumer of hosted provider
   browser modules and declared mounts. Its unfinished selection/packaging
   edits are preserved locally and are not the accepted rollout.
2. Publish the provider browser receipt fix with appropriate versions and
   update the admitted consumer selections together.
3. Verify the complete browser consumer locally, then use the platform's
   normal staging release workflow and its real acceptance/rollback gates.

The current platform release carries the receipt join, its offline regression
and local acceptance evidence. It still renders Explorer from its existing
pinned region packages, while the invoked estate circuit calls Azure.

Root READ returns declared page/layout metadata, not all provider bodies.
Acceptance must check each child return; root READ alone is insufficient.
The full Node transaction preflight lacked the vault host context for HTTPS;
the installed C# run supplied the actual provider-call acceptance evidence.

Keep local identity, Run API and provider selection configured together. The
running inspection host is localhost:8788, with the API on 8799. An observer
health response alone does not prove its regions or sign-in configuration.
