# Private identity host

This .NET 8 host connects the installed `authenticate-ide-user` circuit to the
principal, password and session providers. The installed kernel chooses the
operation order and routes results. The host owns private request state and
performs only the provider action named by the current callback. SDA is unchanged.

## Request path

1. A client sends `{ "identifier": "...", "password": "..." }` to
   `POST /auth/v1/login` over HTTPS. The host bounds the body and concurrency,
   allocates a private context and a random non-authorizing correlation.
2. `KernelRun` launches the installed executable selected in the estate's
   `sfx.config.json`. The public scenario input contains only that correlation
   and the configured HTTPS provider origin.
3. The graph binds a vault credential and invokes `/auth/v1/provider/resolve`,
   `/verify` and, only after accepted credentials, `/establish`. Each endpoint
   requires the machine bearer, a current private context and the exact next
   stage. Callback bodies and responses contain no user credentials or token.
4. The host compares the actual private effects with the scenario's returned
   contract/disposition. Only the original private response can receive the
   issued bearer. A failed delivery revokes a session owned by that context.
5. `GET /auth/v1/session` validates a bearer against the identity database;
   `POST /auth/v1/logout` revokes it. These routes do not grant capability access.

The provider transport credential and the user's session bearer are different
credentials with different purposes. The service key cannot itself supply an
identifier/password context. A correlation sent directly through the general
capability API is not a login request and returns unavailable without that context.

## Configuration

| Setting | Meaning |
| --- | --- |
| `SDA_ESTATE_DIR` | Estate directory containing the admitted installed-kernel configuration |
| `SFX_IDENTITY_CAPABILITY` | `authenticate-ide-user` |
| `SFX_IDENTITY_INPUT_CONTRACT` | `ide-login-observation-request.v1` |
| `SFX_IDENTITY_OUTCOME_CONTRACT` | `ide-authentication-result.v1` |
| `SFX_IDENTITY_REALM` | Operator-selected identity realm; never selected by request JSON |
| `SFX_IDENTITY_CONNECTION_STRING` | Private `sfx-identity` connection consumed by generated DAL |
| `SFX_IDENTITY_PROVIDER_ORIGIN` | HTTPS origin allowed by the installed port declarations |
| `SFX_IDENTITY_SERVICE_KEY` | Host's private expected machine bearer, matching vault reference `SFX_IDENTITY_SERVICE_KEY` |
| `SFX_OBSERVER_ENDPOINT` | Actual observer ingestion URL, locally `http://localhost:8787/events` |
| `SFX_IDENTITY_LOCAL_GATEWAY` | Optional `1` permits plaintext only from a loopback TLS-terminating gateway |

The installed declarations allow `https://localhost:8793` and the staging Azure
origin. An allowed origin does not mean a host is deployed there. Configure an
ASP.NET HTTPS certificate/binding for standalone hosting. The integration test
uses the existing trusted localhost development certificate; certificate checks
are never disabled. Every `/auth/v1/*` route enforces the transport boundary.

The machine credential must already be provisioned in the kernel host's vault.
The estate declares its reference, request-capability scope, exact endpoint
authority and 15-second one-exchange injection lifetime. It never embeds a key.
The local verification used the existing OS-backed vault and an ignored DPAPI
file for the host's matching key. Those local secrets are not deployable assets,
checked-in defaults or a provisioning mechanism for another machine. Azure
deployment needs its own operator-managed matching host/vault configuration.

## Build and integration verification

From the `sfx-providers` root:

```powershell
dotnet restore providers/cli-login/host/LoginHost.csproj --locked-mode
dotnet build providers/cli-login/host/LoginHost.csproj --no-restore
dotnet run --project providers/cli-login/host/LoginHost.csproj
```

The host requires every setting above other than the gateway flag. It does not
seed a default account, generate a service credential or grant database access.
Use the existing identity runtime role for deployment; the integration suite
needs operator privileges to provision and remove its isolated test realm.

With the private connection and matching service key supplied to the test process:

```powershell
$env:SFX_LOGIN_TEST_OBSERVER_ENDPOINT = 'http://localhost:8787/events'
dotnet run --project providers/cli-login/host-tests/HostTests.csproj -- `
  --installed C:\lab\repos\sfx-embody C:\lab\repos\sfx-embody\evidence\authenticate-ide-user\host-check
```

The optional test observer forwards each real kernel record when received. The
suite verifies successful login, wrong/unknown credentials, absence of a session
call on rejection, session validation/revocation, a subsequent successful login,
plaintext refusal and no private values in captured evidence. Positive execution
uses the actual database, Argon2, HTTPS and installed kernel. Test accounts and
sessions are removed in `finally`; observations contain no credentials.

The transaction-preflight mode accepts an estate path, lifecycle runner path,
rollback migration path and evidence directory. It executes the declared graph
inside the migration transaction and rolls back. Installed mode is a separate
acceptance step; passing a preflight is not proof of an installed runtime.

## Limits retained explicitly

This host is verified on Windows and deployed on Azure Linux in
`sidefx/staging`, release `sda-f50865d3feb4-r9`. The staging realm is
`sfx-ide-local`, backed by the same staging identity database as the local pilot.
The Windows installed CLI passed remote login, session validation and logout.
Deployment source and operating instructions are versioned in
`sfx-platform/deploy/sda-kernel/identity-login.md`; CLI source is in
`sfx-platform/tools/sfx-api/`. The remote acceptance harness is
`providers/cli-login/remote-tests/`: it enrolls a randomly named principal,
tests the actual deployed host and installed CLI, captures live SSE, and removes
only that test principal and its sessions/attempts in cleanup. Its arguments are
the HTTPS origin, realm, CLI test module, installed command directory and evidence
directory. It reads the private operator database connection from
`SFX_IDENTITY_CONNECTION_STRING`; it never sends that connection to the CLI.

Authorization of subsequent capability invocations remains separate work.
Framework/managed strings cannot be guaranteed
erased; owned secret byte buffers are cleared and private types refuse generic
serialization. Framework request logging is disabled. The host forwards actual
kernel events; it does not synthesize timestamps, provider profiles, graph digests
or evidence of route coverage.
