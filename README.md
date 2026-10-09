# sfx-providers

The four [CLI login providers](providers/cli-login/README.md) implement private
input acquisition, principal resolution, Argon2id verification and session
creation. They use the generated SFX.Identity.DAL against `sfx-identity`; their
provider and live database checks are recorded separately from pending API/CLI
deployment and estate admission.

The hand-authored **circuit-presentation provider** packages the reusable diagram
design used for the SideFX announcement: native circuits, branches, junctions,
provider bindings, signal colors, source links and speaker notes. See
[Circuit presentations](docs/circuit-presentation.md) for the JSON contract,
HTTPS endpoint, CLI, PowerPoint export and retained authoring sources.

The provider also generates [capability presentations](docs/capability-presentation.md)
from a selected estate `capabilityId`, combining a semantic circuit view with all
eleven authoring context layers. Use `node capability-deck.mjs --help`.

The UI runtime providers (Explorer regions, shell footer, token set) are
[hosted](docs/ui-provider-hosting.md): consumers read their manifests and
digest-verified assets and invoke them over HTTP (`npm run ui-providers`)
instead of copying or importing provider code.

The [live circuit data and navigation contract](docs/live-circuit-data-contract.md)
describes database-driven selection and drill-down without requiring a deck export.

```powershell
node circuit-deck.mjs --preset sidefx-announcement --output outputs/circuit-replay
```

This user-requested provider is separate from the eleven-altitude migration bridge
and is not yet declared in the estate.

Local HTTPS providers: eleven authoring-altitude model services and a separate
hand-authored **audio-to-text provider**. The altitude services implement each
altitude's deterministic work in code; audio transcription runs a local speech model.

For audio setup, CLI/HTTPS invocation, contracts, and the deferred sfx-embody migration,
see [Audio-to-text](docs/audio-to-text.md). Quick start after installing its Python
requirements: `node transcribe.mjs <audio-file> --language en`.

The eleven altitude providers are a **declared migration bridge**: code now, declared data later, shrink-only.
The admission ceiling, per-provider successors and the shrink-only rule live in
[`bridge.policy.json`](bridge.policy.json); the compact-request migration that removes the
24.8 MB envelope (`DELIVERY_TIMEOUT`) is planned in
`scenario-driven-architecture/docs/compact-altitude-request-plan-2026-09-22.md`.
Each provider mirrors one STUB altitude already declared in the estate capability
`authoring-altitude-model-stubs` (see `sfx-embody/sql/migrations/declare-authoring-altitude-model-stubs.commit.sql`
and `scenario-driven-architecture/docs/authoring-altitude-model-stubs-2026-09-21/`). When an
altitude's declared writer kind and output land in the estate, that provider is deleted
from `providers/`; that altitude set never grows. The separately requested
`sfx-audio-to-text` provider is outside that admitted bridge surface and is not yet
declared in the estate.

## Architecture documentation

The [documentation index](docs/README.md) connects this bridge to the broader
capability-estate modernization model: execution authority, external provider
boundaries, evidence and metrics, and scenario-based absorption. It distinguishes
current repository behavior from proposed estate capabilities and operating rules.

## Layout

```
README.md
package.json           scripts only, no dependencies
setup-cert.ps1         current-user self-signed localhost cert (PFX + CER + PEM + trust)
server.mjs             one HTTPS process serving 11 altitude providers + audio-to-text + hosted UI providers
ui-providers-host.mjs  deployable HTTP host for the UI providers only
runner.mjs             starts the server, prints PROVIDERS_READY
transcribe.mjs         local audio CLI; exports TXT, JSON and SRT artifacts
requirements-audio.txt Python speech-recognition dependency
providers/
  altitude-01.mjs ... altitude-11.mjs
  audio-to-text.mjs    hand-authored audio.transcribe provider
certs/                 created by setup-cert.ps1 (gitignored)
```

## Providers

The contract and model-call sections below describe the altitude bridge. The
[audio provider documentation](docs/audio-to-text.md) defines its separate contracts
and local execution behavior.

Each altitude module exports `{ altitude, toolId, inputShape, outputShape, handle(input, options) }`
plus metadata (`altitudeId`, `altitudeName`, `providerId`, `foldedTools`, `modelPrompt`).
Input is the compact request contract `altitude-model-request.v1` (see below; `altitude`,
`toolId`, `objective` and `inputContractId` are required). The candidate conforms to the
altitude's declared
output contract from `authoring-altitude-model-stubs` (all 12 contract ids below are
EXISTING; they were resolved live with
`sfx capability reveal authoring-altitude-model-stubs --json` on 2026-09-22 and match the
committed declaration).

