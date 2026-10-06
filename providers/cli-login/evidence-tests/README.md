# Private run evidence acceptance

The candidate identity host maps `/evidence/v1` only when
`SFX_EVIDENCE_CALLERS` contains a nonempty array of `{id,key,actions}` entries.
Each key is a separate 64-character service credential; actions are `capture`
and/or `read`. Never reuse the login callback key. TLS is required except for
the explicitly configured loopback gateway. The public gateway exposes no
evidence routes. Kernel children receive neither the registry nor capture key.

All reads and run registration also require a valid `x-sfx-session` bearer.
The host derives principal/session identity from the database and uses only
named generated repositories. Capture after registration authenticates the
original service writer, so closing the browser does not interrupt persistence.
Stored material reports `NOT_EVALUATED`; no endpoint grants a trust disposition.

Run the tests with `SFX_IDENTITY_CONNECTION_STRING` in the process and a fresh
output directory if a running identity service locks its usual build output:

```powershell
dotnet build providers/cli-login/evidence-tests/EvidenceTests.csproj -c Release -o "$env:TEMP\sfx-evidence-tests"
dotnet "$env:TEMP\sfx-evidence-tests\EvidenceTests.dll" --live "$env:TEMP\evidence-acceptance.json"
```

The harness creates two disposable principals in a unique realm, validates
actual SQL sessions, tests idempotence/conflicts/corruption/owner isolation and
restarts the host. It revokes the session and deletes only its fixture realm's
rows in `finally`. These explicit transport fixtures do not prove execution.

An optional third argument is a Node capture acceptance script. The harness
passes the ephemeral service key and user bearer over private stdin; never put
them in command arguments or files. The platform's `verify-evidence-store-live.mjs`
exercises outage and lost-acknowledgement recovery using retained events.
`verify-evidence-store-execution.mjs` instead admits a fresh staging execution;
it additionally requires `SDA_API_ENDPOINT`, `SDA_API_TOKEN` and a caller-selected
`SFX_EVIDENCE_EXECUTION_REQUEST` JSON file. That check compares every retained
event, graph/output and circuit timeline, then removes the execution connection
and exercises authenticated archive routes. It does not deploy these services.
