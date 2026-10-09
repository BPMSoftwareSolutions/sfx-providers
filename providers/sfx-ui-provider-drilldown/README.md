# sfx-ui-provider-drilldown

Owns the provider drill-down UI from the landing blueprint §6. The folder,
descriptor, hosted manifest and API identity are the same declared provider ID.

`ui.view.prepare` consumes the existing `ui-page.v1` read carrying
`viewContractId: ui-view.v1`. It validates and preserves the supplied declaration;
it never invents a profile or reads the estate. `invoke(document, {selection})`
binds selection into the declared source/read inputs without mutating the input.
The HTTP operation receives a document whose selection inputs are already bound.

The digested browser entrypoint exports `mount`, `bindViewSelection`, `readView`,
`createViewRuntime` and `validateView`. It uses the one shared page projector and
component adapters in `src/ui-providers/browser`, also used by the region packages.
`mount(root,{host,document,selection,navigate})` renders that declared view. Reads
and governed actions use injected host ports; no credential reader is packaged.

The installed circuit's existing page-reader port is not replaced by this UI
realization. Package publication is separate from selecting an estate binding.
