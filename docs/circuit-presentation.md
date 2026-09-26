# Circuit-presentation provider

For database-driven decks from any selected capability, see
[Capability presentations](capability-presentation.md). The additional
`presentation.from-capability` tool combines a semantic circuit view with all
eleven authoring context layers.

For an existing PowerPoint deck, use the additional
[`presentation.to-google-slides` operation](google-slides-migration.md) to create
a native Google deck with a durable receipt and content readback.

`sfx-circuit-presentation` is the hand-authored provider behind the reusable
diagram design extracted from the SideFX announcement. Its tool is
`presentation.compile`. It compiles a JSON drawing description or the retained
29-slide preset into editable Google Slides requests, SVG previews and speaker
notes. The CLI can also export an editable PowerPoint deck.

This provider is not yet declared in the sfx-embody estate. Both contract IDs
are **PROPOSED**. The eleven-altitude bridge remains a separate, closed surface;
adding this user-requested provider does not admit a new altitude or install an
estate binding.

## Run a retained or custom deck

Node.js 20 or newer is sufficient for JSON, SVG and HTTPS compilation. No model,
network call, global package installation or Codex installation is needed.

```powershell
# Reproduce the final 29-slide design, including the Google Slides repairs.
node circuit-deck.mjs --preset sidefx-announcement --output outputs/announcement-replay

# Author a new circuit from the editable JSON example.
node circuit-deck.mjs --input examples/circuit-presentation/branching-provider.request.json --output outputs/new-circuit

# npm entry point is equivalent.
npm run circuit-deck -- --preset sidefx-announcement --output outputs/another-replay
```

The output directory must not already exist. The CLI emits `presentation.json`,
`google-batch.json`, `speaker-notes.json`, the input request, a digest receipt and
one SVG per slide. Generated files stay under ignored `outputs/` in these examples;
the provider, examples, schemas and retained source are tracked.

For optional PowerPoint export, supply an installed `@oai/artifact-tool` package,
or point `CIRCUIT_ARTIFACT_MODULE` at its absolute `dist/artifact_tool.mjs` path.
This is a private optional runtime, not a public npm dependency; it is not bundled
in this repository. In Codex, use the path returned by its workspace dependency
loader. The retained implementation was exercised with version **2.8.59**.

```powershell
$env:CIRCUIT_ARTIFACT_MODULE = 'C:\path\to\node_modules\@oai\artifact-tool\dist\artifact_tool.mjs'
node circuit-deck.mjs --preset sidefx-announcement --output outputs/announcement-pptx --pptx
```

PowerPoint output retains shapes, text, wires, links and notes. SVG is a local
preview with explicit newlines; browser, Google and PowerPoint font metrics can
differ. Compilation checks data and geometry, not text fit or factual accuracy.
Inspect rendered slides before publishing new designs. A missing PPTX runtime
returns a nonzero CLI exit; already emitted JSON/SVG artifacts remain usable.

## Provider contract

```json
{
  "contractId": "circuit-presentation-request.v1",
  "objectPrefix": "my_circuit",
  "preset": "sidefx-announcement"
}
```

Supply exactly one of `preset` or `deck`. For a custom `deck`, supply `title`,
optional `sources`, and `slides`. Each slide contains a title, optional subtitle
and notes, and drawing commands `{ "op": "chip", "args": [...] }`. The full
example is [branching-provider.request.json](../examples/circuit-presentation/branching-provider.request.json).
The exported JSON Schemas are in [contracts/circuit-presentation](../contracts/circuit-presentation/).

Coordinates and font sizes are points on a **960 × 540** canvas. The drawing
library also exports `Slide` and palette `C` for trusted JavaScript callers from
`src/circuit-presentation/design.mjs`. JSON input cannot invoke arbitrary JS or
provide file paths, module names, raw Google requests or script expressions.

