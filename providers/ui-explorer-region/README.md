# ui-explorer-region

First UI/UX provider package of the circuit Explorer: the four declared Explorer regions — top
header, left sidebar, middle, right sidebar — realised as providers that link their UI content
(CSS/HTML/SVG) as declared assets with `sha256:` digests, loaded by the trusted shell through the
circuit. No region content is hand-authored in `sfx-platform`; the shell keeps only the projector,
validator, routing and security seams.

Status: implementation only, conformed to its declared authority. Version 0.1.1 restores the sidebar
landmark names the hand-authored Explorer carried ("Capability explorer", "Observe and selection details");
it is hosted with the other UI providers (`docs/ui-provider-hosting.md`). The provider is **not declared in
the estate**, its contracts are `PROPOSED`, and every region binding is `UNBOUND`. The declared
authority for the four regions is
`sfx-platform/docs/sfx-website-product-evolution/ui-explorer-region-blueprint.md` — region set,
contract names, content manifest and refusals must match it exactly; the process frame is
`ui-circuit-blueprint-strategy.md` section 2, and the uniform module contract is
`analysis/12-ui-runtime-providers.md` section 2. **Every future revision of this package must cite
the blueprint and move with it.** Browser execution waits on gate G2.

## Uniform module contract

| export | meaning |
| --- | --- |
| `descriptor` | provider identity and declared configuration: `moduleContractId: ui-runtime-provider.v1`, `providerId`, `package`, `version`, `runtime`, `type`, `method`, `executionLocation`, `declarationProfile`, `nativeShape`, `bindingState: UNBOUND`, `readiness`, `contractStatus`, `operations[]` (`ui.region.load`, `READ_ONLY`) |
| `capabilities` | one declared capability link per region: `capabilityId`, `role: PLATFORM`, `platformCapabilityId`, `conformanceContractId`, `providerId`, `operationId`, `status: PROPOSED` |
| `invoke(input, options)` | deterministic loading call; returns the `{ providerId, toolId, providerExecution, elapsedMs, requestBytes, disposition, candidate, shapeConforms, findings }` envelope. `disposition` is `AUTHORED` (candidate present) or `HELD` (`candidate: null`, named findings) |
| `contentManifest` | `ui-content-manifest.v1`: every region and asset as declaration data — `assetId`, `kind`, `mediaType`, `role`, `path`, `bytes`, `digest` — plus a manifest `digest`; no content bytes |
| `regions` | the four region declarations with their loaded assets (each asset additionally carries `content`) |
| `inputShape` / `outputShape` | `ui-region-request.v1` / `ui-region-content.v1`, both `PROPOSED`, with JSON schemas |
| `handle` | alias of `invoke`, matching the `altitude-01`/`ui-runtime-token-set` naming |

The operation is `ui.region.load`. Input is
`{ contractId: "ui-region-request.v1", regionId: "header" | "left-sidebar" | "middle" | "right-sidebar" }`.
The candidate carries the region's provider identity, role, place, basis and its three assets with
their content, per-asset `sha256:` digests and a whole-candidate digest.

Refusals: `UI_REGION_REQUEST_INVALID` (unknown member, bad contract id, missing or non-string
regionId), `UI_REGION_REQUEST_OVERSIZED` (over 16384 bytes), `UI_REGION_UNKNOWN` (a region the
blueprint does not declare). Never a silent drop and never a fallback region.

No dependencies beyond `node:crypto` and `node:fs` (the package reads its own declared assets to
digest them); no network, DOM writes or process state.

## Regions and their circuit roles

The roles are the true roles stated in `ui-circuit-blueprint-strategy.md` section 2; `basis`
carries the evidence citations. Each region is a separate provider identity under the package's
`providerId`.

| # | region | providerId | circuit role | declared assets | evidence |
| ---: | --- | --- | --- | --- | --- |
| 1 | `header` | `sfx-ui-explorer-region-header` | Shell chrome: brand, primary navigation, environment label, identity/session mount. Chrome only, never meaning. | `assets/header.{css,html,svg}` | blueprint §2.1; strategy:67; `explorer.html:180-186` |
| 2 | `left-sidebar` | `sfx-ui-explorer-region-left-sidebar` | Navigate and select a capability: search/picker plus declared section/group/node navigation; counts, states and badges shown as returned, never recomputed. | `assets/left-sidebar.{css,html,svg}` | blueprint §2.2; strategy:68; `explorer.html:188-191` |
| 3 | `middle` | `sfx-ui-explorer-region-middle` | Scenario circuit canvas and execution: capability header, scenario bar, objective composer, run bar, declared circuit scene, invocation timeline, run-evidence summary, selected section. Status bar is chrome carried inside this boundary. The viewer draws traversal state and decides nothing. | `assets/middle.{css,html,svg}` | blueprint §2.3; strategy:69; `explorer.html:193-257,302` |
| 4 | `right-sidebar` | `sfx-ui-explorer-region-right-sidebar` | Context, inspection and evidence: Run/Runs/Evidence tabs, run report and steps, observe form bound to the declared input contract, runs history, captured component evidence, selection details, declared authority. | `assets/right-sidebar.{css,html,svg}` | blueprint §2.4; strategy:70; `explorer.html:259-300` |

Audited against the blueprint: the region set (`header`, `left-sidebar`, `middle`, `right-sidebar`),
the content manifest (`ui-content-manifest.v1`, manifest `explorer.v1`, twelve digested assets), the
contract names (`ui-runtime-provider.v1`, `ui.region.load`, `ui-region-request.v1`,
`ui-region-content.v1`) and the refusals (`UI_REGION_REQUEST_INVALID`,
`UI_REGION_REQUEST_OVERSIZED`, `UI_REGION_UNKNOWN`) match it exactly; each region `basis` now names
the blueprint first.

Each region provider declares its own platform port —
`sda-ui-explorer-region-{header,left-sidebar,middle,right-sidebar}-port.v1` — and all four remain
`UNBOUND` with `REVIEWABLE`/`HELD` readiness, mirroring the login circuit's
declaration-before-admission pattern. The assets are provider-owned content: structure (`html`
slots), presentation (`css` over the `site.v1` token set) and figure (`svg` frames); declarations
themselves never contain executable markup.

## Declaration and binding this provider expects

To become estate providers, one `sfx-embody` migration pair (preflight `ROLLBACK`, commit
`COMMIT`, in-transaction proof) declares, in order:

1. the package provider identity and the four region identities via `model.add_provider`, with
   `declarationProfile: sfx-provider-catalog.v1`, `runtime: node`, `type: ui-runtime`,
   `method: in-process`, `executionLocation: browser-runtime`, and the `ui.region.load` operation;
2. the contracts `ui-region-request.v1` and `ui-region-content.v1` with `model.declare_contract`;
3. the four platform ports and their implementations for the `browser-runtime` target with
   `model.declare_provider_port_implementation`;
4. the four bindings through `model.bind_provider` with `platformCapabilityId` + `providerId`.
   Bindings stay `UNBOUND` until conformance passes.

Browser execution itself waits on **gate G2** (browser-runtime binding target and multi-child
composition). Until then the trusted shell consumes the same `invoke` shape directly.

## Check

```powershell
node --test tests/ui-explorer-region.test.mjs
```

The dependency-free check proves the uniform contract exports, the four region providers and their
capability links, every content-manifest digest against the files on disk, deterministic region
loading through `invoke`, and refusal by code on unknown regions and malformed or oversized
requests. It needs no browser, network or estate.
