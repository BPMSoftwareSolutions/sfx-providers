# Hand-authored audio-to-text provider

`providers/audio-to-text.mjs` implements `sfx-audio-to-text` / `audio.transcribe`.
It runs [faster-whisper](https://github.com/SYSTRAN/faster-whisper) in a local Python
worker, returns real speech recognition results, and exposes both a CLI and a
loopback HTTPS route. It is hand-authored and **not declared in sfx-embody**.

The user requested this provider on 2026-09-26, with estate migration deferred.
It sits outside the closed eleven-provider authoring-altitude bridge. The bridge's
baseline, admitted surface, and retirement conditions remain scoped to those eleven
altitudes; this module has no altitude and claims no estate admission.

## Setup and run

From the repository root, with Python 3.10+ (3.12 tested) and Node 20+:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-audio.txt

node .\transcribe.mjs 'C:\audio\interview.mp3' --language en
# Optional: --output-dir 'C:\transcripts\interview' (must be a new directory)
```

The CLI prints progress on stderr and output locations on stdout. It writes a new
directory under `outputs/audio/` by default, containing:

| File | Content |
| --- | --- |
| `transcript.txt` | UTF-8 transcript, one recognized segment per line |
| `transcript.srt` | Numbered subtitle cues with timestamps |
| `transcription.json` | Complete response, including text, segments, source SHA-256, model settings, and elapsed time |

An existing output directory is refused before inference; previous transcripts are
never overwritten. A failed or cancelled transcription returns a nonzero exit code
and creates no transcript directory. Models, the Python environment, and output
artifacts are ignored by Git. The input audio is opened read-only.

The default model is multilingual `small`, using `cpu` / `int8` with eight threads.
Weights download from Hugging Face on first use into `.cache/audio-models`; audio
and transcripts are not uploaded. After weights are cached, set `AUDIO_OFFLINE=1`
to require an entirely offline model load. The pinned Python package is
`faster-whisper==1.2.1`; transitive dependencies are resolved by pip.

## HTTPS invocation

The existing `node runner.mjs` serves this provider alongside the eleven altitude
providers on `127.0.0.1:8790` using the existing localhost certificate. Run
`setup-cert.ps1` first if that certificate has not been created on the machine.

```powershell
node .\runner.mjs
# In another terminal:
Invoke-RestMethod 'https://localhost:8790/audio-to-text/health'
$body = @{
  contractId = 'audio-transcription-request.v1'
  audioPath = 'C:\audio\interview.mp3'
  language = 'en'
} | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri 'https://localhost:8790/audio-to-text/audio.transcribe' `
  -ContentType 'application/json' -Body $body -TimeoutSec 3600
```

Requests reference a file on the provider's machine. They do not contain audio bytes,
shell commands, model options, or output paths. This is a trusted local service:
local callers can request audio files readable by its process account. It has no
remote authentication or multi-user isolation. HTTP invocation returns the result
and does not write transcript artifacts; the CLI owns artifact export.

`GET /health` reports twelve providers, `altitudeProviderCount: 11`, and the separate
`handAuthoredProviders` list. `GET /audio-to-text/health` is **liveness only**:
`modelReadiness: "not-probed"` does not claim Python or model availability. It never
starts inference or downloads a model. Existing altitude endpoints keep their own
contracts and optional Gemini behavior. The audio route calls only its local worker.

## Local contracts

Both IDs are **PROPOSED local contracts**, exported with JSON schemas by the module;
they are not installed estate contracts.

`audio-transcription-request.v1` accepts only `contractId`, an absolute `audioPath`,
and optional `language` (a lowercase Whisper language code, for example `en`).
Omit language for detection. MP3, WAV, M4A, FLAC, OGG, Opus, AAC, MP4 and WebM file
extensions are accepted; the local decoder must also recognize the file contents.
Requests are capped at 16 KiB and input files at 1 GiB, and must be nonempty regular
files. Compressed file size does not predict decoded memory or runtime; long files
can still exhaust resources or reach the timeout.

The provider exports `handle(input, options)` and returns this envelope:

```json
{
  "providerId": "sfx-audio-to-text",
  "toolId": "audio.transcribe",
  "disposition": "AUTHORED",
  "providerExecution": "local-model",
  "elapsedMs": 1234,
  "requestBytes": 120,
  "shapeConforms": true,
  "candidate": {
    "contractId": "audio-transcription-output.v1",
    "text": "Hello.",
    "segments": [{ "id": 0, "startSeconds": 0, "endSeconds": 1, "text": "Hello." }],
    "language": "en",
    "languageProbability": 1,
    "durationSeconds": 1,
    "source": { "path": "C:\\audio\\interview.mp3", "bytes": 12345, "sha256": "<64 lowercase hex characters>" },
    "model": {
      "engine": "faster-whisper", "version": "1.2.1", "name": "small",
      "device": "cpu", "computeType": "int8", "cpuThreads": 8,
      "beamSize": 5, "temperature": 0, "vadFilter": true
    }
  },
  "findings": []
}
```

`AUTHORED` uses the repository's existing success convention; the result is neither
a stub nor an estate receipt. Nested output fields and timestamp ordering are
validated before `shapeConforms` is set. `HELD` always has `candidate: null` and
structured findings. `providerExecution: "none"` means no worker was attempted;
`"local-model"` means the local worker was attempted (check the disposition for success).

HTTP statuses: 200 on success, 400 for malformed JSON, 405 for wrong method, 413 for
oversized bodies, 415 for wrong content type, 422 for input/model/worker failures,
429 while another job is running, and 504 on worker timeout. There is one active
transcription per Node process, no job queue, and no retry loop. Each call starts
and loads its own Python worker; CLI processes and server processes have separate
concurrency limits. A client disconnect or CLI interrupt cancels the worker.

The provider transcribes in the source language. It does not summarize, identify
speakers, or translate. Timestamps and words are model estimates; spelling of names
and technical terms can be wrong. Empty speech yields an empty transcript. Speech
recognition is not claimed to be byte-for-byte deterministic across engine versions
or devices, even with temperature zero.

## Operator configuration

These are process environment settings, not caller-supplied request members.

| Variable | Default | Meaning |
| --- | --- | --- |
| `AUDIO_PYTHON` | Repo `.venv` Python executable | Path to a Python executable; no command-line arguments |
| `AUDIO_MODEL` | `small` | faster-whisper model name or local CTranslate2 model directory |
| `AUDIO_DEVICE` | `cpu` | Engine device, for example `cpu` or `cuda` |
| `AUDIO_COMPUTE_TYPE` | `int8` | Engine precision; GPU setups require compatible libraries |
| `AUDIO_CPU_THREADS` | `8` | Positive integer, at most 256 |
| `AUDIO_MODEL_CACHE` | Repo `.cache/audio-models` | Download/cache directory |
| `AUDIO_OFFLINE` | unset | `1` requires cached/local weights |
| `AUDIO_TIMEOUT_MS` | `3600000` | Worker deadline, including model download/load; at most 24 hours |

## Verification and migration

Run `node --test tests` (also exposed as `npm test`). Tests exercise request and
file validation, worker startup/failure/timeout/cancellation, concurrency recovery,
full output validation, HTTP dispatch and limits, and SRT formatting. They use fake
inference results and require no model download. A real CLI/HTTPS transcription is
the separate integration check for the Python engine and audio decoder.

Verified on 2026-09-26:

- `node --test tests`: 64 tests passed, including all 55 existing altitude checks.
  The machine's npm launcher was missing its npm modules, so verification used Node
  directly; npm was not repaired as part of this provider change.
- Real HTTPS invocation of a four-second excerpt: HTTP 200, `AUTHORED`, and
  `shapeConforms: true`, with `AUDIO_OFFLINE=1`. Service and altitude health also passed.
- The supplied Anderson Cooper / Jensen Huang MP3: 30,505,795 bytes, 762.645 seconds,
  160 segments and 2,198 recognized words. Local `small` / CPU / int8 processing took
  441,256 ms, including initial model acquisition/loading.
- Source SHA-256:
  `e73bf0cac9d3d16487f63229cb4c07a1bcba1eda58c9fb903d8184e413b6176d`.
  The exported TXT and SRT matched the validated JSON candidate. Outputs and the
  verification record are in the ignored directory
  `outputs/audio/jensen-huang-interview/`. This is execution and artifact validation,
  not a measured word-error-rate evaluation or a manually corrected transcript.

For the later sfx-embody migration:

1. Admit the input/output contracts and select the owning capability and outcome.
2. Declare the `audio.transcribe` provider interaction against this HTTPS endpoint
   using the estate's then-current provider-binding workflow; choose a timeout and
   response limit that fit observed audio workloads (the local worker cap is 16 MiB).
3. Define how callers obtain provider-local file references. Arbitrary caller-machine
   paths are not portable across an estate deployment.
4. Prove the declared invocation, error mappings, source digest, result shape, and
   required lane evidence with a small audio fixture and the reference recording.
5. Cut consumers over after proof. Keep or retire this executable implementation
   according to the declared execution boundary; binding declaration alone does not
   move speech inference into estate authority.

No bindings, estate rows, capabilities, or admission receipts are installed by this
implementation. Those steps remain future work.
