# CLI login providers

The terminal input provider is now consumed by the installed platform CLI client
(`sfx-platform/tools/sfx-api/login-input/`). Its standalone project contains only
private contracts/interfaces and terminal input, without the identity DAL or SQL
driver. Server providers reference that same assembly. The private host returns
its configured realm in `x-sfx-identity-realm` so clients scope stored sessions.
Windows installed-command acceptance covers actual hidden input, cancellation,
HTTPS login, DPAPI persistence, status, logout and database revocation. See
`sfx-platform/docs/cli-login-client.md` for installation and remaining release work.

Four separately named providers implement the login boundaries with shared .NET 8
contracts and an independent input assembly. The server providers use the generated
[SFX.Identity.DAL](../../../sfx-dal/identity/README.md) and sfx-identity through
SFX_IDENTITY_CONNECTION_STRING. No SDA Kernel source or registration changes occur.

| Provider | Source | Behavior |
| --- | --- | --- |
| cli-login-input-provider | [Source](../cli-login-input-provider/CliLoginInputProvider.cs) | Client-side interactive username and hidden password input; cancellation and overflow refusal |
| identity-principal-provider | [Source](../identity-principal-provider/IdentityPrincipalProvider.cs) | Attempt/throttle admission and private principal/version resolution |
| password-credential-provider | [Source](../password-credential-provider/PasswordCredentialProvider.cs) | Real Argon2id check and one-time recorded credential result |
| ide-session-provider | [Source](../ide-session-provider/IdeSessionProvider.cs) | Random bearer issuance after persisted session creation, plus validation/revocation |

The provider library, generated persistence adapter and [private HTTP host](host/README.md)
are implemented. `authenticate-ide-user` is installed in estate 34 with three
server provider calls, client input provenance and four outcomes. Topology
conformance passes with zero violations. The actual installed kernel drives the
host callbacks over governed HTTPS; the host owns private credentials and session
response delivery. `providers.json` documents this package; estate rows remain
the authority. The package is separate from the eleven-altitude bridge.

CLI command integration, OS credential storage, authorization of subsequent
capability calls and Azure authentication-host deployment remain pending.

## Composition

The client runs CliLoginInputProvider.AcquireAsync and sends its private request
over the host's protected login transport. The identity service constructs
LoginInput. The installed scenario drives three callbacks in order; each callback
executes one provider. The following library example shows the private type flow:

~~~csharp
var dal = new GeneratedIdentityDal();
var policy = new LoginPolicy(TimeSpan.FromMinutes(2), TimeSpan.FromMinutes(30));
using var verifier = new Argon2PasswordVerifier();
using var input = LoginInput.FromPrivateRequest(identifier, privatePassword);
using var attempt = await new IdentityPrincipalProvider(dal, policy)
    .ResolveAsync(input, configuredRealm, trustedSourceKey, cancellationToken);
var checkedCredential = await new PasswordCredentialProvider(dal, verifier)
    .VerifyAsync(attempt);
using var session = await new IdeSessionProvider(dal, policy)
    .EstablishAsync(checkedCredential, cancellationToken);
await session.WritePrivateResponseAsync(protectedResponse, cancellationToken);
~~~

The host supplies bounded private request fields, a configured realm, a source key
derived from trusted ingress, and the protected response stream. Rejection must
map to a generic response without revealing account existence. A rejected result
cannot establish a session. Share a long-lived Argon2PasswordVerifier in the
service to enforce KDF concurrency and dispose it only after outstanding work
finishes. The example shows call order and ownership, not an HTTP implementation.

[GeneratedIdentityDal.cs](GeneratedIdentityDal.cs) maps specifically named
generated repositories to [IIdentityDal](IIdentityDal.cs). There is no production
in-memory fallback, duplicated SQL in the adapter, or generic procedure dispatch.
It requires sfx-identity as the database target. Client machines never receive
the database connection setting; only the identity service uses this adapter.

## Private values and evidence

LoginInput, PasswordVerifier, ResolvedLoginAttempt, VerifiedLoginAttempt and
AuthenticatedSession refuse System.Text.Json serialization/deserialization, including
nested serialization. Public receipts contain provider identity, attempt ID and a
bounded disposition, without identifiers, passwords, verifier hashes, tokens, DAL
rows or backend exception messages. The host emits receipts from actual calls;
this library does not invent observer events or timing.

Only WritePrivateRequestAsync and WritePrivateResponseAsync deliberately write
credentials to private transport streams. Keep these bodies out of logs, circuit
input/output, generic run records and procedure-extract. Owned secret arrays are
cleared on disposal; managed strings and third-party/framework buffers are not
guaranteed to be erased.

Argon2id uses 19 MiB, two iterations, parallelism one, a fresh 16-byte salt and
32-byte hash, following the
[OWASP minimum](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
The [Konscious implementation](https://github.com/kmaragon/Konscious.Security.Cryptography)
is pinned at 1.3.1 with lockfiles. Missing/disabled/malformed credential paths
still perform the bounded KDF before rejection; stored metadata cannot request
arbitrary work factors. Registration/password policy, recovery, pepper management
and hash parameter upgrades are subsequent work.

A private verified context cannot be supplied as caller JSON. Library guards
prevent reuse; SQL independently enforces consumption across processes.
The database rechecks account and credential versions at session establishment
and validation. Only SHA-256 of the random 32-byte bearer is persisted.
Cancellation after commit may leave a session whose token was never delivered;
it expires normally. Generated DAL methods lack cancellation parameters, so the
adapter awaits actual completion and checks cancellation around the call.

## Build and verify

~~~powershell
dotnet restore providers/cli-login/LoginProviders.csproj --locked-mode
dotnet run --project providers/cli-login/tests/LoginProviders.Tests.csproj -c Release
~~~

The 13 isolated checks use a clearly marked test-only DAL fixture. They exercise
actual Argon2, private serialization, terminal/cancellation and failure behavior.
They do not prove database behavior or real terminal acceptance.

With the identity connection setting in the process:

~~~powershell
dotnet run --project providers/cli-login/live-tests/LiveTests.csproj -c Release -- --live
~~~

The live suite uses random credentials in a unique test realm, with private-row
cleanup in finally. It requires an administrator test connection for the negative
permission tests. Ten checks cover real login/session behavior, unknown/wrong/
disabled users, concurrent database consumption, version changes, throttling,
expiry and actual runtime-role denials.
[The receipt](../../../sfx-dal/identity/verification/2026-10-03-live-providers.json)
states its exact scope. Anonymous throttle audit events/counters remain; test
principals, password verifiers and sessions are removed.

The [host integration suite](host-tests/Program.cs) additionally executes the real
installed kernel over trusted HTTPS against the identity database. Its real
observations can be forwarded live to the local circuit observer. The estate
receipt is `sfx-embody/docs/research/authenticate-ide-user-circuit-review.json`.
Remaining integration includes CLI login/OS credential storage, application
identity grants, session-based capability authorization and deployment.
Operator-only enrollment is available for a future protected administration
workflow; no default user or password is seeded. No staging application binary
was deployed in this provider/DAL work.
