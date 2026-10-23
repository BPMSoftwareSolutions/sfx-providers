# sfx-sqlserver-read-provider

Host/consumer provider profile `sfx-sqlserver-read-provider.v1` (SDA ADR-0016): a declared
read on a declared SQL Server connection. The kernel resolves the profile through its generic
resolver and invokes it; the engine, the session and the driver live here.

## The binding (consumer data)

```json
{ "providerId": "sfx-sqlserver-read-provider.v1",
  "statement": "<T-SQL that returns one row>",
  "resultColumn": "value",
  "connection": { "credentialReference": "SFX_IDENTITY_DATABASE", "source": "vault",
                  "storeLocator": "%LOCALAPPDATA%\\sfx\\vault" } }
```

The statement runs with `@input` bound to the cell input as JSON and returns one row. The value
of `resultColumn`, parsed when it is JSON text, is the outcome. The connection string stays in
the host vault under `credentialReference`.

## What the host provides (the boundary)

- `host.releaseCredential(connection)`: the connection string of the named vault entry, for one call.
- The `mssql` driver 12.7.0 (the version the SDA Node kernel uses), installed from this package.
- The generic resolver loading this module from the host/estate provider authority (SDA:
  MechanicRegistry in C#, Node and Python still reads SDA's own registry files).

First consumer: `list-principal-runs`, which reads `evidence.list_runs` in sfx-identity
(flight plan 110).