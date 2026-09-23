# Authoring-altitude provider bindings (mechanism B)

**Date:** 2026-09-22. **Estate:** `C:\lab\repos\sfx-embody` (`5d2a740`). **SDA:** `C:\lab\repos\scenario-driven-architecture`.
**Status:** eleven `provider-binding-change.v1` documents authored; author stage run for all eleven; **nothing installed** (dry-runs only; the coordinator serializes installs).

These bindings plug the eleven local HTTPS altitude services in this repository
(`sfx-authoring-altitude-NN`, served by `server.mjs` on `https://localhost:8790`)
into the declared altitude circuit `authoring-altitude-model-stubs` through the
admitted `provider add` (`provider-binding`) lifecycle — the mechanism-B placement
(`docs/model-at-each-authoring-altitude-2026-09-21/altitude-model-placement-sql.md`
§B; `bridge.policy.json`).

## 1. Bindings

| # | providerId | bindingId | endpoint (host / method / pathPrefix / requestTemplate) | outcomeContractId | endpointAuthorityDigest (minted by author) |
| ---: | --- | --- | --- | --- | --- |
| 01 | `sfx-authoring-altitude-01` | `sfx-providers-altitude-01` | `localhost:8790` / POST / `/altitude-01/feature.resolve` / `https://localhost:8790/altitude-01/feature.resolve` | `altitude-1-feature-parse-output.v1` | `sha256:7b5619b1714681144b640d2050b884ecd923acf37adc98865c9c5ddcc1612b8d` |
| 02 | `sfx-authoring-altitude-02` | `sfx-providers-altitude-02` | `localhost:8790` / POST / `/altitude-02/meaning.author` / `https://localhost:8790/altitude-02/meaning.author` | `altitude-2-capability-meaning-output.v1` | `sha256:35e92eaaa18731dd45ac7eeecf7b342c54435ca84e8561709c11ab72ffdf9439` |
| 03 | `sfx-authoring-altitude-03` | `sfx-providers-altitude-03` | `localhost:8790` / POST / `/altitude-03/scenario.author` / `https://localhost:8790/altitude-03/scenario.author` | `altitude-3-scenario-io-output.v1` | `sha256:8af5be937c0c1b3a8b06e4b24a6dde21256b59fae6843bee33a9feff0b0c9984` |
| 04 | `sfx-authoring-altitude-04` | `sfx-providers-altitude-04` | `localhost:8790` / POST / `/altitude-04/contract.author` / `https://localhost:8790/altitude-04/contract.author` | `altitude-4-contracts-schemas-output.v1` | `sha256:5585a2361f40be39469dfae46883d0476a0ed3c7785110b4ddc646024596829f` |
| 05 | `sfx-authoring-altitude-05` | `sfx-providers-altitude-05` | `localhost:8790` / POST / `/altitude-05/semantics.author` / `https://localhost:8790/altitude-05/semantics.author` | `altitude-5-semantic-authority-envelope-output.v1` | `sha256:e862a3dda41f8bd0e444e27a8c6f6f3950e29f5da1f631a8c7d018438d3866ab` |
| 06 | `sfx-authoring-altitude-06` | `sfx-providers-altitude-06` | `localhost:8790` / POST / `/altitude-06/ast.author` / `https://localhost:8790/altitude-06/ast.author` | `altitude-6-transformation-ast-output.v1` | `sha256:3884ae9cd1ed7a8b8adf3873075a4ade8f46b83bfdd186ce070889b30d55d30c` |
| 07 | `sfx-authoring-altitude-07` | `sfx-providers-altitude-07` | `localhost:8790` / POST / `/altitude-07/authority.author` / `https://localhost:8790/altitude-07/authority.author` | `altitude-7-execution-authorities-ports-output.v1` | `sha256:a46f302203f00285ff6fe2466b773bc36c9290647626856cc25625e4328c37fb` |
| 08 | `sfx-authoring-altitude-08` | `sfx-providers-altitude-08` | `localhost:8790` / POST / `/altitude-08/provider.author` / `https://localhost:8790/altitude-08/provider.author` | `altitude-8-providers-bindings-overlays-output.v1` | `sha256:aca45f2e9bebda1fa599fe70ad5a4136a2ffa558da75ba6f64f4569a828a424f` |
| 09 | `sfx-authoring-altitude-09` | `sfx-providers-altitude-09` | `localhost:8790` / POST / `/altitude-09/interface.author` / `https://localhost:8790/altitude-09/interface.author` | `altitude-9-interface-cli-display-output.v1` | `sha256:9b8e41679dfb9f415d29870c9c4e8f90e1f05c979b15ad6974c7b667e0587aa9` |
| 10 | `sfx-authoring-altitude-10` | `sfx-providers-altitude-10` | `localhost:8790` / POST / `/altitude-10/fixture.author` / `https://localhost:8790/altitude-10/fixture.author` | `altitude-10-fixtures-proof-output.v1` | `sha256:d6a261377f50900ab6bea5cb3fb257828d853b4cf838406ae182524e7d9ee9e6` |
| 11 | `sfx-authoring-altitude-11` | `sfx-providers-altitude-11` | `localhost:8790` / POST / `/altitude-11/alignment.evaluate` / `https://localhost:8790/altitude-11/alignment.evaluate` | `altitude-11-alignment-evaluation-output.v1` | `sha256:2e4d0a11ae652364caa780a386d353a4829b09b6d23f364d22321ea5a654fbc8` |

