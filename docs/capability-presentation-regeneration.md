# Regenerate a capability presentation

Regeneration uses command arguments. It requires no source edits, per-capability
scripts, manual slide insertion, or AI narrator. The same provider applies to the
selected capability's declarations and declared scenario closure.

## One-time machine setup

Use Node.js 20 or newer and configure the estate reader as described in
[capability-presentation.md](capability-presentation.md#database-host-binding).
For PowerPoint, the ignored `config/capability-presentation.local.json` can hold
both `bootstrapRoot` and an absolute `artifactModule` path to the installed
`@oai/artifact-tool/dist/artifact_tool.mjs`. `CIRCUIT_ARTIFACT_MODULE` remains an
optional override. The presentation runtime is an installed dependency; it does
not need to be selected separately for each capability.

Standalone Google publishing additionally needs an authenticated application
host. The supplied REST host consumes `SFX_GOOGLE_ACCESS_TOKEN`; the application
owns OAuth consent, API access and token refresh. Supply credentials through the
host's secret mechanism. A connected Codex Google account does not automatically
configure a standalone Node process. See the [migration host guide](google-slides-migration.md#run-unattended-from-an-authenticated-application).

## Each regeneration

From the repository, choose the capability and a fresh destination:

```powershell
node capability-deck.mjs --capability-id sda-cli-invoke --view scenario --context-altitude all --output outputs/cli-next --pptx
```

Change `--capability-id` to select another capability. Add `--namespace-id` if its
identity is ambiguous. Semantic view and authoring context are independent
options. The default includes all eleven authoring context layers.

The complete PowerPoint is `outputs/cli-next/presentation.pptx`. Transport
volumes retain their own sources and optional PowerPoints, while this root file
contains all slides in order with continuous numbering. `receipt.json` records
the request, selected estate version, root scenario and snapshot digest.

To replay retained evidence instead of reading current estate state:

```powershell
node capability-deck.mjs --snapshot outputs/cli-next/snapshot.json --output outputs/cli-replay --pptx
```

To publish the result through a configured standalone Google host:

```powershell
node google-slides-migrate.mjs prepare --input outputs/cli-next/presentation.pptx --output outputs/google-slides/cli-next --folder-id GOOGLE_FOLDER_ID --title 'Capability presentation'
node google-slides-migrate.mjs run --job outputs/google-slides/cli-next --host src/google-slides-migration/rest-host.mjs
```

The final command returns the native Google Slides URL and verification result.
Retain the job directory: rerunning that job reuses its observed Google file ID.
A new generation and migration job create a new deck. Updating an existing
Google deck in place is not implemented by this migration operation.

## Recorded regeneration on September 26, 2026

The live command generated `sda-cli-invoke` from estate 34, capability version
1161266, with 35 slides. It included the blueprint, Gherkin evidence, all eleven
context layers and evidence-gap slides. The selected graph contained two
scenarios, two operations and one binding; these counts came from that read.
No equity-price snapshot or separately authored slides were added.

The complete generated PPTX passed package, geometry, font and import checks.
The finalizer left its bytes unchanged. The native conversion preserved all 35
slides, editable text and notes. Every local and Google-rendered slide was
visually inspected; no slide repairs were applied. This is a reviewed run, not
a claim that automated structural checks establish visual fidelity for every
future capability.

[Generated Google Slides deck](https://docs.google.com/presentation/d/1dLkaphJZKEILEWzW2PZJ2tURQAXngBo23KhZ03_mCCE/edit)

Local evidence remains under `outputs/capability-estate/sda-cli-invoke-regenerated-v4`
and `outputs/google-slides/sda-cli-invoke-regenerated-v4`. Output files and machine
configuration are ignored by Git; the provider, schemas, tests and instructions
are version-controlled. This provider remains hand-authored, pending the later
declared-capability migration.