| # | module | altitudeId (declared stub scenario) | toolId / route | folded tools | candidate contract (EXISTING) |
| ---: | --- | --- | --- | --- | --- |
| 1 | altitude-01.mjs | altitude-1-feature-parse | feature.resolve | intent.parse, feature.pin | altitude-1-feature-parse-output.v1 |
| 2 | altitude-02.mjs | altitude-2-capability-meaning | meaning.author | — | altitude-2-capability-meaning-output.v1 |
| 3 | altitude-03.mjs | altitude-3-scenario-io | scenario.author | — | altitude-3-scenario-io-output.v1 |
| 4 | altitude-04.mjs | altitude-4-contracts-schemas | contract.author | contract.validate | altitude-4-contracts-schemas-output.v1 |
| 5 | altitude-05.mjs | altitude-5-semantic-authority-envelope | semantics.author | — | altitude-5-semantic-authority-envelope-output.v1 |
| 6 | altitude-06.mjs | altitude-6-transformation-ast | ast.author | ast.normalize, ast.repair | altitude-6-transformation-ast-output.v1 |
| 7 | altitude-07.mjs | altitude-7-execution-authorities-ports | authority.author | port.bind | altitude-7-execution-authorities-ports-output.v1 |
| 8 | altitude-08.mjs | altitude-8-providers-bindings-overlays | provider.author | provider.read, overlay.bind | altitude-8-providers-bindings-overlays-output.v1 |
| 9 | altitude-09.mjs | altitude-9-interface-cli-display | interface.author | — | altitude-9-interface-cli-display-output.v1 |
| 10 | altitude-10.mjs | altitude-10-fixtures-proof | fixture.author | proof.obligation.author | altitude-10-fixtures-proof-output.v1 |
| 11 | altitude-11.mjs | altitude-11-alignment-evaluation | alignment.evaluate | candidate.decide, alignment.broadcast | altitude-11-alignment-evaluation-output.v1 |

Shared request contract: `altitude-model-request.v1` (see below). Candidate contract
ids are the altitude output contracts only; no PROPOSED id is used for a candidate. The
tool-level contracts exposed as metadata (`inputShape.toolInputContract`,
`outputShape.toolOutputContract`) come from
`scenario-driven-architecture/docs/llm-authoring-tools-2026-09-21/tool-to-altitude.v1.json`
and carry their own status: `scenario-authoring-change.v1`, `contract-change.v1`,
`contract-change-installed.v1`, `transformation-change.v1`,
`transformation-change-installed.v1`, `execution-authority-change.v1`,
`execution-authority-change-installed.v1`, `interface-change.v1`,
`interface-configured.v1`, `fixture-installed.v1`, `alignment-evaluation-receipt.v1` are
PROPOSED in that catalogue; the rest are EXISTING.

### Request contract (`altitude-model-request.v1`)

The bridge providers accept only the compact request shape; context is referenced, never
re-embedded:

```json
{
  "altitude": 4,
  "toolId": "contract.author",
  "objective": "<declared user objective>",
  "inputContractId": "contract-change.v1",
  "contextRefs": [{ "kind": "contract", "id": "<declared id>", "digest": "sha256:…" }],
  "contextSlices": [{ "ref": "<digest>", "document": "<bounded selection>" }]
}
```

- `contextRefs` are handles resolved under the pinned authority; only bounded
  `contextSlices` (the existing bounded `document-select` selections) travel in the body.
- **Size cap: 256 KB.** A body larger than the cap is refused with
  `ALTITUDE_REQUEST_OVERSIZED` (HTTP 422, `disposition: "HELD"`, `candidate: null`) before
  any model call; the response reports the observed `requestBytes`.
- **Embedded context refusal.** Any request carrying `graphSource`, `authority`, `catalog`,
  `plan` or `currentInvocationRequest` is refused with
  `ALTITUDE_REQUEST_EMBEDDED_CONTEXT` (HTTP 422).
- Legacy members (for example `contractId`/`payload`) are refused with
  `ALTITUDE_REQUEST_UNKNOWN_MEMBER`; `altitude`/`toolId` must match the provider route.
- `handle` derives its optional deterministic inputs from `contextSlices[].document`
  (merged in order), so candidates stay deterministic without an embedded payload.

### Deterministic work per altitude

