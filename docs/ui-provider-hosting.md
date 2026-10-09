# Hosted UI providers

Every UI runtime provider package in `providers/` is hosted, so consumers use it
over HTTP instead of copying or importing its code. A package is hosted when
`providers/<name>/<name>.mjs` exports a `descriptor` with
`moduleContractId: ui-runtime-provider.v1` and an `invoke` function; nothing in
the host names a specific provider. Today that is `sfx-ui-explorer-region`
(the four Explorer regions), `sfx-ui-shell-footer` and `sfx-ui-runtime-token-set`,
each at the version its descriptor declares.

These providers remain undeclared in the estate: contracts `PROPOSED`, bindings
`UNBOUND`. Hosting makes them consumable; it does not admit them. Selecting a
provider version for a slot is declared authority (`sfx-embody`).

## Hosts

| Entry point | Serves | Transport |
| --- | --- | --- |
| `node ui-providers-host.mjs` (`npm run ui-providers`) | the UI provider API and `/health` only | plain HTTP on `PORT` (default 8080), `HOST` default `0.0.0.0`, for a TLS-terminating platform |
| `node runner.mjs` (`npm start`) | the UI provider API alongside the altitude, audio and presentation providers | local HTTPS on `PROVIDER_PORT` (default 8790) with the `setup-cert.ps1` certificate |

Deploy only `ui-providers-host.mjs`. It holds no credentials and makes no model
calls; the altitude providers' model access is never reachable through it.

## API

| Route | Result |
| --- | --- |
| `GET /ui-providers` | `ui-provider-index.v1`: each hosted provider's id, version, operations, manifest URL and manifest digest |
| `GET /ui-providers/{providerId}/manifest` | `ui-provider-manifest.v1`: `identity`, `version`, `contracts` (operation, effect, contract ids and status, schema digests), declared `capabilities`, `entrypoint` (package-relative module path, operations, invoke URL, byte limit) and `integrity` (content manifest digest; every asset's id, region, kind, media type, path, bytes, `sha256` digest and content-addressed URL), plus the manifest's own `digest` |
| `GET /ui-providers/{providerId}/assets/{assetId}` | the asset's declared bytes, served only while they still match their digest; `x-content-digest` and `etag` carry the digest. With `?digest=sha256:…` the URL is content-addressed and cached `immutable`; without it, `no-cache` |
| `POST /ui-providers/{providerId}/invoke` | the provider's operation on the JSON body, returning its envelope unchanged plus `servedBy` (`providerId`, `version`, `operationId`, `manifestDigest`). Name `?operation=` when a provider declares more than one |

Every route accepts `?version=<semver>`. A consumer pinned to a version other
than the hosted one is refused (`409 UI_PROVIDER_VERSION_UNAVAILABLE`), never
served a different version. Responses carry `x-ui-provider: <id>@<version>` and
`x-ui-provider-manifest-digest`.

The manifest is a projection of the package's own exports; no field is invented
by the host. Repeat reads are byte-stable while the package is unchanged.

## Refusals

Host refusals are named: `UI_PROVIDER_UNKNOWN` (404), `UI_PROVIDER_ROUTE_UNKNOWN`
(404), `UI_PROVIDER_ASSET_UNKNOWN` (404), `UI_PROVIDER_VERSION_UNAVAILABLE` (409),
`UI_PROVIDER_ASSET_DIGEST_STALE` (409), `UI_PROVIDER_ASSET_DIGEST_MISMATCH` (500;
the bytes changed after loading and are not served), `UI_PROVIDER_METHOD_NOT_ALLOWED`
(405), `UI_PROVIDER_CONTENT_TYPE_INVALID` (415), `UI_PROVIDER_REQUEST_OVERSIZED`
(413), `UI_PROVIDER_REQUEST_INVALID` (400) and `UI_PROVIDER_OPERATION_UNKNOWN`
(400). A provider's own refusal keeps its name and maps by its suffix:
`*_REQUEST_INVALID` 400, `*_OVERSIZED` 413, `*_UNKNOWN` 404, otherwise 422.

Loading refuses the whole host rather than hosting a partial set: a package that
claims the module contract without `providerId`, `version`, `operations` and
`invoke` (`UI_PROVIDER_PACKAGE_INVALID`), two packages with one `providerId`
(`UI_PROVIDER_DUPLICATE`), or an asset id declared twice.

## Check

```powershell
node --test tests/ui-provider-host.test.mjs
```

The tests run over HTTP for every discovered package: index and manifest
digests recompute; every asset is served as its declared bytes with the right
type and cache policy; invoke equals the in-process result for every declared
request; refusals keep their names; tampered bytes are refused; and the
deployable host exposes no altitude, audio or presentation route.

## Deployment

The UI-only host runs at **https://sfx-ui-providers.azurewebsites.net** (App
Service `sfx-ui-providers`, Linux Node 24 LTS, on plan `ASP-sidefxgroup-ad2e` in
`sidefx_group`; HTTPS only, TLS 1.2+, FTPS disabled, health check `/health`,
`robots.txt` disallows indexing). It is public and read-only: index, manifests,
assets and `READ_ONLY` invoke, with no credentials or model access.

`.github/workflows/ui-providers.yml` tests every UI package and the hosted API on
pull requests and pushes, and on `main` deploys the bundle built by
`scripts/package-ui-providers.mjs` (host plus only the `ui-runtime-provider.v1`
packages). It then requires `/health` to report that bundle from a clean
checkout of the pushed commit, every hosted manifest digest to equal the
bundle's, and the altitude, audio and presentation routes to be absent. It signs
in with the managed identity `sfx-providers-github-ui` (federated to
`repo:BPMSoftwareSolutions/sfx-providers:ref:refs/heads/main`; Website
Contributor on `sfx-ui-providers` only) through the repository variables
`AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`.

## Parity with the platform before consumption (2026-10-09)

The hosted content was checked against `sfx-platform` so that consuming it loses
nothing the platform had. Every source each package cites changed after its
capture only in `sfx-platform` `5eee1df` (the commit that mounted these
providers) and its test harness `85f3ea4`; `site.css` `:root` is unchanged and
the token set matches all sixteen custom properties.

A browser comparison of the hand-authored chrome before `5eee1df` with the
provider-composed chrome after it (Explorer, home, sign-in and a declared page,
signed in and out) found these losses:

| Lost since the region migration | Owner | State |
| --- | --- | --- |
| Accessible names of the Explorer sidebars ("Capability explorer", "Observe and selection details") | `ui-explorer-region` (`left-sidebar.html`, `right-sidebar.html`) | Restored in 0.1.1 and hosted |
| `role="tabpanel"` and `aria-labelledby` on the Run, Runs and Evidence panels; the tabs' `aria-controls` now name plain containers | `sfx-platform` `explorer-shell.js` (builds the panels) | Open, for the platform phase |
| The footer's "Sign in" link (replaced by "Home"); declared pages now have no sign-in link | `sfx-platform` `footer.js` (fills the navigation slot) | Open, for the platform phase |
| Each left-sidebar list is announced as two nested navigation landmarks with the same name: the provider's labelled `nav` slot holds the shell's labelled `nav` | provider slot element or shell slot content | Open, decide in the platform phase |

The platform still consumes the 0.1.0 packages copied into its image from the
pinned `sfx-providers` commit; the restored names reach staging only when the
platform consumes 0.1.1.