Shape notes:

- Every document declares `capabilityId = authoring-altitude-model-stubs` (the only
  selected circuit that owns the eleven altitude scenarios), `effectScope =
  ONE_BOUNDED_HTTPS_EXCHANGE_NO_REDIRECT_NO_RETRY`, `nativeShape = candidate`,
  `route = {routeId, resolvedDisposition: "AUTHORED"}`, and `preflight.input =
  {"contractId":"authoring-altitude-model-stubs-request.v1","payload":{}}` with
  `expected = {"disposition":"AUTHORED"}`.
- `mapping` maps the provider response `candidate` object onto the contract payload:
  `candidate.{contractId,altitude,altitudeId,altitudeName,stub,shapeSource,canned}`.
- The change contract has **no `port` member**, so the port is carried in
  `endpoint.host` (`localhost:8790`); the installer composes the URL prefix as
  `https://` + host + pathPrefix (see blocker B3).
- `pathPrefix` includes the served tool segment so the minted `urlPrefixes` entry
  covers `requestTemplate` (the server routes are `/altitude-NN/<toolId>`).

## 2. Author / dry-run results (all eleven)

Author stage run twice per altitude — the declared read
`author-provider-configuration-change` (wrapped `{providerId, input}`) and the
documented `sfx provider add --dry-run` (which stops at author on a HELD result and
writes nothing). Both agree:

| # | author disposition | findings | `provider add --dry-run` | preflight |
| ---: | --- | --- | --- | --- |
| 01 | `PROVIDER_CHANGE_HELD` | `PROVIDER_NOT_DECLARED` | `PROVIDER_CHANGE_HELD`, installed:false | not reached |
| 02 | `PROVIDER_CHANGE_HELD` | `PROVIDER_NOT_DECLARED` | `PROVIDER_CHANGE_HELD`, installed:false | not reached |
| 03 | `PROVIDER_CHANGE_HELD` | `PROVIDER_NOT_DECLARED` | `PROVIDER_CHANGE_HELD`, installed:false | not reached |
| 04 | `PROVIDER_CHANGE_HELD` | `PROVIDER_NOT_DECLARED` | `PROVIDER_CHANGE_HELD`, installed:false | not reached |
| 05 | `PROVIDER_CHANGE_HELD` | `PROVIDER_NOT_DECLARED` | `PROVIDER_CHANGE_HELD`, installed:false | not reached |
| 06 | `PROVIDER_CHANGE_HELD` | `PROVIDER_NOT_DECLARED` | `PROVIDER_CHANGE_HELD`, installed:false | not reached |
| 07 | `PROVIDER_CHANGE_HELD` | `PROVIDER_NOT_DECLARED` | `PROVIDER_CHANGE_HELD`, installed:false | not reached |
| 08 | `PROVIDER_CHANGE_HELD` | `PROVIDER_NOT_DECLARED` | `PROVIDER_CHANGE_HELD`, installed:false | not reached |
| 09 | `PROVIDER_CHANGE_HELD` | `PROVIDER_NOT_DECLARED` | `PROVIDER_CHANGE_HELD`, installed:false | not reached |
| 10 | `PROVIDER_CHANGE_HELD` | `PROVIDER_NOT_DECLARED` | `PROVIDER_CHANGE_HELD`, installed:false | not reached |
| 11 | `PROVIDER_CHANGE_HELD` | `PROVIDER_NOT_DECLARED` | `PROVIDER_CHANGE_HELD`, installed:false | not reached |

`PROVIDER_NOT_DECLARED` is the **only** finding for all eleven: the outcome
contracts resolved, every endpoint/credential/effect-scope field validated, and the
endpoint authority digest was minted. Per-altitude evidence:
`evidence/altitude-NN.author-result.json` and `evidence/altitude-NN.add-dryrun.json`.

**Shape probe (not one of the eleven).** Re-running the altitude-01 document with
only `providerId` swapped to the already-declared `rapidapi/yahoo-finance15`
returned `PROVIDER_CHANGE_AUTHORED` with zero findings
(`evidence/probe-altitude-01.author-result.json`). The eleven documents are
otherwise clean; the hold is the missing provider declaration (B1).

