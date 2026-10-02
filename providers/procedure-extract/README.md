# Procedure extraction through the generated DAL

The stored procedure owns retrieval semantics. `ProcedureExtractor` resolves its
generated `SFX.DAL.Repositories` class, invokes `ExecuteAsync`/`Execute`, and
exports `ProcedureCallResult.ResultSets`. It does not recreate SQL joins or keep
a provider-specific list of fields. Each table becomes a workbook sheet; `_meta`
records the procedure, parameters, timestamp, row counts and column counts.

Procedure identities must be present in `SFX.DAL.Config.json` and generated into
the referenced DAL assembly. Regenerate and rebuild when signatures change.
Dynamic result-set tables preserve additional columns and result sets without
extractor edits. Verify the current executable as well as the source: a previously
published binary can predate the generated-DAL implementation.

For example, from this repository, with the existing `sidefx-connection-string`
environment setting:

```powershell
& .\providers\procedure-extract\bin\Release\net8.0\procedure-extract.exe `
  --procedure analysis.read_provider_canonical_body `
  --params '{"provider_id":"google/gemini-select"}' `
  --output .\outputs\gemini-select-extract-verified.xlsx
```

## HTTP API

`--serve` exposes the same pass-through over HTTP (default
`http://localhost:8791`, override with `--url`). Both endpoints take
`{"procedure": "<schema.name>", "parameters": {...}}`: `POST /excel` returns the
workbook and `POST /json` returns the result sets as
`[{name, columns, rows: [{column: value}]}]`.

```powershell
& .\providers\procedure-extract\bin\Release\net8.0\procedure-extract.exe --serve

$body = '{"procedure":"analysis.read_provider_canonical_body","parameters":{"provider_id":"google/gemini-select"}}'
Invoke-RestMethod -Method Post -Uri 'http://localhost:8791/json' -ContentType 'application/json' -Body $body
Invoke-WebRequest -Method Post -Uri 'http://localhost:8791/excel' -ContentType 'application/json' -Body $body -OutFile .\outputs\gemini-select.xlsx
```

## Azure retrieval API

The staging host exposes the existing service at
`https://sidefx-staging-fyfhb9gubneqbpaz.eastus2-01.azurewebsites.net/procedure-extract`.
Use `POST /json` or `POST /excel` with the same request body as above. Direct API
clients send `Authorization: Bearer <SDA_API_TOKEN>` using the staging API's
existing token. No separate extractor token is issued.

```powershell
$endpoint = 'https://sidefx-staging-fyfhb9gubneqbpaz.eastus2-01.azurewebsites.net/procedure-extract'
$headers = @{ Authorization = "Bearer $env:SDA_API_TOKEN" }
Invoke-RestMethod -Method Post -Uri "$endpoint/json" -Headers $headers -ContentType 'application/json' -Body $body
```

The gateway authenticates direct requests and forwards to the service bound to
loopback port 8791. `PROCEDURE_EXTRACT_ALLOWED_PROCEDURES` restricts this hosted
service to the read procedures listed in the host's `retrieval-policy.json`.
Writers and unlisted procedures return 403; no arbitrary procedure execution is
exposed by the Live Circuit. The local CLI remains unchanged. Without an
allowlist, `--serve` supports every procedure present in the generated DAL, so
the deployed host always supplies that policy.

The database connection comes from a Key Vault reference and is passed only to
the retrieval process. The circuit's server calls the API for the selected
provider; its browser receives result sets, never the connection or API token.
Its inspector verifies the returned provider identity and definition digest
against the selected database circuit before displaying the data.

The deployment source and reader allowlist live in
`sfx-platform/deploy/sda-kernel/`; the page integration lives in
`sfx-embody/demo/circuit/`. A self-contained Linux publish contains the extractor
and generated DAL. SQL remains authoritative: deploying a changed procedure body
does not require a new handwritten retrieval query. Changed signatures require
DAL regeneration and republishing this executable.

## Acceptance evidence

The provider reader was repaired through an estate migration on 2026-10-02.
Its eight result sets include canonical declaration, operation/port ownership,
related semantic context, each exact matching reference, update targets and
counts. Shared reference values are context, not proof of runtime consumption.
The generated update calls include namespace, exact JSON path and expected
definition digest. Apply changes through the estate migration lifecycle; a
workbook is not a bulk-update command. Re-extract after an edit so its digest
matches the selected generation.

The acceptance export `outputs/gemini-select-extract-verified.xlsx` was produced
through the generated-DAL Release build: 8 result sets, 752 distinct update
targets, namespace and digest on every call. No C# query or mapping change was
needed for the SQL repair. Full contract and migration evidence are documented in
`sfx-embody/docs/research/operation-catalog/provider-extraction.md`.

Azure acceptance on 2026-10-02 (`sda-f50865d3feb4-r8`) returned all eight result
sets and a valid Excel workbook through the remote API. Missing/invalid tokens
returned 401; writer and unlisted procedures returned 403. Both Gemini provider
inspections returned matching database definition digests in the hosted circuit.
The durable deployment receipt is
`sfx-platform/deploy/sda-kernel/retrieval-acceptance-2026-10-02.json`.
