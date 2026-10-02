# Mock execution harness (Route A)

Test-only tooling: executes a declared capability through the Node kernel
ground with **hand-authored mock providers and fixtures** in place of the
physical providers. It reads the live estate rows exactly as production does
(via the SDA bootstrap's pinned read session), writes nothing to the database,
and changes no declared meaning. It exists to exercise the real declared
circuit deterministically so semantic-authority issues surface without live
network flakiness.

## Why here

`sfx-providers` already hosts hand-authored providers (`providers/`) and local
HTTPS fixtures (`server.mjs`, `certs/`, `demo`-style dispatch pairs). This
harness follows the same spirit at the execution boundary: it supplies a
fixture-backed `fetch` (the physical HTTP exchange seam) and an optional
fixture-backed read query (the declared-read provider), then runs the real
graph. It is capability-neutral: the capability id, input and fixture are all
arguments; nothing about a specific capability is encoded.

## Usage

```
node mock/run-mock-execution.mjs \
  --capability-id request-capability-from-objective \
  --input C:\lab\repos\sfx-embody\evidence\binding-serviceability\input.json \
  --fixture gemini-success
```

Options:

| Option | Meaning |
| --- | --- |
| `--capability-id ID` | required; the declared capability to invoke |
| `--input FILE` | required; JSON input document (or string) |
| `--fixture NAME_OR_PATH` | fixture under `mock/fixtures/` (default `gemini-success`) |
| `--sda-root PATH` | SDA checkout (default `../scenario-driven-architecture`, or `SFX_SDA_ROOT`) |
| `--output DIR` | run evidence directory (default `mock/runs`) |
| `--allow-live-fetch` | unmatched HTTP calls pass through (default: fail closed) |

The run writes the full execution result to `<output>/<fixture>-<utc>.json` and
prints a compact summary plus `OK`/`FAILED`.

## Fixtures

A fixture is a capability-neutral responder document:

```json
{
  "id": "gemini-success",
  "fetch": [ { "match": "generativelanguage.googleapis.com", "status": 200, "body": { ... } } ],
  "read":  [ { "match": "AS graph_source", "resultColumn": "graph_source", "value": { ... } } ],
  "expect": { "disposition": "completed", "outcomeContains": ["mockPrice"], "mockHits": { "fetch": 1 } }
}
```

* `fetch.match` matches the request URL; unmatched calls throw
  `MOCK_FETCH_UNMATCHED` unless `--allow-live-fetch`.
* `fetch.body` may be an object (JSON) or a string (raw text, for malformed
  responses); `status` and `headers` are optional.
* `read.match` matches SQL statement text passed to the session query runner;
  the canned row is returned under `resultColumn` (default `value`) in the
  session's result shape, so the declared-read provider JSON-parses it exactly
  as it would a real row.
* `expect` is the pass condition: terminal disposition, substrings in the
  serialized result, and minimum mock hit counts.

## First findings (2026-09-28, `request-capability-from-objective`)

The four shipped fixtures all pass and produced these observations:

* **Success fixture** (`gemini-success`): the mocked Gemini proposal
  (`resolve-equity-market-price-evidence` / `AVGO`) drives the circuit to the
  ADMITTED path and the delivered outcome is exactly the canned declared-read
  result (`mockPrice`), proving both mocked seams are consumed end to end
  (1 fetch, 1 read, 321 testimonies).
* **Fault fixtures classify cleanly** (`gemini-rate-limit` 429,
  `gemini-unavailable` 503): the lane reports `PROVIDER_UNAVAILABLE` and the
  route decides `REFUSED`; the invoke operation (and therefore the declared
  read) is skipped on the refusal path (read hits 0). The declared variants and
  routing hold under injected provider faults.
* **Finding — malformed structured response is unclassified**
  (`gemini-malformed`): a 200 response whose `parts[].text` is not the declared
  JSON shape fails the `propose` cell opaquely
  (`CELL_EXECUTION_FAILED: PROJECTED_CAPABILITY_INVOCATION_FAILED: … failed`)
  instead of classifying the declared `RESPONSE_FORMAT_NOT_SATISFIED`
  disposition, and the nested cause is not re-emitted. Candidate follow-up:
  classify malformed structured responses at the lane boundary, and re-emit
  nested failure detail so the parent circuit illuminates where it failed.

## Boundary (honesty)

* The declared circuit, contracts, transformations, nested handoff, routing and
  display projection are all real; only the physical seams are fixture-backed.
* This is the Node kernel ground (`invokeDeclaredCapabilityInSession`), not the
  installed `KernelEntry.exe`; provider realization is not selected
  per-invocation on the installed path (see
  `sfx-embody/docs/executable-verification-readiness.md`, EV-1.3/EV-2.1).
* Credential binding, vault realization and database access still run for
  real; only HTTP response bytes and declared-read rows are mocked.
* Passing here proves the circuit is executable against the fixture conditions
  it exercised; it is not provider integration evidence.
