# ui-shell-footer

The shared shell footer provider: the `footer` region realised as a provider that links its UI
content (CSS/HTML/SVG) as declared assets with `sha256:` digests, loaded by the trusted shell
through `ui.region.load`. The shell projects the declared structure (`footer-brand`,
`footer-credit`, `footer-navigation`, `release-label`) and supplies the behavior: the wordmark
asset, the credit copy, the per-page links and the release label. No footer markup is
hand-authored in `sfx-platform`.

Status: implementation only, conformed to its declared authority. The provider is **not declared
in the estate**, its contracts are `PROPOSED`, and the region binding is `UNBOUND`. Browser
execution waits on gate G2.

## Uniform module contract

| export | meaning |
| --- | --- |
| `descriptor` | provider identity (`sfx-ui-shell-footer`), module contract `ui-runtime-provider.v1`, `ui.region.load` `READ_ONLY` |
| `capabilities` | the declared `load-shell-footer` platform capability link, status `PROPOSED` |
| `invoke(input, options)` | deterministic loading call returning the `{ disposition, candidate, shapeConforms, findings }` envelope |
| `contentManifest` | `ui-content-manifest.v1` (`shell-footer.v1`): the region and its three assets as declaration data with digests; no content bytes |
| `regions` | the region declaration with its loaded assets |
| `inputShape` / `outputShape` | `ui-region-request.v1` / `ui-region-content.v1`, both `PROPOSED` |

Input is `{ contractId: "ui-region-request.v1", regionId: "footer" }`. The candidate carries
`regionProviderId: sfx-ui-shell-footer`, role `shell-chrome`, place 5 and the three content
assets with per-asset and whole-candidate `sha256:` digests.

Refusals: `UI_REGION_REQUEST_INVALID`, `UI_REGION_REQUEST_OVERSIZED` (16384 bytes),
`UI_REGION_UNKNOWN` — the same closed vocabulary as the Explorer region package, never a
fallback region.

No dependencies beyond `node:crypto` and `node:fs`.

## Check

```powershell
node --test tests/ui-shell-footer.test.mjs
```