`handle` validates the compact request (plus the slice-derived payload's altitude fields),
builds the altitude's candidate document deterministically, and returns
`{ disposition, candidate, findings }`; the server then checks the candidate against the
declared output schema. Examples: altitude 4 validates `$schema`/`$id` and digests the
schema; altitude 6 validates `expression.op` and counts normalized nodes; altitude 7
validates operation kinds and recomputes `operation_count`/`definition_digest`; altitude
11 requires the ten alignment dimensions and computes `convergenceDistance`. Every
candidate carries a deterministic `canned.documentDigest` (sha256 over the canned
document), so the same input always yields the same candidate. Invalid input returns
`disposition: "HELD"`, `candidate: null` and `findings` (HTTP 422).

## Run

```powershell
# once per machine: creates certs/localhost.pfx + .cer + .pem and trusts the cert
powershell -ExecutionPolicy Bypass -NoProfile -File .\setup-cert.ps1

# start all providers (default port 8790; override with PROVIDER_PORT)
$env:PROVIDER_PORT = '8790'
node .\runner.mjs            # prints: PROVIDERS_READY port=8790 providers=13

# health (all 11)
1..11 | ForEach-Object {
  $nn = '{0:d2}' -f $_
  Invoke-RestMethod "https://localhost:8790/altitude-$nn/health"
} | Format-Table altitude, altitudeId, toolId, outputContract

# invoke one altitude with a compact request
$body = @{
  altitude = 1
  toolId = 'feature.resolve'
  objective = 'Resolve the AVGO market-price capability feature'
  inputContractId = 'capability-feature-authoring-request.v1'
  contextRefs = @()
  contextSlices = @()
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri 'https://localhost:8790/altitude-01/feature.resolve' `
  -ContentType 'application/json' -Body $body

# zero-dependency tests (node:test)
npm test        # or: node --test tests

# stop
# Ctrl+C (server closes on SIGINT/SIGTERM)
```

PowerShell/.NET use the Windows current-user root store, so the cert is trusted without
extra flags. Node clients do not read the OS store; point them at the exported PEM:

```powershell
$env:NODE_EXTRA_CA_CERTS = "$PWD\certs\localhost.pem"
```

## Response contract

```json
{
  "providerId": "sfx-authoring-altitude-01",
  "altitude": 1,
  "toolId": "feature.resolve",
  "disposition": "AUTHORED",
  "candidate": {
    "contractId": "altitude-1-feature-parse-output.v1",
    "altitude": 1,
    "altitudeId": "altitude-1-feature-parse",
    "altitudeName": "Feature parse",
    "stub": true,
    "shapeSource": "tool-to-altitude.v1.json#feature.resolve",
    "canned": { "...": "altitude artifact", "documentDigest": "sha256:..." }
  },
  "providerExecution": "stub",
  "elapsedMs": 0.42,
  "requestBytes": 612
}
```

`disposition` is `AUTHORED` (HTTP 200) or `HELD` (HTTP 422, `candidate: null`,
`findings`). When a candidate passes the declared output schema the response also carries
`shapeConforms: true`. `providerExecution` is `"stub"` for the canned candidate and
`"model"` when the optional Gemini call succeeded. `requestBytes` is the measured request
size (raw body bytes when served over HTTPS, JSON bytes for direct `handle` calls); it is
reported for every response, including refusals.

## Honest model-call status

- Without `GEMINI_API_KEY` or `LOC_GEMINI_API_KEY`: no model call is attempted;
  `providerExecution` is always `"stub"` and the candidate is the coded altitude document.
- With either key set: the server calls
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent`
  (header `x-goog-api-key`) with a prompt built only from the altitude prompt, the
  `objective`, the declared tool contract, the `contextRefs` handles and the bounded
  `contextSlices` (capped again at 64 KB for the prompt). Authority documents are never
  inlined. On success it sets `providerExecution: "model"` and `canned.modelOutput` /
  `canned.modelId`. A failed call falls back to `"stub"`, records `canned.modelCallError`
  (`status`, bounded `message`), and the response carries a `modelCall` diagnostic when a
  key is configured.
- The key is never logged, echoed, or written to disk; request/response captures are
  never written to the repo. `GET /health` only exposes `modelCallConfigured`.

## Declaring through the estate (`provider add`)

Once these endpoints are running, each can be declared through the admitted
`provider-binding` kind by an existing capability. Sketch of the document the admitted
installer reads (`provider add --input <spec.json> --dry-run` first):

```jsonc
{
  "contractId": "provider-binding-change.v1",
  "providerId": "sfx-authoring-altitude-01",
  "capabilityId": "<existing capability>",
  "outcomeContractId": "altitude-1-feature-parse-output.v1",
  "bindingId": "sfx-providers-altitude-01",
  "route": { "routeId": "sfx-providers-altitude-01", "resolvedDisposition": "AUTHORED" },
  "endpoint": {
    "host": "localhost", "method": "POST",
    "pathPrefix": "/altitude-01/feature.resolve",
    "requestTemplate": "https://localhost:8790/altitude-01/feature.resolve",
    "safeHeaders": { "content-type": "application/json" },
    "timeoutMilliseconds": 60000, "maxResponseBytes": 524288
  },
  "mapping": { "candidate": "candidate" },
  "preflight": {
    "input": {
      "altitude": 1,
      "toolId": "feature.resolve",
      "objective": "<declared objective>",
      "inputContractId": "capability-feature-authoring-request.v1",
      "contextRefs": [],
      "contextSlices": []
    }
  },
  "verify": { "capabilityId": "<existing capability>", "input": {} }
}
```

Bridge rule: an altitude's provider is removed only when that altitude's declared
writer kind/output is installed in the estate; 11 → 0, shrink-only.

## What is not implemented

The providers implement deterministic candidate construction and shape conformance in
code; they do not install estate rows, call declared procedures, or write receipts.
Altitude-specific model generation is a prompt-only addition inside `canned.modelOutput`
and is never claimed to conform beyond the wrapper checks. Where an altitude's writer
kind is still PROPOSED in `tool-to-altitude.v1.json`, the provider is the bridge for that
altitude, not a substitute for the declared kind.
