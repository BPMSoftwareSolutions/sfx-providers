# PowerPoint to native Google Slides

`presentation.to-google-slides` extends the existing hand-authored
`sfx-circuit-presentation` provider. It converts a prepared PPTX into a new,
editable Google Slides deck, reads the result back, and retains a local receipt.
This is an explicit Google Drive write. The provider remains **not declared** in
the estate and its request/output contracts remain **PROPOSED**.

The complete path is now:

`capability ID + semantic view + eleven-altitude context → presentation source → PPTX → native Google Slides → verification receipt`

Conversion preserves the supplied deck's content. It does not reconcile estate
evidence, rewrite Gherkin intent, invoke the capability, or establish admission.

## Prepare once

Use Node.js 20 or newer. No PowerPoint installation or presentation-generation
runtime is needed to migrate an existing PPTX.

```powershell
node google-slides-migrate.mjs prepare --input 'outputs/presentations/capability-estate/SDA_CLI_Invoke_Gherkin_Context_v2.pptx' --output outputs/google-slides/my-capability --folder-id GOOGLE_DRIVE_FOLDER_ID --title 'Capability engineering context'
```

The output directory must be new. Preparation copies the PPTX to `source.pptx`,
hashes it, and writes `job.json` with the provider request, a unique idempotency
key, slide order, source text, speaker notes, links and picture counts. Input is
bounded to 50 MiB and 256 slides; ZIP64/encrypted archives are unsupported.
Every execution re-reads and hashes the staged source before uploading.

Keep the job directory to reuse its receipt. Preparing another directory creates
another migration job, even when its source bytes are identical.

## Run with the connected Google Drive plugin

The retained [Codex runner](../examples/google-slides-migration/codex-run.js)
executes in `functions.exec`. Set its repository and prepared-job paths, then run
it using the connected Google Drive tools. Its
[host adapter](../src/google-slides-migration/codex-host.mjs) uses native import,
metadata, and presentation readback operations. Local journal operations run
through the CLI; credentials remain with the connector.

The native import uses `upload_mode: native_google_slides`. Merely storing a PPTX
on Drive is not considered a successful migration. The destination folder must
already exist and be writable; use the user's selected folder or the connected
account's `ChatGPT` folder. The tool creates a new deck and does not overwrite an
existing announcement presentation or alter sharing permissions.

## Run unattended from an authenticated application

```powershell
node google-slides-migrate.mjs run --job outputs/google-slides/my-capability --host src/google-slides-migration/rest-host.mjs
```

The supplied REST host reads an explicitly provisioned `SFX_GOOGLE_ACCESS_TOKEN`.
Supply it through the application's secret mechanism, not a command-line literal
or committed file. The application owns OAuth consent, Drive/Slides API access,
folder permissions and token refresh. No login credentials are discovered by the
provider. The REST adapter was transport-tested; live conversion was validated
with the connected Google Drive adapter.

Alternatively, pass a trusted host module exporting `createDrive()`. It may wrap
`createDrive({getAccessToken})` from the REST adapter with the application's
existing token-refresh function. This supports automated generation followed by
migration without hard-coding a particular credential estate.

The REST host uses Google's resumable upload protocol and requests the native
Slides MIME type. See Google's [upload and conversion documentation](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

## Provider boundary

The provider accepts a compact request with `contractId`, `artifactId`, `sha256`,
`title`, `parentFolderId`, and `idempotencyKey`. Preparation produces this request;
callers do not submit local file paths, executable module paths or credentials.
The proposed schemas are in
[contracts/google-slides-migration](../contracts/google-slides-migration/).

`migrateToGoogleSlides(request, {resolveArtifact, drive, journal})` is exported by
[providers/circuit-presentation.mjs](../providers/circuit-presentation.mjs).

* `resolveArtifact(id)` returns an approved source file and freshly checked PPTX
  manifest. The host owns artifact authorization and source immutability.
* `drive` implements `getMetadata(id)`, `getPresentation(id)`, and
  `importPresentation(args)`. The standalone adapter returns raw Google API
  fields; the connector adapter normalizes its tool responses to those fields.
* `journal` supplies exclusive `withLock(key, callback)`, `read(key)` and durable
  `write(key, state)` operations. The supplied file journal has one receipt and
  lock per prepared job directory.

The HTTPS endpoint is `/circuit-presentation/presentation.to-google-slides`.
Its default binding returns `HELD / SLIDES_HOST_REQUIRED`. A host can supply the
third `createCircuitRequestHandler` argument with a migration API whose `handle`
injects the approved resolver, authenticated Drive adapter and journal. The
public request cannot choose those dependencies. The CLI and Codex runner are
ready-to-use configured hosts; the generic HTTPS service is not an open upload
proxy.

## Verification and recovery

`receipt.json` records the source SHA-256, request identity, observed Google file
ID and URL, native MIME, and verification findings. The workflow checks native
MIME, destination folder, presentation ID, slide count, editable text, speaker
notes, external hyperlinks and minimum picture counts.

* `MIGRATED`: these structural checks passed.
* `NEEDS_REVIEW`: a native result exists, but content checks found differences.
* `HELD`: validation, authentication, host configuration or a migration operation
  did not complete. Stable finding codes accompany the result.

Replaying a job reuses its observed file ID and performs fresh readback; it does
not upload again. A changed request cannot reuse the same receipt. The source
hash is also checked on replay. Preserve the staged source and receipt together.

Before an upload, the journal durably records `upload-started`. A lost or invalid
create response becomes `outcome-unknown`, and ordinary retries refuse another
create. If an operator identifies the resulting file from the original response
or Drive, resume with the observed ID:

```powershell
node google-slides-migrate.mjs run --job outputs/google-slides/my-capability --host src/google-slides-migration/rest-host.mjs --reconcile-file-id OBSERVED_GOOGLE_FILE_ID
```

For the Codex runner, add `reconcileFileId: observedId` to the host options passed
to `handle`. Reconciliation checks the ID, native MIME, title, destination and
slide count, then performs normal content verification. This is operator-led
recovery, not an automatic title match or a proof of remote creation identity.

An interrupted process may leave `migration.lock`. Inspect its receipt and
confirm no worker is active before removing only that lock. Keep the receipt.
Never clear an uncertain receipt to force another upload. A local journal does
not provide distributed exactly-once creation: Google does not support
pre-generated IDs for these [Workspace conversions](https://developers.google.com/workspace/drive/api/guides/create-file).

## Visual QA

Structural checks cannot prove visual equivalence, animation behavior, font
substitution, chart editability or every embedded-object feature. The receipt
deliberately reports `visualReview: not-performed`; an actual visual review is a
separate artifact, not a claim inferred from a successful upload.

After migration, export the native Google deck once as PDF, render all pages
using Poppler, and inspect them. Keep the exported PDF, native readback and
review alongside the receipt. Optional Pillow contact sheets:

```powershell
pdftoppm -png -r 80 google-render.pdf renders/slide
python scripts/google-slides-contact-sheet.py renders
```

The September 26 validation converted the 32-slide SDA CLI context deck. All
structural checks passed; every Google-rendered slide was visually inspected,
including branches, junctions, bindings and evidence gaps. The Google Slides
issue checker reported zero issues. Generated job data and renders remain under
ignored `outputs/`; provider code, schemas, runner, tests and this guide are
version-controlled.
