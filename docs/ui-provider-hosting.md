# Hosted UI providers

The UI-only host is https://sfx-ui-providers.azurewebsites.net. Each declared
provider has one folder, named exactly like its providerId. The host discovers
packages by the ui-runtime-provider.v1 module contract; it does not contain a
provider-specific route map.

## Provider packages

| Declared provider and folder | Version | Operation |
| --- | --- | --- |
| sfx-ui-explorer-region-header | 0.1.0 | ui.region.load: header |
| sfx-ui-explorer-region-left-sidebar | 0.1.0 | ui.region.load: left-sidebar |
| sfx-ui-explorer-region-middle | 0.1.0 | ui.region.load: middle |
| sfx-ui-explorer-region-right-sidebar | 0.1.0 | ui.region.load: right-sidebar |
| sfx-ui-shell-footer | 0.2.0 | ui.region.load: footer |
| sfx-ui-provider-drilldown | 0.1.0 | ui.view.prepare |
| sfx-ui-runtime-token-set | 0.1.1 | ui.tokens.resolve |

The aggregate ui-explorer-region package has been replaced by four independent
providers. Every package's main module is providers/<providerId>/<providerId>.mjs.
A mismatched folder, package identity, or duplicate provider identity refuses
host startup.

The five region providers return their own CSS/HTML/SVG content and publish
browser implementations. Middle also exports mountExplorer and declares its
versioned provider dependencies. Drill-down prepares a declared ui-page.v1
reader result carrying ui-view.v1 identity; its browser module uses the shared
page projector and component adapters. It does not synthesize a profile.
Shared browser modules live under src/ui-providers/browser. Their extraction
source and changes are recorded in extraction.json. No sfx-platform source
checkout is required to package or serve these implementations.

## API and contracts

| Method and route | Result |
| --- | --- |
| GET /ui-providers | ui-provider-index.v1: identities, versions, manifest URLs and digests |
| GET /ui-providers/{providerId}/manifest | Identity, contracts and schema digests, operations, browser entrypoint, dependencies, asset digests and URLs |
| GET /ui-providers/{providerId}/assets/{assetId} | Exact declared bytes, checked before serving |
| POST /ui-providers/{providerId}/invoke | AUTHORED candidate or HELD findings, plus servedBy identity, version, operation and manifest digest |

Every route accepts ?version=<semver>. An unavailable version returns
409 UI_PROVIDER_VERSION_UNAVAILABLE. Content-addressed asset URLs additionally
pin ?digest=sha256:...; mismatched or changed bytes are refused.

Region inputs are {"contractId":"ui-region-request.v1","regionId":"header"},
substituting the matching region name. A region provider refuses requests for
another region. Their output candidate is ui-region-content.v1 with its exact
provider identity and three assets. The shared region schemas match the
sfx-embody align-ui-provider-region-contracts migration (60fff1f), including
footer. Drill-down takes the actual read-ui-page result for
/circuit/views/provider-profile and returns the validated, selection-bound page.

A configured SFX_UI_PROVIDER_API_KEY requires the X-SFX-Provider-Key header on
invoke. Index, manifests and assets remain public. Without a configured key,
the existing public READ_ONLY invocation behavior remains. The key value is
never included in a response. JSON body bytes without Content-Type are accepted
for the existing governed HTTP carrier; explicitly different formats refuse.
The host makes no model or external data calls.

Browser manifests publish the complete static module dependency closure,
styles and images. browser-client.mjs is a reference consumer: it takes explicit
provider/version/manifest-digest selections, verifies all bytes before creating
executable URLs, and shares identical modules across providers. Discovery does
not select or admit a provider. This loader is not a production isolation boundary.

## Deployment and verification

ui-providers-host.mjs serves only the UI API and health endpoints. It speaks
HTTP behind Azure TLS termination. The general server.mjs also hosts other
provider families and is not the Azure UI deployment entrypoint.

.github/workflows/ui-providers.yml tests UI packages, packages only the discovered
UI provider set, deploys on main, and verifies the deployed source commit,
clean-build marker, exact provider set and manifest digests. The deployment
uses the existing sfx-providers-github-ui identity and sfx-ui-providers app.
No altitude, audio, presentation or login routes are included.

Local verification: node --test tests (241 tests passed on 2026-10-09). The UI
browser check loaded the six browser entrypoints from verified HTTP assets and
mounted all five regions plus the declared drill-down. These are implementation
checks, not landing circuit acceptance.

Acceptance order: deploy this API; check its actual response shapes; declare
the Azure HTTPS bindings in sfx-embody; execute ui-page-landing through the
local installed kernel and observe real receipts in Explorer. Deploy
sfx-platform to staging only after that acceptance succeeds. The binding draft
is not installed until its successful invocation preflight. Provider hosting
alone does not establish estate admission or successful circuit execution.