**Dry-run probe (not an install).** The same probe document with the real target
capability (`authoring-altitude-model-stubs`) reached the dry-run stage through
`sfx provider add --dry-run --config <evidence/provider-add-runtime.json>` and
failed there:

```
stage author    PROVIDER_CHANGE_AUTHORED  findings []
stage prepare   PREPARED
stage dry-run   FAILED: DECLARED CHANGE FAILED: EQUITY_BLUEPRINT_ABSENT
installed:false
```

The direct runner (`node run-declared-change.mjs dry-run <change.json>`) reproduces
`EQUITY_BLUEPRINT_ABSENT` (`evidence/direct-dry-run.equity-blueprint-absent.txt`;
`evidence/probe-altitude-01.add-dryrun.reached-dry-run.json`). Preflight is never
reached, so nothing is installed.

## 3. Blockers (all verified; each needs a coordinator decision)

1. **B1 — Provider declaration gap (author).** The author read refuses a provider
   with no selected `PROVIDER` definition (`fix-provider-mapping-array-path-read.sql:39-41`).
   None of the eleven `sfx-authoring-altitude-NN` providers is declared. The
   admitted installer can upsert the identity from `provider.name` /
   `provider.operations` (both present in every document), but author runs first and
   cannot reach it. The coordinator must declare the providers (B1 commands below);
   no doc change clears this.
2. **B2 — Credential rule requirement.** The change contract requires
   `credential.source = "vault"` with a reference, an injection rule and a header
   (`provider-binding-admission.v1` in `declare-change-family-admission.sql`), and
   the installed kernel refuses an exchange without a consumed credential binding
   (`GovernedEffectPorts.cs:378-380`, `rejected-credential`). The local altitude
   services need no credential, but there is no credential-less exchange mode. The
   documents therefore name a stub rule and reference
   (`altitude-local-no-credential.v1` / `ALTITUDE_LOCAL_NO_CREDENTIAL` /
   header `x-altitude-local-credential`). The coordinator must either materialize
   that reference in the vault (`%LOCALAPPDATA%\sfx\vault`) or an admitted
   no-credential exchange change must land.
3. **B3 — Local endpoint authority / trust.** The installer hardcodes `https://`
   (`declare-provider-binding-change-install.sql:293`) and the installed kernel
   admits only `https` endpoints, with no loopback exception in C#
   (`GovernedEffectPorts.cs:333-334`; the Node runtime's
   `allowLoopbackHttpForConformance` seam is conformance-only). The sibling lane's
   server is HTTPS with a current-user self-signed cert (`certs/`,
   `setup-cert.ps1`); the **kernel host must trust that cert**. If a trust decision
   is withheld, every route fails `rejected-endpoint`. If plain HTTP on loopback is
   preferred, it needs an admitted no-loopback/HTTP seam — a trust decision, not a
   document fix.
4. **B4 — Mechanism-B installer is equity-shaped.** `model.install_provider_binding_change`
   requires `<capabilityId>-blueprint.v1` (`EQUITY_BLUEPRINT_ABSENT`) and re-points
   the event `equity-market-price-evidence-requested`
   (`declare-provider-binding-change-install.sql:382-389`), plus
   `EQUITY_WORKING_EXECUTION_DIVERGED` below five operations. `provider add --dry-run`
   against any non-equity circuit therefore fails at dry-run — verified live for the
   altitude circuit. Plugging the altitudes needs either per-altitude capabilities
   with declared blueprints or a generalized installer (an SDA change request; out
   of scope for these documents).
5. **B5 — Contract/payload wrap mismatch.** The installed route selection nests every
   mapped field under `payload` and adds `contractId`/`disposition`/`providerTestimony`
   (`declare-provider-binding-change-install.sql:181-189`), while the altitude output
   contracts declare their required members at the top level (no `payload` member).
   The mapping targets the contract payload as instructed, but a route installed as
   written would not satisfy the declared altitude outcome contract at contract
   admission. Either the altitude contracts gain a payload wrapper or the provider
   route shape must preserve top-level members.
6. **B6 — Lifecycle runner vault configuration.** `sfx provider add` without
   `--config` holds `VAULT_SEALED` at prepare on this host (reproduced twice), while
   the same prepare succeeds when the Node runner is invoked directly. Passing
   `--config` with an absolute `credentialVaultStoreLocator` and the explicit
   `credentialStoreRealization` prepares cleanly
   (`evidence/provider-add-runtime.json`, copied from the finance15-era setup). The
   coordinator should use `--config` for every install. The config file is
   user-specific (absolute path); regenerate on another host.

## 4. Exact coordinator install order

All commands are dry-run/read-only in this record; the coordinator runs them in
order and serializes the commits. Steps 1-4 are prerequisites; step 5 is the
per-altitude install.

