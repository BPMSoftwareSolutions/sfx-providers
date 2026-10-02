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
