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
node capability-deck.mjs --capability-id sda-cli-invoke --view capability --context-altitude all --output outputs/cli-next --pptx
```

Change `--capability-id` to select another capability. Add `--namespace-id` if its
identity is ambiguous. Semantic view and authoring context are independent
options. The default includes all eleven authoring context layers.

The complete PowerPoint is `outputs/cli-next/presentation.pptx`. Transport
volumes retain their own JSON sources, while this root file
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

## Earlier regeneration on September 26, 2026

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

## Progressive blueprint generation

The primary defaults to capability topology. Request `--view event` to open a
complete selected Event as the primary blueprint; the capability and scenario
views remain linked. Use `--scenario-id`, `--operation-id`, or
`--transformation-id` for deeper selection. Review and inventory links open
separate sheets. No source changes or AI narrator are required.

The updated Google migration verification also checks internal slide destinations,
so loss of drill-down navigation returns `NEEDS_REVIEW`. Runtime observations
are not connected by this static presentation workflow.

## Reviewed blueprint regeneration on September 26, 2026

The current renderer retains the supplied blueprint grid, typed colors, numbered
execution cells, capability boundary and separate observation band. Native slide
links disclose capability, scenario, Event and operation-owned provider views.
Review findings decorate known nodes and open separate review sheets; unconnected
declarations remain in the inventory. No illustrative cells from the reference
image were added to estate authority.

Two capability-ID reads supplied the snapshots used for the final renderings:

| Capability | Primary view | Slides | Native Google Slides |
| --- | --- | --- | --- |
| `resolve-equity-market-price-evidence` | Event | 63 | [Open complete Event sheet](https://docs.google.com/presentation/d/1aVqW3lBWqnWoWFxdBvaOYVlg49Yxkt_Sl9M0yEVTMy0/edit#slide=id.p2) |
| `sda-cli-invoke` | Capability | 40 | [Open capability sheet](https://docs.google.com/presentation/d/14rN6gKVplCS-ShTefKXg5Z_O38I6Y_zO4K3TreOr_I4/edit#slide=id.p2) |

The equity sheet contains all 35 selected operation declarations. Its 39 retained
bindings include four uninvoked declarations, which appear in the inventory.
The selected candidate blueprint record has 35 nodes and zero edges. The shown
operation order therefore does not establish complete canonical routing or prove
monotonic progress. Seven source-bound warnings make those gaps and the missing
observation contract visible. The CLI review reports one error and six warnings,
including its declared self-call without a retained bound and an unconnected
scenario. The source Gherkin is preserved, including the CLI's greeting-related
feature text; the renderer does not rewrite that mismatch into a new intent.

Both decks retain the eleven-layer context map and feature/Gherkin context.
The equity run expands context altitude 7; the CLI run expands all eleven.
All 64 relevant tests passed. Both PowerPoint packages passed the artifact import
and layout checks, and native Google conversion retained editable text, notes,
external links and internal slide destinations. Every Google-rendered slide was
visually inspected; structured native checks returned zero issues. These checks
do not establish completeness of source authority or connect live telemetry.

Final local evidence is under
`outputs/capability-estate/equity-blueprint-reviewed`,
`outputs/capability-estate/sda-cli-invoke-blueprint-drafting`, and matching
directories under `outputs/google-slides`. Each contains retained generation or
migration receipts; generated artifacts remain ignored. The provider, schemas,
projection rules, regression tests and supplied reference assets are versioned.

### Connector repair

The follow-up routing validation rejects spikes, reversals and unnecessary bends
in clear forward corridors. Regeneration from the same equity snapshot repaired
the provider branches on slides 14, 17, 20, 22, 25, 27 and 30. The existing Google
deck was repaired in place using those generated coordinates; its slide IDs,
content, links and notes remain unchanged. Native readback found no changes to
the other 4,343 elements. All seven repaired slides were visually checked, and
the other 56 Google PDF pages were pixel-identical to the prior render.

All 68 relevant tests pass, including refusal of the reported spike and coverage
for fan-out, upward branches and necessary obstacle detours. The regenerated
PowerPoint passed package, layout and import checks. The current local deck is
`outputs/capability-estate/equity-connector-fixed/presentation.pptx`; Google repair
and render evidence is in `outputs/google-slides/equity-connector-fix`.

### Provider inspection and automatic scaling

The follow-up live estate read retains provider identities from explicit binding
configuration and transformation AST declarations. The equity overview now
contains three market-data identities plus `google/gemini`. Each provider label
opens an involvement register, whose operation links disclose the exact binding
and source evidence. Five exchange bindings still lack explicit provider IDs;
the review exposes these gaps instead of borrowing ownership from a shared
platform or a later testimony transformation. The result has 12 warnings and no
detected structural errors. It remains an incomplete authority projection, not
proof of successful execution or monotonic progress.

The regenerated 68-slide deck retains all 35 operations, the feature writeup and
the eleven-layer context map. Geometry scales uniformly into the blueprint;
measured text fitting then wraps and shrinks labels. Python Pillow supplies the
font measurements and an independent label-fit inspection command:

```powershell
python -m pip install -r requirements-blueprint.txt
python scripts/blueprint_font_metrics.py --font C:/Windows/Fonts/arial.ttf --bold-font C:/Windows/Fonts/arialbd.ttf --inspect outputs/capability-estate/equity-provider-inspection-scaled/storyboard.json
```

Use `--output src/circuit-presentation/font-metrics/arial.json` to rebuild the
metrics when intentionally changing the installed reference fonts. Font files
are not redistributed. Ordinary capability regeneration consumes the committed
metrics and needs neither a Python subprocess nor code edits.

All 78 relevant tests pass. Pillow checked 433 blueprint labels with no fit
findings. The PowerPoint passed package, layout and artifact-import checks.
The native Google deck was updated in place; all 21 slides affected by the final
fit repair were visually inspected, and the other 47 rendered pages were
pixel-identical to the preceding render. Native readback returned zero structured
issues and all 124 text-link destinations resolved, including the four provider
inspection pages. These checks do not assert native PowerPoint font rendering.

[Current capability overview](https://docs.google.com/presentation/d/1aVqW3lBWqnWoWFxdBvaOYVlg49Yxkt_Sl9M0yEVTMy0/edit#slide=id.p3)

Current PowerPoint and generation evidence:
`outputs/capability-estate/equity-provider-inspection-scaled/presentation.pptx`.
Native readback and render evidence:
`outputs/google-slides/equity-scenario-providers/scaled-*`.
The source snapshot digest is
`4a6456984cec25c4430218f477b0bb54a092094630749d161b682772290f95f5`.
The pasted CLI run is contextual evidence only; no invocation was attached to
the observation layer, and this workflow did not execute the capability.

### Readable execution and scenario blueprints

The next regeneration keeps the same retained snapshot and produces 69 slides.
[Slide 03](https://docs.google.com/presentation/d/1aVqW3lBWqnWoWFxdBvaOYVlg49Yxkt_Sl9M0yEVTMy0/edit#slide=id.p2)
uses the full drafting surface for all 35 operations in five rows, with all 34
declared-order edges and four explicit row continuations. Its measured labels
range from 8.75 to 10.25 points. Row numbers are layout groups; no semantic stages
were invented. The sheet still identifies canonical routing and monotonic proof
as unverified.

The linked
[scenario blueprint](https://docs.google.com/presentation/d/1aVqW3lBWqnWoWFxdBvaOYVlg49Yxkt_Sl9M0yEVTMy0/edit#slide=id.sfx_scenario_blueprint_69)
is slide 02, immediately after the cover. It uses the requested amber input cards, blue numbered
operation references, violet provider ports, teal/red outcome cards, native
drafting icons, signal legend and separate observation band. Its four provider
identities connect to eight exact operation references. Five exchange operations
without direct provider identities remain marked for inspection. The input
fields, Event and three outcome variants come from retained declarations; the
reference image's illustrative eight operations and telemetry channels were not
introduced as authority.

This ordering is part of the generator: scenario blueprint, then the selected
primary projection. Internal destinations and slide numbers are remapped before
compilation, so the placement persists across ordinary capability regeneration.

Regenerate without code edits:

```powershell
node capability-deck.mjs --snapshot outputs/capability-estate/equity-provider-inspection-scaled/snapshot.json --view event --context-altitude 7 --output outputs/capability-estate/equity-readable-circuit-next --pptx
```

For current estate state, substitute `--capability-id` for `--snapshot` as shown
above. The complete eleven-layer context map remains in the deck. The renderer,
schema, visual references and regression tests are versioned; regeneration does
not require an assistant. The standalone Google migration host still creates a
new native deck; this reviewed update used the connected Google API in place.

All 83 relevant tests passed. Python checked 415 labels with no fit findings.
The PowerPoint passed package, layout, font-policy and artifact-import checks.
Google readback reported zero structural issues and all 168 text links resolved.
The two new renderings were visually inspected from Google's PDF. Before the
requested reordering, the other 67 slides were pixel-identical and their native
slide resources were unchanged. Moving the scenario blueprint to slide 02 then
updated 68 page numbers while preserving all other 4,519 native elements and all
168 links. This verifies rendering and retained identities, not runtime behavior.

Current local PowerPoint and generation evidence:
`outputs/capability-estate/equity-scenario-first/presentation.pptx`.
Native readback, edit payload and PDF render evidence:
`outputs/google-slides/equity-readable-circuit`.

### Data-driven component shapes

The next 69-slide regeneration applies the versioned component shape map to the
same snapshot. Ports use sockets, bindings use adapters, providers use pinned
modules, platforms use hexagons, and scenario Input/Outcome use double-ring
terminals. The scenario blueprint remains slide 02 and the complete circuit
remains slide 03. The declaration graph, provider ownership, review findings and
slide order are unchanged.

To adjust these shapes, edit
`src/capability-presentation/styles/component-glyphs.v1.json`, then run the normal
capability generation command. Existing native primitives can be composed into
new recipes without changing JavaScript. Shape anchors and text frames belong
to the same validated data contract. A new primitive or new interpretation of
estate semantics would still require implementation and validation.

The updated Google deck has 23 restyled slides. All were visually inspected from
Google's PDF render; the other 46 slides are pixel-identical and their native
resources are unchanged. All text-link destinations resolve. The 87 relevant
tests pass, Python reports no fit findings across 415 labels, and the PowerPoint
passes package, layout, font-policy and artifact-import checks. Native PowerPoint
font rendering was not independently executed.

Current PowerPoint and generation evidence:
`outputs/capability-estate/equity-component-glyphs/presentation.pptx`.
Native update and render evidence:
`outputs/google-slides/equity-component-glyphs`.

### Complete execution component symbols

The complete execution sheet now uses the component contract's `event` mapping
as well. Exact platform bindings select transformation, credential-adapter and
HTTP-exchange symbols. Scenario calls use their declared operation kind; unknown
bindings remain unclassified. Add platform mappings and adjust compact recipes
in the same JSON file, then regenerate normally. Operation labels do not create
branching gates, and decorative contacts do not assert additional ports.

The retained equity snapshot renders 21 transformations, 7 credential adapters
and 7 HTTP exchanges. All 35 operation identities, 34 order edges, diagnostic
markers and operation links remain. The scenario blueprint stays on slide 02;
the complete execution circuit stays on slide 03 (native ID `p2`). Each cell's
render record includes the binding ID, platform ID and source pointer that
selected its symbol. These are rendering classifications, not runtime testimony.

```powershell
node capability-deck.mjs --snapshot outputs/capability-estate/equity-provider-inspection-scaled/snapshot.json --view event --context-altitude 7 --output outputs/capability-estate/equity-execution-components-next --pptx
```

The 91 relevant tests passed. Python measured 415 labels with no fit findings;
the execution sheet's minimum label size is 8.5 points. The regenerated PowerPoint
passed package, layout, font-policy and artifact-import checks. Google readback
reported zero structural issues and 172 valid internal text links. Only slide 03
changed: 211 unaffected objects on that slide were retained, and the other 68
native slides and rendered pages are unchanged. Slide 03 was visually inspected
from Google's PDF. Re-running the provider reproduces the saved content digest.
Native PowerPoint font rendering was not independently executed.

Current PowerPoint and generation evidence:
`outputs/capability-estate/equity-execution-components-final/presentation.pptx`.
Native update, PDF render and verification evidence:
`outputs/google-slides/equity-execution-components`.

### Scenario operation references

Slide 02 now reuses the complete Event's data-driven component selection, compact
shape recipes and action colors. In the retained equity snapshot, its eight
provider operation references comprise two HTTP-exchange modules and six
transformation badges. Provider ownership, solid binding links, dashed testimony
references, operation numbers and drill-down destinations are preserved.

The 92 relevant tests passed, and Python found no fit issues across 415 labels.
The PowerPoint passed package, layout, font-policy and artifact-import checks.
The updated Google slide was visually inspected from its PDF render. All 172
internal text links resolve, native structural checks report no issues, and the
other 68 slides are unchanged both structurally and pixel-for-pixel. The update
retained 289 unaffected objects on slide 02. Native PowerPoint font rendering was
not independently executed.

Current PowerPoint and generation evidence:
`outputs/capability-estate/equity-scenario-components/presentation.pptx`.
Native update, PDF render and verification evidence:
`outputs/google-slides/equity-scenario-components`.

### Capability portfolio and a real multi-scenario example

The capability overview now shows root-connected scenario cards, their actual
call/transition edges, root input fields and outcome variants, provider involvement
badges, and links into each scenario. The existing equity deck's capability view
is slide 04; its scenario blueprint remains slide 02. The equity snapshot still
contains exactly one scenario, 35 operations and four provider identities.

Read-only database discovery selected `inspect-canonical-circuit-blueprint-candidate`
from estate 34, namespace `sidefx:capabilities`, capability version 95. All eight
declared scenarios are root-connected through seven nested scenario calls. Across
the scenarios there are 17 operations and no declared external provider identities.
The portfolio does not recast those calls as outcome transitions or parallel work.
The discovery query is retained in
`src/capability-presentation/sql/multi-scenario-capabilities.sql`.

Regenerate directly from the database without changing code:

```powershell
node capability-deck.mjs --capability-id inspect-canonical-circuit-blueprint-candidate --view capability --context-altitude 7 --output outputs/capability-estate/blueprint-inspection-next --pptx
```

The 83-slide inspection deck keeps all eleven context summaries, scenario and
execution drill-downs, the complete retained feature writeup, Gherkin scenarios,
source registers and structural review. Context altitude 7 selects the expanded
authoring context; it does not remove the other ten altitude summaries.

The [eight-scenario portfolio is slide 03](https://docs.google.com/presentation/d/1Oxl5kwIcZjW9IRpmM_HiHzeKoK9VHNhch9bNfLuLKv0/edit?slide=id.p3#slide=id.p3).
The [equity capability overview is slide 04](https://docs.google.com/presentation/d/1aVqW3lBWqnWoWFxdBvaOYVlg49Yxkt_Sl9M0yEVTMy0/edit?slide=id.p3#slide=id.p3).

The 152 presentation and migration tests pass. Google structural checks report
zero issues for both decks. All 129 internal text links in the multi-scenario
deck and 168 in the equity deck resolve; every expected command-level drill-down
destination was checked against native readback. The portfolio preserves exact
scenario IDs, call endpoints, and provider source paths. The review reports
0 errors / 3 warnings for the inspection capability and 0 errors / 12 warnings
for the equity snapshot; these are bounded structural findings, not admission
or monotonic-progress proofs. No selected capability was executed.

Both PowerPoints pass package, layout, Arial font-policy and artifact-import
checks with no findings or warnings. All Google pages were rendered for visual
review. Only the equity capability overview changed; the other 68 pages are
unchanged both structurally and pixel-for-pixel. Native PowerPoint font rendering
was not independently executed.

PowerPoint, snapshots, storyboard and receipts are retained locally in
`outputs/capability-estate/blueprint-inspection-portfolio-verified` and
`outputs/capability-estate/equity-capability-portfolio-verified`. Google readback,
PDF renders and verification reports are in
`outputs/google-slides/blueprint-inspection-portfolio` and
`outputs/google-slides/equity-capability-portfolio`.

### Scenario arrow attachment repair

The eight-scenario portfolio revealed six incoming arrows whose final segments
ran vertically along their target card borders. Their endpoints were correct,
so the previous endpoint-ownership check accepted them. The new attachment rule
rejects all six retained defective paths. All seven regenerated call arrows now
enter their scenario cards perpendicularly with a clear straight lead.

Slide 03 in the same Google deck was updated. All 221 unaffected objects on
that slide were preserved, all 129 internal links resolve, and the other 82 slides
are unchanged structurally and pixel-for-pixel. Native readback verified all seven
arrow tips and horizontal incoming segments. The complete source graph is unchanged.
Google structural checks report no issues, Python measured 192 labels with no fit
findings, and the PowerPoint passes package, layout, font-policy and artifact-import
checks with no findings or warnings. The 154 presentation and migration tests pass.

Generation and PowerPoint evidence: `outputs/capability-estate/portfolio-arrow-fix`.
Native update, PDF render and verification: `outputs/google-slides/portfolio-arrow-fix`.

### Nested objective capability inspection

The [request-capability-from-objective portfolio](https://docs.google.com/presentation/d/1GUqLaFcVr8-2hp5jzaQ6v0aiQ4Mx-iIkyVgEr9gOkPs/edit?slide=id.p3#slide=id.p3)
was generated from estate 34, capability version 910966. Slide 02 is the root
scenario blueprint; slide 03 is the linked capability portfolio. The 107-slide
inspection deck retains 10 connected scenarios, 7 calls, 2 transitions, 49
operations, 42 port bindings, and 3 exact provider identities. Model-provider
port names do not establish additional provider identities by themselves.

This nested graph exposed a generic layout limit: independently widening every
call depth made labels unreadable. The portfolio now chooses column packing
against the complete viewport, reserves room for wrapped provider badges, and
renders directly through the portfolio grammar. It no longer attempts the
obsolete layered capability diagram before drawing the final sheet. No
capability-specific cells, scenario labels, edges, or provider mappings were added.

Generate a fresh database selection with the existing entry point:

```powershell
node capability-deck.mjs --capability-id request-capability-from-objective --view capability --context-altitude 7 --output outputs/capability-estate/objective-fresh --pptx
```

For an exact replay, replace `--capability-id` with `--snapshot` pointing to the
retained snapshot. This run first captured the database selection and then
replayed that snapshot during renderer verification. All eleven context layers
are included; altitude 7 supplies the expanded execution context.

Retained snapshot digest:
`3cb1b1493300753950622cba5adb5011df7512a5b1f866d6799273f8ba0d4c45`.
Content digest:
`6f47ed6e4777a6f23f80f97d79d3fb84f0cdef4e9e8a8f4dd642a719a1bf5c7f`.

The deck retains five blueprint warnings and two contextual findings. The
feature references `decide-agent-route@91539` while the selected graph uses
`decide-agent-route@91665`; no version-owned feature binding was returned.
The capability-level semantic intent still describes standard-output delivery,
while the retained feature describes objective routing. These are source facts,
not renderer-authored corrections. No runtime execution or admission proof is
claimed.

Validation: 155 regression tests passed; PowerPoint package/layout checks passed
with no findings or warnings; Python/Arial metrics checked 542 blueprint labels
without overflow. All 107 Google PDF pages were visually reviewed, including
full-size scenario, portfolio, model-provider and equity execution sheets.
Native readback verified every expected navigation destination (210 links;
296 native text-run link records), every scenario edge, every provider badge,
and operation coverage in all ten Event projections.

Local artifacts and source replay:
`outputs/capability-estate/request-capability-from-objective`.
Google readback, PDF renders, link verification and test log:
`outputs/google-slides/request-capability-from-objective`.

### Database capability invocation inspection

The [invoke-database-capability deck](https://docs.google.com/presentation/d/1J7Qs6MpQZu1AIt7uxbJ3NZqukuaojZl6MZCOFli1Iio/edit?slide=id.p3#slide=id.p3)
was generated directly from estate 34, capability version 150662, with the
unchanged capability-ID provider. It has 16 slides: scenario blueprint on 02,
capability portfolio on 03, complete execution circuit on 05, and explicit
operation/port/binding/platform ownership on 07.

```powershell
node capability-deck.mjs --capability-id invoke-database-capability --view capability --context-altitude 7 --output outputs/capability-estate/invoke-database-capability --pptx
```

The selected graph contains one scenario, one operation, and one port binding
to `sda-embodiment-plan-port.v1`. It contains no explicit external provider
identity or statically selected child circuit. The deck preserves this scope;
it does not fabricate the implementation behind the platform port or invoke it.

Inspection retains three blueprint warnings and two context discrepancies:
feature scenario version 91183 differs from selected scenario version 91184,
and parsed Gherkin differs from retained source bytes. The source feature still
describes greeting/standard-output behavior, while the selected scenario
describes resolving and executing an invocation envelope. Both are retained.

Snapshot digest:
`43089c2554619692adb808558ee2dfe73aa09ec8d180d92b5f959cd31be06f8a`.
Content digest:
`eea623c637e829df1c34126efdc7774a7365089dda5c5feec60cf665bc133d0b`.

PowerPoint package/layout validation and Google native issue checks passed with
zero findings. All 16 PDF pages were visually reviewed; all 18 expected link
destinations were verified against native readback (19 text-run link records).
Python/Arial metrics found no overflow in 32 blueprint labels. No renderer code
changes were required for this capability.

Replay artifacts: `outputs/capability-estate/invoke-database-capability`.
Native readback, PDF renders and verification:
`outputs/google-slides/invoke-database-capability`.

### Declaration-only bindings remain inspectable

Historical result before the operation 06 repair in `sfx-embody b99871f`.
See the invocation-gate inspection below for the current selected circuit.

The [corrected objective scenario blueprint, slide 02](https://docs.google.com/presentation/d/1Uyh3xclUaiQzEyxQp-SaIDRNySQh5LcNFRcbl5tnpiw/edit?slide=id.p2#slide=id.p2)
now exposes operation **06**, `invoke-database-capability-port`, in amber with
**No provider association retained** and **Installation and compatibility
unverified**. The component opens its binding detail; the R04 inspection link
opens the review. The scenario Event also carries an amber outline. These are
inspection overlays on existing declarations, not additional provider nodes
or circuit edges. Slide 02 remains the primary inspection surface.

`PLATFORM_BINDING_WITHOUT_PROVIDER` is no longer suppressed by a
`platformImplementations` catalog entry. It retains the exact operation and
binding references, available platform declaration evidence, and distinct
`not-verified` installation/compatibility and `not-observed` execution states.
Blank or whitespace-only statements cannot establish a declared-read
association. This is a static missing-association check: a binding-local
statement, explicit provider identity, or transformation satisfies this rule
without proving installation or successful execution.

The main scenario sheet discloses flagged operations even when they have no
provider edge. Dense diagnostic sets expose three operation references plus
an explicit remainder count and review link. Diagnostics never create a
provider association. Existing provider references and their binding edges
remain intact.

The selected six-operation circuit now retains **0 errors / 4 blueprint
warnings**, including R04 at database ordinal 5 (presentation operation 06).
The invocation binding's configuration is `{}`. Live rows, installed registry
inspection, and the before/after CLI result are recorded in
[`sfx-embody/sql/inspect/binding-serviceability`](../../sfx-embody/sql/inspect/binding-serviceability/README.md).
The CLI still returns `CELL_EXECUTION_FAILED / DECLARED_READ_STATEMENT_MISSING`.
This change repairs the false-clean inspection; it does not serve the runtime
invocation. The existing declared repair mapping remains `NO_INSTALLED_REPAIR`
and points to the cross-language invocation-provider registration request.

Generate from current estate authority with the unchanged entry point:

```powershell
node capability-deck.mjs --capability-id request-capability-from-objective --view capability --context-altitude 7 --output outputs/capability-estate/objective-binding-inspection --pptx
```

The delivered 24-slide deck was rendered from the fresh captured snapshot and
replayed for the scenario overlay refinement. All source nodes and edges are
unchanged from the prior model-provider deck. Only the scenario sheet changed
in the final Google update; the other 23 native slides were verified unchanged.
There is one retained external provider identity, `google/gemini`; platform
declarations do not manufacture additional provider glyphs.

Snapshot digest:
`e2bd9d2d314c3e9ba52bda8f1757f493fca4a1a6f92d1fd724088764542acb2a`.
Content digest:
`16fd7671ba3fa975fc26a72abba2f98e90c1e1ac2174e38ac27b74cdb0c21df6`.

Validation: 158 regression tests passed; PowerPoint package, layout, Arial font
policy and artifact-import checks passed. Google native readback verified all
36 expected link destinations (43 native text-run link records), the exact
flagged operation and finding, provider coverage, and complete circuit coverage.
The Google PDF was reviewed visually, including the final scenario sheet.
Independent Python/Arial metrics checked 100 blueprint labels without overflow.

Replay artifacts:
`outputs/capability-estate/request-capability-from-objective-binding-review-final`.
Native update, readback, PDF render and link verification:
`outputs/google-slides/binding-serviceability`.

### Invocation gates remain inspectable after a provider binding is repaired

The [current scenario circuit, slide 02](https://docs.google.com/presentation/d/1caPFtKAcf7FBLAgEacq4QXIpgTdBKBiclaZ10EF36io/edit?slide=id.p2#slide=id.p2)
was regenerated from live estate authority on September 28, 2026. It contains
27 slides and **2 errors / 3 warnings**. Both new errors attach to the existing
model operation, numbered **03** in the deck (database ordinal **2**):

- `INVOCATION_CONDITION_PATH_ABSENT`: the gate requires
  `payload.resolutionStatus = EMBODIMENT_AUTHORIZED`, but the immediately
  preceding transformation emits no `payload` field.
- `INVOCATION_REQUEST_PATH_ABSENT`: `currentInvocationRequest` is also absent
  from that output. Correcting the gate alone would leave this request-selector
  defect. It is identified as conditional on the gate opening.

Slide 02 outlines the affected operation and Event in red, names both missing
paths, and links the operation to **Invocation gate inspection**, slide 12.
The detail page retains the equality, false behavior (`preserve-carrier`),
request/result selectors and source evidence. The complete execution circuit,
provider ownership and review slides retain the same operation references.
The repaired operation 06 remains connected to
`sda-declared-read-graph-provider.v1` with no missing-association finding.

The reader now retains redacted invocation conditions and closed object shapes
from transformation declarations. The inspection is capability-neutral: no
capability, scenario, port or provider names are encoded in the rules. Missing
paths are proven only from an **immediately preceding, unconditional,
unmapped, whole-value object transformation**. It does not infer absence through
SQL, provider results, nested calls, conditional predecessors or opaque
expressions. Unsupported paths and shapes remain unknown. Null equality is
not mistaken for an unsatisfied non-null gate. Literal values are not retained
in result shapes; condition values outside safe enum/scalar display are withheld.

Snapshots captured before the added evidence fields now carry
`INVOCATION_CONDITION_EVIDENCE_NOT_RETAINED` and must be refreshed before this
inspection can assess them. Neither a provider identity nor a clean binding
association check establishes that its invocation gate can open. Static
findings remain separate from execution testimony: this deck is unobserved.

Live base-table evidence and the finding-code mapping migration are documented
in [`sfx-embody/sql/inspect/binding-serviceability`](../../sfx-embody/sql/inspect/binding-serviceability/README.md).
The installed CLI still returns `agent-route.v1`, `REFUSED`, with a null
proposal. This change exposes the configuration defects; it does not repair
or bypass them. Both codes map to the existing configuration writer with no
replacement default. The three existing estate-wide evidence warnings remain.

The unchanged generation command remains sufficient:

```powershell
node capability-deck.mjs --capability-id request-capability-from-objective --view capability --context-altitude 7 --output outputs/capability-estate/request-capability-from-objective-invocation-inspection --pptx
```

All **171 tests passed**. PowerPoint package/layout/font-policy and artifact
import checks passed. Python/Arial metrics checked 102 blueprint labels without
overflow. All 27 Google PDF pages were visually reviewed, with the scenario,
gate and review pages also inspected at full size. Native readback verified
all **45 expected link destinations** (52 linked text runs), six operations,
six bindings, two provider associations, and unchanged source node identities
and 33 edges relative to the repaired circuit. The native checker reported one
advisory for a 9-point technical path annotation on the dense inspection sheet;
it is readable at full size and has no clipping.

Snapshot digest:
`67236f90773068671d7f0e51d7fef87b85b5dc12486bcb4f3dff8eb4b803d9b5`.
Content digest:
`1e7a882d4997005f2f8c19f02e4dd358eb9d196692f6a62cdef424b93d22f780`.
PowerPoint SHA-256:
`5e12839acbd350c9c745a96b36bc98752b3d27b55b63266f310a61d881717a2c`.

Replay artifacts:
`outputs/capability-estate/request-capability-from-objective-invocation-inspection`.
Native readback, PDF renders and link verification:
`outputs/google-slides/invocation-inspection`.

### Inspection audit after the outer model selectors were aligned

A later live read on September 28, 2026 found a new selected model binding:
port version **4502**, definition **212726**, with `requestPath=modelRequest`
and no invocation condition. The earlier 27-slide deck remains a snapshot of
the previous configuration. A fresh review of current authority reports
**0 errors / 3 warnings**, despite an installed runtime failure before Gemini
inference dispatch:

```text
CELL_EXECUTION_FAILED
PROJECTED_CAPABILITY_INVOCATION_FAILED:
PROJECTED_CAPABILITY_REQUEST_PATH_MISSING: 'payload.attemptPlan'
```

The pinned `execute-governed-model-invocation` application starts with
`port:model-invocation-execution-port`, which selects `payload.attemptPlan`.
The supplied `modelRequest` is a closed object with no `payload` field. This
failure is inside parent operation **03**, before reaching its declared
inference provider. The inspection must keep provider association and observed
dispatch separate.

Three current limits are now demonstrated:

- **Nested request compatibility is not inspected.** The normalizer retains a
  digest for the outer configuration but not the embedded execution plan's
  request boundaries. The path inspector also currently starts only at guarded
  outer bindings. It misses the unguarded nested first operation.
- **Display failure coverage is not inspected.** The retained CLI selector
  `outcome.payload` renders `null` for this failure, hiding the code/message that
  `--json` exposes. Retaining the selector is not validating its coverage.
- **Process success is not execution success.** Both CLI modes exit zero in
  this case. The failure body must remain the decisive evidence; a successful
  process exit cannot clear an inspection finding.

The exact base-table reads and installed-mode comparison are recorded in
[`02-nested-invocation-evidence.sql`](../../sfx-embody/sql/inspect/binding-serviceability/02-nested-invocation-evidence.sql)
and its [inspection notes](../../sfx-embody/sql/inspect/binding-serviceability/README.md).
The next detection work must expose the nested request boundary on the parent
scenario operation, with a drilldown to the pinned operation, without adding
invented circuit nodes or claiming a Gemini exchange occurred. This audit
records the gap; it does not yet implement that rule or change the deck.

Fresh audit snapshot:
`7ea547ef4934a5a3366116de7b4a9f0baff439a43dc8fd5d55b6a1b62b9c4691`.
Local audit outputs: `outputs/null-inspection-snapshot.json` and
`outputs/null-inspection-review.json`.

### Nested-boundary and display-counterexample detection implemented

The [regenerated scenario circuit, slide 02](https://docs.google.com/presentation/d/12tihSZrRIRYWmVdfWEhoBaL4fr4AqS-TmKxAUNhLltY/edit?slide=id.p2#slide=id.p2)
now reports **2 errors / 3 warnings** from a fresh live snapshot. It supersedes
the zero-error audit above. The 28-slide deck exposes both failures on its main
inspection surface, without changing the declared circuit:

- **R04 / NESTED_INVOCATION_REQUEST_PATH_ABSENT:** operation 03 has a red outline
  and marker. The main sheet names `payload.attemptPlan` as absent. Clicking the
  operation opens slide 12, identifying parent request `modelRequest`, pinned
  application `execute-governed-model-invocation`, nested operation
  `execute-governed-model-invocation.operation.1`, required selector and supplied
  fields. The missing entry handoff prevents downstream inference dispatch.
- **R05 / CLI_DISPLAY_SELECTOR_NOT_TOTAL:** the Outcome boundary has a red
  outline and an inspection link to slide 13. The main sheet names
  `outcome.payload` as capable of hiding details. The selected outcome schema
  is exactly `{"type":"object","additionalProperties":true}`; the permitted
  counterexample `{}` has no `payload`. The selector is therefore not defined
  for every permitted outcome.

These are bounded static checks with retained proof records, not a claim of
complete circuit verification. R04 records the closed object shape, nested
entry address, expression digest, pinned plan digest and conditional status.
It checks only the first nested port handoff, before any nested mutation.
Remaining nested operations are explicitly unverified. Unknown supplied
shapes, reference-only applications, ambiguous roots, unsupported first
operations and selectors produce `NESTED_INVOCATION_INPUT_UNVERIFIED`.
Unguarded outer request selectors are now checked too.

R05 retains the schema/interface digests, witness, witness-admission rule and
null selected value. Its schema proof accepts only a conservative supported
keyword subset; references and compositions remain outside that proof.
Declared display transformations take precedence over a selector and suppress
this selector-only check. Neither static check fabricates provider testimony.
The observation boundary remains **Unobserved**. The CLI's previously observed
zero exit status is not relabeled as successful circuit execution.

Snapshots without the added boundary evidence receive
`BOUNDARY_INSPECTION_EVIDENCE_NOT_RETAINED`. Finding overlays are selected by
operation/outcome references, rather than a closed list of operation finding
codes. The existing operation 06 provider association remains intact.

Regeneration still uses the capability-ID entry point:

```powershell
node capability-deck.mjs --capability-id request-capability-from-objective --view capability --context-altitude 7 --output outputs/capability-estate/request-capability-from-objective-boundary-inspection --pptx
```

Validation: **178 tests passed**, including missing-path counterexamples,
compatible repairs, unchanged topology, stale evidence, unknown nested plans,
guards, redaction, display precedence, and main-sheet links. PowerPoint package,
geometry, font-policy and artifact-import checks passed. Python/Arial metrics
checked 104 blueprint labels without overflow. All 28 native Google PDF pages
were reviewed, with slides 02, 12 and 13 also inspected at full size. All
45 expected navigation destinations were verified (52 linked text runs).
Native checking retained one advisory for the existing 9-point technical
annotation style; no clipping was found.

Python `jsonschema` 4.23.0 independently checked the selected outcome schema
and validated the `{}` counterexample with its Draft 2020-12 validator.
Receipt: `outputs/boundary-schema-verification.json`.

The six operations, six bindings, two provider associations, 33 source node
identities and 33 edges match the preceding circuit. The reader adds inspection
evidence and diagnostics; it does not manufacture architectural cells.

Snapshot digest:
`c288090f19cbde6c876a3bcba91abae616b1b3cbd56016cfba251fa0fd41573e`.
Content digest:
`1d27b529890116b167597e64bad2cd5f87b6b3f167464c3b94cba1ea9054e00e`.
PowerPoint SHA-256:
`596c7fa752b7df9dd96d18c6e59f37904e6294240886cffec8ba673664d66658`.
Replay artifacts: `outputs/capability-estate/request-capability-from-objective-boundary-inspection`.
Native readback, render and link receipts: `outputs/google-slides/boundary-inspection`.

The estate repair-map registration passed its rollback/preflight/install cycle.
It adds a CLI declaration repair and explicit `NONE` dispositions for missing
inspection evidence, while preserving the existing nested-contract next unit.
Installed CLI verification still returned the missing `payload.attemptPlan`
error in JSON and `null` in human mode. Regeneration after map installation
produced the identical content digest above. This change makes the defects
inspectable; it does not repair the capability's runtime configuration.
