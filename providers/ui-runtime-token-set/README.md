# ui-runtime-token-set

First reference provider of the `ui-runtime` family: the smallest browser concern with no browser
execution. It serves the `site.v1` token set derived from the deployed shell's
`live-circuit/circuit/site.css` `:root` block, as declaration data, through the uniform
`{ descriptor, capabilities, invoke }` module contract.

Status: implementation only. The provider is **not declared in the estate**, its contracts are
`PROPOSED`, and its binding is `UNBOUND`. The design that places it and its four sibling providers
is `sfx-platform/docs/sfx-website-product-evolution/analysis/12-ui-runtime-providers.md`.

## Uniform module contract

| export | meaning |
| --- | --- |
| `descriptor` | provider identity and declared configuration: `moduleContractId: ui-runtime-provider.v1`, `providerId`, `package`, `version`, `runtime`, `type`, `method`, `executionLocation`, `declarationProfile`, `nativeShape`, `bindingState`, `readiness`, `contractStatus`, `operations[]` |
| `capabilities` | declared capability links: `resolve-ui-token-set` as a `PLATFORM` engagement on the proposed port `sda-ui-token-set-port.v1` (`PROPOSED`) |
| `invoke(input, options)` | deterministic operation call; returns the `{ providerId, toolId, providerExecution, elapsedMs, requestBytes, disposition, candidate, shapeConforms, findings }` envelope. `disposition` is `AUTHORED` (candidate present) or `HELD` (`candidate: null`, named findings) |
| `inputShape` / `outputShape` | `ui-token-request.v1` / `ui-token-set.v1`, both `PROPOSED`, with JSON schemas |
| `handle` | alias of `invoke`, matching the `altitude-01`/`circuit-presentation` naming |

The operation is `ui.tokens.resolve`. Input is
`{ contractId: "ui-token-request.v1", tokenSetId?: "site.v1", groups?: [...], names?: [...] }`.
`groups` and `names` are optional selectors and union when both are present; `names` also resolves
declared aliases. The candidate carries `tokenSetId`, `derivedFrom`, `capturedAt`, `tokens[]`,
`aliases[]` and a `sha256:` digest over the selected set.

Refusals: `UI_TOKEN_REQUEST_INVALID` (unknown member, bad contract id, non-string selectors),
`UI_TOKEN_REQUEST_OVERSIZED` (over 16384 bytes), `UI_TOKEN_SET_UNKNOWN`, `UI_TOKEN_GROUP_UNKNOWN`,
`UI_TOKEN_NAME_UNKNOWN`.

No dependencies beyond `node:crypto`; no network, DOM, filesystem writes or process state.

## Token derivation

Values are copied from `live-circuit/circuit/site.css:4-12` on 2026-10-07, grouped for declaration
consumption. `--observation` is carried as a declared alias of `--cyan` pending the G7 stylesheet
change; it is not yet present in site.css.

| group | tokens |
| --- | --- |
| `surface` | `--bg`, `--bar`, `--panel`, `--panel-solid`, `--shade` |
| `text` | `--white`, `--muted`, `--dim` |
| `accent` | `--cyan`, `--blue` (+ alias `--observation`) |
| `signal` | `--green`, `--amber`, `--red` |
| `border` | `--line` |
| `geometry` | `--radius`, `--gutter` |
| `typography` | `font` (the `:root` shorthand, not a custom property) |

`ui-layout.v1` policy already names `"tokenSet": "site.v1"`
(`implementation-strategy.md` section 5.2). v1 keeps site.css as the deployed source of truth
(section 4.0 D7); this provider is the read seam a browser binding will use when tokens publish as
estate data.

## Declaration and binding this provider expects

To become an estate provider, one `sfx-embody` migration pair (preflight `ROLLBACK`, commit
`COMMIT`, in-transaction proof) declares, in order:

1. the provider identity via `model.add_provider` / the provider document surface, with
   `declarationProfile: sfx-provider-catalog.v1`, `runtime: node`, `type: ui-runtime`,
   `method: in-process`, `executionLocation: browser-runtime`, and the
   `ui.tokens.resolve` operation (`declare-provider-identity.sql:121-141`);
2. the contracts `ui-token-request.v1` and `ui-token-set.v1` with `model.declare_contract`;
3. the platform port `sda-ui-token-set-port.v1` and its implementation for the
   `browser-runtime` target (`model.declare_provider_port_implementation`);
4. the binding `resolve-ui-token-set` -> port through `model.bind_provider` with
   `platformCapabilityId` + `providerId`, mirroring the login circuit's honest
   declaration-before-admission pattern (`declare-authenticate-ide-user.sql:86-94`, `:106-114`).

Browser execution itself waits on **gate G2** (`implementation-strategy.md` section 7.5): a
`browser-runtime` binding target, `ui-embodiment-plan.v1` admitted as a provider protocol,
multi-child composition and page-view testimony. Until then the shipped shell consumes the same
`invoke` shape directly, so the declaration lands without a contract change. Unlike the
altitude migration bridge, the ui-runtime family is the north-star home
(`implementation-strategy.md` section 7.6); it is not shrink-only and no package is deleted when
the estate declares it.

## Check

```powershell
node --test tests/ui-runtime-token-set.test.mjs
```

The check proves the uniform contract exports, deterministic resolution of the full `site.v1` set,
group/name/alias selection and every refusal code. It needs no browser, network or estate.