```powershell
# 0. the local provider server (sibling lane; certs already created and trusted by setup-cert.ps1)
cd C:\lab\repos\sfx-providers
node runner.mjs                                  # PROVIDERS_READY port=8790 providers=11

# 1. (once) trust the local cert if not already trusted
powershell -ExecutionPolicy Bypass -NoProfile -File .\setup-cert.ps1

# 2. declare the eleven providers (migration lifecycle, coordinator-serialized).
#    One row per altitude inside one dry-run -> preflight -> commit migration:
EXEC model.add_provider @provider_id=N'sfx-authoring-altitude-01',
  @name=N'Authoring altitude 01 provider (feature parse)',
  @operations_json=N'["feature.resolve","intent.parse","feature.pin"]';
-- ... altitude-02 .. altitude-11, same shape (names/operations are in each binding's "provider" member)

# 3. materialize the credential rule (B2): store ALTITUDE_LOCAL_NO_CREDENTIAL in the
#    vault with rule altitude-local-no-credential.v1 / header x-altitude-local-credential,
#    or land the no-credential exchange admission.

# 4. clear B4/B5/B6: generalized (or altitude-blueprint) mechanism-B install,
#    contract/payload alignment, and the provider-add runtime config:
#    C:\lab\repos\sfx-providers\bindings\evidence\provider-add-runtime.json

# 5. per altitude 01..11, dry-run first, then install (no --dry-run) in the same order:
sfx provider add --input '@C:\lab\repos\sfx-providers\bindings\altitude-01.binding.json' --dry-run `
  --sda-root 'C:\lab\repos\scenario-driven-architecture' --estate 'C:\lab\repos\sfx-embody' `
  --config 'C:\lab\repos\sfx-providers\bindings\evidence\provider-add-runtime.json'
# expected once B1-B6 clear: author PROVIDER_CHANGE_AUTHORED -> prepare PREPARED ->
# dry-run ROLLED_BACK -> preflight ROLLED_BACK with outcome disposition AUTHORED ->
# install COMMITTED (provider_change_installed) -> verify AUTHORED.
# same-route replay reports already_installed; routes append in install order (01..11).
```

## 5. Credential rules and endpoint authorities

| # | injection rule | header | reference | source / store | effectScope | methods | safeHeaders | allowedResponseHeaders |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 01-11 | `altitude-local-no-credential.v1` | `x-altitude-local-credential` | `ALTITUDE_LOCAL_NO_CREDENTIAL` | `vault` / `%LOCALAPPDATA%\sfx\vault` | `ONE_BOUNDED_HTTPS_EXCHANGE_NO_REDIRECT_NO_RETRY` | `POST` | `content-type: application/json` | `content-type` |

The canonical endpoint record the author stage hashes is
`{host, method, pathPrefix, providerId, bindingId, credentialInjectionRuleId,
effectScope}`; the digests are in the table in §1. The installer mints the declared
`urlPrefixes` entry as `https://localhost:8790/altitude-NN/<toolId>` and
`methods: ["POST"]`.

## 6. Observed samples

Each binding's `observedSample` is a **live call** to the sibling server made
2026-09-22 (`POST https://localhost:8790/altitude-NN/<toolId>` with `{}`), clipped:
the top-level `modelCall`/`elapsedMs` and the model-augmentation members
(`canned.modelOutput`, `canned.modelId`, `canned.modelCallError`) are removed. Raw
captures: `evidence/observed/altitude-NN.response.json`. The mapping paths
(`candidate.*`) are present in every capture.

## 7. Evidence

| Path | Content |
| --- | --- |
| `altitude-NN.binding.json` | The eleven `provider-binding-change.v1` documents |
| `evidence/altitude-NN.author-result.json` | Author-stage result (`provider-binding-change-result.v1`) |
| `evidence/altitude-NN.add-dryrun.json` | `sfx provider add --dry-run` report (stops at author) |
| `evidence/author-summary.json` | Combined author/add summary |
| `evidence/probe-altitude-01.author-result.json` | Shape probe: declared provider -> `PROVIDER_CHANGE_AUTHORED`, no findings |
| `evidence/probe-altitude-01.add-dryrun.reached-dry-run.json` | Probe reaching dry-run -> `EQUITY_BLUEPRINT_ABSENT` |
| `evidence/direct-dry-run.equity-blueprint-absent.txt` | Direct runner dry-run capture |
| `evidence/provider-add-runtime.json` | The `--config` that clears the prepare `VAULT_SEALED` |
| `evidence/observed/altitude-NN.response.json` | Raw live provider responses |

## 8. Status

No install was performed; no commits were made. `git -C C:\lab\repos\sfx-providers
status --porcelain` shows this `bindings/` tree as untracked (the sibling lane's
files are untracked as well until the lane commits). The estate working tree is
clean; this record adds files only under `C:\lab\repos\sfx-providers\bindings\`.