| Command | Positional arguments (optional arguments follow required ones) |
| --- | --- |
| `chip` | x, y, width, height, label, color, {size, sub, pins} |
| `route` | [[x,y], ...], color, {width, dash, arrow, glow} |
| `gate` | x, y, label, color, radius |
| `socket` | x, y, {color, label, height} |
| `terminal` | x, y, label, color, {sub, radius as r, size} |
| `junction`, `port` | x, y, color, radius |
| `stop` | x, y, color |
| `region` | x, y, width, height, label, color |
| `t` | text, x, y, width, height, font size, color, bold, alignment, link |
| `label` | text, x, y, width, color, font size |
| `line` | x1, y1, x2, y2, color, width, {dash, alpha, arrow} |
| `shape` | shape type, x, y, width, height, {fill, stroke, sw, alpha, sa} |
| `legend` | [[label,color], ...], y |
| `foot`, `source` | text; or [source IDs], respectively |

Use orthogonal route segments for circuit wiring. Crossing wires are not implicit
junctions: add `junction` explicitly where the connection has meaning. Geometry
is supplied by the author; this is not an automatic graph layout engine.

| Signal | Color |
| --- | --- |
| Inference | `#45A7FF` |
| Authority | `#F6B94D` |
| Admission | `#A98AF2` |
| Effect | `#4DE0B0` |
| Refusal | `#FF5F70` |
| Evidence | `#A8B8CA` |

The provider returns `{ providerId, toolId, disposition, candidate, findings }`.
`AUTHORED` includes a `circuit-presentation-output.v1` candidate and
`shapeConforms: true`. Invalid requests return `HELD` and `candidate: null`.
The digest identifies the compiled content, not a proof of its claims. Limits:
512 KiB request, 64 slides, 500 commands per slide, 4,000 commands per deck,
24,000 native requests and 8 MiB compiled output.

## HTTPS

The normal `node runner.mjs` service registers this provider alongside the
existing providers using the same localhost TLS certificate.

* `GET /circuit-presentation/health` reports metadata and proposed contracts.
* `POST /circuit-presentation/presentation.compile` accepts JSON and returns the
  compiled candidate. It does not write files or publish to Google.

```powershell
Invoke-RestMethod -Method Post -Uri 'https://localhost:8790/circuit-presentation/presentation.compile' -ContentType 'application/json' -Body (Get-Content -Raw examples/circuit-presentation/branching-provider.request.json)
```

## Google Slides delivery

The batch creates new native slides. It never deletes a target's existing slides,
changes sharing, uploads anything or carries the original deck's object IDs.
The caller owns authenticated delivery and must verify the target's page size is
960 × 540 points before applying it. A different page size requires scaling or
importing the PowerPoint export. The provider intentionally makes no Google API
calls. Use a different `objectPrefix` for another batch in the same presentation;
replaying identical object IDs is not an idempotent Google update.

After creating slides, a delivery adapter can read the resulting
`slideProperties.notesPage.notesProperties.speakerNotesObjectId` values and write
the corresponding text from `speaker-notes.json`. Notes IDs cannot be determined
before slide creation. The PowerPoint exporter attaches notes directly.

## Retained source and reproducibility

* `examples/circuit-presentation/sidefx-announcement/provenance/` retains the five
  original diagram/build scripts, content/source JSON, design rationale, original
  per-slide requests and both Google repair batches. Its manifest records original
  script hashes. These historical scripts retain their original machine paths;
  execute the portable provider for replay.
* The historical `redesign-google-before.json` is a dependency projection of the
  original input: slide IDs, element IDs and notes. Expired media URLs and connector
  delivery metadata are omitted. Full private working files remain in `outputs/`.
* `src/circuit-presentation/presets/sidefx-announcement.json` is the portable final
  design after both repairs. Two unused text-box margins are trimmed to the canvas
  edge at compilation; visible text is unchanged.
* `scripts/verify-circuit-provenance.mjs` verifies hashes and the retained request
  sequence against the executable preset. It also checks the checked-in schemas
  against the runtime contracts.

```powershell
node scripts/verify-circuit-provenance.mjs
node --test tests/circuit-presentation.test.mjs
```

The dated announcement remains a historical example, including its evidence
limits and 15 sources. Copy or author new input for another claim or audience.
Later estate migration should declare these input/output contracts, bind the
compiler's execution seam, and retain replay and geometry fixtures. No migration,
admission or remote publication is performed by this implementation.
