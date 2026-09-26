# Redesign topology blueprints — SideFX circuits

Read-only architecture research, 26 September 2026. No live invocations performed. These are drawing specifications, not generated graph exports. Preserve the evidence labels on every drawing. The purpose is to replace box sequences with connected, inspectable circuit topology.

## A shared visual grammar

Use three visually distinct signal types throughout:
- **Solid teal directed wire — execution/data token.** Arrow label names the input, candidate outcome or selected variant traveling on it.
- **Dashed amber directed wire — declaration/configuration read.** The database supplies a contract, authority identity, routing rule, or provider binding. It does not emit model instructions directly into an actuator.
- **Fine violet dotted wire — emitted testimony.** It reaches an evidence rail, not an execution junction. Do not imply evidence collection itself authorizes effects.

Use a small diamond for an actual predicate/selection and a small filled circle only for a graphical wire junction. A filled circle must not silently mean parallel join. Place a **binding socket** (two short parallel bars with a labeled gap) at each declared provider crossing. Show request and return as separate directed wires. A model provider and a market-data provider have the same *provider* glyph but different labels and signal payloads. Keep the model visibly outside the authority store.

Lay out a real circuit in two dimensions: entry on the left, runtime cells in the center, model/provider branches above and below, outcomes on the right, declaration bus at the top, testimony rail at the bottom. Do not replace every node with an identically sized rectangle. Use contract pins, compact transformation cells, predicate diamonds, nested scenario outlines, and provider sockets.

**Evidence badges:** “Recorded lane · 18/19 Sep 2026”; “Canonical protocol · schema”; “Provider implementation · source”; “Declared historical fallback”; “Illustrative projection · evidence-backed elements.” Keep them short and visible.

## Blueprint 1 — Hero: the inference provider sits inside a declared circuit

**Purpose:** One full-slide architectural hero that makes the independent authority and actual ADMITTED/REFUSED branch visible.

**Classification:** Semantic/topological projection of the recorded `request-capability-from-objective` lane; not a literal rendering of every cell. The accepted and refused traces are separate dated runs. The lane's proved target is the market-price capability, not arbitrary universal dynamic dispatch.

**Placement**
- Top rail: database-shaped **Capability estate / declared authority**, with four outputs: input/proposal contracts; request/transform authority; route declarations; provider bindings.
- Left: user objective enters a small **Input** contract pin.
- Large center outline: **Scenario: request capability from objective**.
- Inside, upper middle: request construction and inference invocation socket. Place **Inference provider** above or below the circuit with a loop out and back; the main circuit continues only when a proposal returns.
- Middle-right diamond: **Declared route** with output pins ADMITTED and REFUSED.
- ADMITTED wire goes up/right into a nested **Market-price capability** circuit and a second provider socket.
- REFUSED wire bends down/right into **Shape refusal evidence**, ending in a distinct coral terminal.
- Two terminal pins, not a fake common success merger: **Price evidence** and **CAPABILITY_NOT_FOUND**.
- Bottom evidence rail receives the route selection and both terminal branches.

**Nodes**
| ID | Label | Kind / exact role |
|---|---|---|
| A | Declared capability estate | Authority data source |
| I | Objective | Root input pin |
| B | Build model request | Declared transformation (visible set + proposal schema) |
| M | Invoke inference | Composed governed-model capability |
| MB | Model provider binding | Provider socket |
| MP | Inference provider | Physical/provider realization |
| P | Capability + input | Proposal data token |
| R | Resolve capability identity | Declared estate read |
| D | Declared route | Selection based on declared route result |
| X | Execute admitted proposal | Selected child scenario |
| Q | Market-price capability | Nested scenario/circuit |
| QB | Market-data provider binding | Separate provider socket |
| QP | Market-data provider | Physical/provider realization |
| O | Price evidence returned | Admitted terminal business outcome |
| F | Shape refusal evidence | Selected refusal child |
| N | CAPABILITY_NOT_FOUND | Refusal evidence terminal |
| E | Execution testimony | Evidence rail, observational |

**Directed edges**
| From → To | Signal label | Style |
|---|---|---|
| I → B | typed objective | execution |
| A → B | request / visible-set / proposal authority | authority |
| B → M | governed-model request | execution |
| M → MB → MP | bounded inference invocation | execution |
| A → MB | model binding | authority |
| MP → M | structured model response | execution return |
| M → P → R | proposed capability identity + input | execution |
| A → R | selected estate definitions | authority |
| R → D | resolved proposal + declaration result | execution |
| A → D | declared route rules | authority |
| D → X | route = ADMITTED | execution / teal |
| D → F | route = REFUSED | execution / coral |
| X → Q | shaped AVGO capability request | execution |
| Q → QB → QP | bounded market-data request | execution |
| A → QB | provider binding + endpoint authority | authority |
| QP → QB → Q | native response evidence | execution return |
| Q → O | admitted price outcome | execution |
| F → N | refusal = CAPABILITY_NOT_FOUND | execution |
| D, Q, F → E | addressed cell/edge testimony | evidence |

**Essential visual truths**
- NO arrow MP → A. Model response does not write authority in this lane.
- NO arrow MP → QP. A proposal must return to declared resolution.
- NO arrow F → QB. The trade/business execution path is absent.
- If showing a ghost trade provider as the attempted destination, use an explicitly broken coral line labeled **“no declared trade path”**, not a solid runtime edge.
- Root selection is ADMITTED/REFUSED. The refusal terminal's outer outcome variant is TERMINAL; CAPABILITY_NOT_FOUND is its refusal field.
- Show two date badges near the relevant branch if highlighting both histories. Do not imply same model version or isolation configuration in both runs.

**Sources**
- `sfx-embody/docs/agent-lane.md:25–41`
- `sfx-embody/sql/migrations/declare-agent-capability.sql:158–178,212,323–343`
- `sfx-embody/sql/migrations/declare-agent-relevance-filter.sql:97–128,299` (later visible-set read)
- `build/evidence-extract.json` (exact retained dates, branch observations, counts)
- The later `admit-resolved-feature-route.commit.sql:3–20` explicitly warns that changing admission alone is not generic dynamic child dispatch; keep the hero tied to the recorded lane.

## Blueprint 2 — Event microscope: one scenario resolves into another circuit

**Purpose:** Show canonical Input/Event/Outcome as a nested graph with real rejection paths and provider crossings, rather than a three-box slogan.

**Classification:** Canonical cell execution protocol, with the event interior illustrated using source-backed transformation/provider/nested-scenario roles. The interior example is illustrative; the five-step protocol and rejection dispositions are canonical.

**Placement**
- A large rounded/open frame labeled **One scenario** has Input pin left and Outcome pin right.
- In the middle is a large event hexagon/outline labeled **Event / execution authority**, with a magnification tether to an expanded lower circuit.
- Top authority bus has three pins: input contract, execution authority, outcome contract/routes.
- Keep rejection terminals near their gates, rather than a single unexplained “security” box.

**Canonical runtime edges**
| From → To | Condition / signal |
|---|---|
| Input token → G1 Admit input | caller-supplied state |
| Input contract authority → G1 | declared contract |
| G1 → T0 Rejected | input not admitted |
| G1 → G2 Resolve event authority | admitted input |
| Execution authority identity → G2 | event.executionAuthorityId (+ version/digest where supplied) |
| G2 → T1 Resolution failure | no bound execution authority |
| G2 → G3 Execute or descend | bound authority + admitted input |
| G3 → T2 Failed | execution failure |
| G3 → G4 Admit outcome | candidate outcome |
| Outcome contract authority → G4 | declared outcome contract |
| G4 → T3 Rejected | candidate does not satisfy outcome admission |
| G4 → G5 Resolve declared route | admitted typed outcome variant |
| Route authority → G5 | declared outgoing edges |
| G5 → next scenario input | selected declared edge token |
| G5 → terminal outcome | no further declared route / terminal completion |

**Illustrative zoom inside G3**
- Entry token → **Transform** cell.
- Transform → diamond **Declared selection**.
- Upper selected branch → **Nested scenario** thumbnail containing Input/Event/Outcome.
- Lower selected branch → **Port** → binding socket → **Provider** → candidate return.
- Both branches may return to a **return-binding** node only when the depicted authority declares such a return. Label the merge **“selected branch result”**, not “parallel join.”
- Return → candidate outcome at G4.
- Use short example branch labels “variant A” / “variant B” and a visible **illustrative decomposition** label. Do not present these generic branches as the actual equity capability.

**Important details**
- Contracts are constraints on state at pins, not a substitute name for Input or Outcome.
- Event is semantically identified and refers to its execution authority. It is not synonymous with a model call.
- A physical provider's response is a *candidate* outcome until the declared result/admission path accepts it.
- Do not draw a failover route from every exception unless that route is actually declared.
- The graph schema supports selection, broadcast, join, recurrence, failure and cancellation groups; this does not mean all are exercised in every capability. For a full fan-out/fan-in visual, label it an illustrative graph using supported constructs, not the evidenced agent lane.

**Sources**
- `kernel/schemas/scenario.schema.json:5–21`
- `kernel/schemas/scenario-event.schema.json:5–13`
- `kernel/contracts/execution/scenario-kernel-execution-vector.json:7–44`
- `kernel/contracts/execution/cell-execution-protocol.v1.json:5–13`
- `kernel/schemas/semantic-execution-graph.schema.json:26–55` (decompositions, return authority, groups/policies)

## Blueprint 3 — Physical seam: the HTTP provider is a branched admission circuit

**Purpose:** Replace a checklist of endpoint/credential controls with the actual request/return/rejection topology.

**Classification:** Faithful condensation of the current Node governed HTTP provider function's control flow. These are provider implementation gates, not new canonical scenario cells or proof every provider has identical checks.

**Placement**
- Large outlined seam between **Declared circuit port** (left) and **External HTTPS provider** (right).
- A row of compact gate diamonds crosses the seam; failed edges bend down to coral outcome terminals.
- Credential/vault pin enters from above into binding check/injection, with no wire to the model.
- Return wire from the external provider loops beneath the gates to response classification, then back to the capability.
- Show exactly one outbound transport arrow. Avoid a decorative retry loop: this implementation does not automatically follow redirects or retry.

**Nodes and edges**
| From → To | Condition / signal |
|---|---|
| Circuit port → H1 Endpoint admission | request URL, method, endpoint authority digest |
| Endpoint authority → H1 | declared digest + URL prefix + methods |
| H1 → R1 rejected-endpoint | malformed URL / non-HTTPS / no matching endpoint |
| H1 → H2 Request bounds | admitted endpoint |
| H2 → R2 transport-failed | invalid request-body type / invalid timeout or response bound |
| H2 → H3 Header admission | bounded request |
| Header authority → H3 | allowed request and response header names |
| H3 → R3 rejected-credential | forbidden/invalid request header |
| H3 → R2 transport-failed | response-header request exceeds allowlist |
| H3 → H4 Consume credential binding | admitted header configuration |
| Credential binding store → H4 | opaque one-use binding |
| H4 → R3 rejected-credential | missing, expired, mismatched invocation/endpoint/rule/header |
| H4 → H5 Cancellation check | credential accepted and consumed |
| H5 → R4 cancelled | aborted before exchange |
| H5 → X One HTTPS exchange | admitted request; inject credential only here |
| X → External provider | HTTPS request; redirect = manual |
| External provider → H6 Response-size check | native response stream |
| H6 → R5 oversized-response-rejected | bytes exceed declared bound |
| H6 → H7 Status classification | bounded response |
| H7 → O1 completed | status 2xx |
| H7 → O2 transport-failed | status 3xx; redirection-limited |
| H7 → O3 retained-non-success | other HTTP status |
| X → O4 timed-out/cancelled/transport-failed | transport exception classification |
| O1/O2/O3/O4/R1…R5 → Capability outcome path | governed exchange evidence + reached stage |

**Drawing hints**
- Use a separate little counter badge at the physical arrow: **“exchangeCount = 1 after attempted transmission”**. Pre-transport rejection evidence defaults to 0; do not equate exchangeCount 1 with a remotely completed side effect.
- Token icon at H4 is visibly consumed, not copied to the model.
- Do not print actual secrets. The signal label is **opaque credential binding**.
- Draw failure outputs as data returning to the circuit, not as unexplained disappearance.
- A loopback HTTP exception exists for explicitly enabled local conformance; keep it in notes if slide space is tight. Label the main path “production HTTPS path,” not “HTTP is impossible.”

**Sources**
- `languages/typescript/runtimes/node/governed-http-exchange-provider.mjs:46–58` (one-use binding and matching)
- same file `:65–100` (endpoint/request/header/credential gates)
- same file `:103–119` (cancellation and fetch)
- same file `:124–161` (size/status/error outcomes)

## Blueprint 4 — Real business circuit: primary/fallback with guard branches

**Purpose:** A rich, truthful example containing transformations, conditional selection, two provider bindings, preserved state and outcome choice.

**Classification:** Historical declared 10-operation equity fallback, matching the architecture documented for the original quote demonstration. Later provider additions exist; do not label this the exhaustive current estate route graph. The branches below are expression/admission branches inside an ordered operation chain, not two parallel scenario executions.

**Critical rule:** The original implementation does **not** skip all fallback cells after primary success. It still evaluates fallback guard/admission nodes. The guard prevents fallback transport, and final selection preserves primary evidence.

**Layout**
- Two horizontal lanes inside one large event/circuit outline: upper **Primary route**, lower **Fallback route**.
- Primary lane has five operation cells P1–P5. A binding socket and provider sit outside the circuit above P4.
- Output of P5 bends down into a diamond inside F6 labeled **Primary resolved?**
- Yes branch carries an explicit gray **guard object** through the lower admission cells; No branch carries a teal **fallback binding request**.
- Both branches still traverse the F7 credential admission location, then F8 request constructor/guard choice, then F9 endpoint admission/exchange. Only an admitted binding/request crosses the second physical-provider socket.
- The original primary outcome is carried on a separate thin data wire to F10 final selection.
- F10 has two incoming values, not two competing authorities: carried primary and fallback exchange evidence.

**Operation IDs / displayed labels**
| Op | Display label | Declared port |
|---|---|---|
| P1 | Build primary binding request | build-equity-price-binding-request |
| P2 | Bind primary credential | bind-equity-price-provider-credential |
| P3 | Build primary exchange | build-equity-price-exchange-request |
| P4 | Primary exchange | observe-equity-price-exchange |
| P5 | Normalize primary evidence | normalize-equity-price-evidence |
| F6 | Primary resolved? / build guard or fallback request | build-fallback-price-binding-request |
| F7 | Bind fallback credential | bind-fallback-price-provider-credential |
| F8 | Binding obtained? / build exchange or guard | build-fallback-price-exchange-request |
| F9 | Fallback admission / exchange | observe-fallback-price-exchange |
| F10 | Select retained outcome | select-equity-price-route |

**Directed edges**
| From → To | Label |
|---|---|
| Input → P1 → P2 → P3 → P4 → P5 | ordered primary work; typed carried state |
| P2 → Primary binding socket | request credential under endpoint identity |
| P4 → Primary provider → P4 | one governed exchange / native evidence |
| P5 → F6 | canonical primary outcome |
| P5 → F10 (thin carried-state wire) | primary outcome retained in effectLineage |
| F6 → F7 | if resolved: guard; otherwise: fallback binding request |
| F7 → F8 | BOUND or credential rejection |
| F8 → F9 | if BOUND: exchange request; otherwise: guard |
| F9 → Fallback provider → F9 | only admitted endpoint/credential request crosses network |
| F9 → F10 | exchange evidence; guard path has exchangeCount 0 |
| F10 → Output | fallback canonical result when completed; otherwise carried primary result |

**Historical provider labels**
- Primary: `rapidapi / yahoo-finance166` (`/api/stock/get-price`).
- Fallback: `rapidapi / yahoo-finance-real-time1` (`/market/get-quotes`).
- Their endpoint authority identities differ even where the credential reference is shared.
- Credential source in this historical migration is an earlier configuration; for architecture graphics use **credential authority** without asserting current environment storage. Later installed proof uses the vault.

**Outcome labels**
- `EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED`
- `EQUITY_MARKET_PRICE_PROVIDER_UNAVAILABLE`
- Primary native testimony rejection is also declared.
- “HTTP completed” does not universally imply semantically valid market-price data. Later `reject-empty-equity-fallback-quotes.sql` repairs empty-quote acceptance; do not make a visual universal claim from the older fallback selector.

**Sources**
- `sfx-embody/sql/migrations/add-equity-price-fallback-route.sql:14–29` (mechanics in plain language)
- same file `:69–71` (declared conditional transformations)
- same file `:101–102` (bindings and ordered ten operations)
- `sfx-embody/docs/agent-lane.md:46–55` (recorded primary 429 and fallback answer)
- `sfx-embody/sql/migrations/reject-empty-equity-fallback-quotes.sql:1` (later correction)

## Blueprint 5 — Same declared graph, two illuminated paths

**Purpose:** Present the concrete evidence as architecture, not a two-column text table.

**Classification:** Two separately dated execution overlays on a shared simplified diagram of the recorded lane. The graph's broad structure is shared for communication; exact software and isolation configurations differ. Do not label it a controlled matched experiment.

**Base graph**
Reuse Blueprint 1's center circuit at larger scale, with thin gray declared wires. Keep the actual route junction D and the two terminal branches visible. In both panels, illuminate model invocation, resolution and refusal/selection processing; never gray out the entire refusal invocation.

**Panel A — 18 September**
- Teal highlight: objective → model-request work → model response → declared resolution → ADMITTED → execute-admitted-proposal → market-price circuit → market-data provider → price evidence.
- Gray: REFUSED branch.
- Three terse receipt callouts attached with leader lines:
  - `MODEL_RESPONSE_OBTAINED` at model-response scenario.
  - `EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED` at output.
  - `716 cell testimony entries` at evidence rail.
- Do not print a model version or exact proposal literal from this raw accepted trace; it does not retain them as terminal fields.
- Optional tiny dated environment tag: **managed-host receipt; child processes blocked**. If host-write safety is discussed, explicitly say **write denial not enforced in this receipt**.

**Panel B — 19 September**
- Amber/teal highlight: objective → inference invocation → returned `buy_stock / AVGO` → resolution.
- Coral highlight: `declared: false` → root edge `…-REFUSED` → refusal child → `CAPABILITY_NOT_FOUND`.
- Gray: execute-admitted-proposal and downstream business-provider path.
- Model-provider call stays highlighted because it ran.
- Three receipt callouts:
  - `Gemini 2.5 Pro → buy_stock`.
  - `resolution.declared = false`.
  - `0 target-child cells; 562 total retained cells`.
- Footnote: **Target-child zero is counted from retained testimony, not a standalone receipt flag.**
- Optional environment tag: **Windows low-integrity; host-write denial with stated residuals**.

**Evidence wiring**
Both panels connect their route-node and terminal observations to a shared visual footer showing:
- declared graph identity;
- realized graph identity;
- observed-path identity.
Use the word **identity** rather than “proof of safety.” Each run has its own observed path; don't imply their digests match.

**Sources**
- `build/evidence-extract.json` is the scrubbed machine-readable extract, including source hashes and exact process flags.
- Accepted raw: `sfx-embody/evidence/vault-20260916/csharp-seams/acceptance.observe-objective.stdout`
- Refused raw: `sfx-embody/evidence/vault-20260916/lane-relevance/after-filter/invoke-purchase.stdout.json`
- AppContainer evidence is a separate later run; keep it off these panels unless explicitly drawn as a separate host-test card.

## Implementation advice for a coherent deck

Use Blueprint 1 as the visual anchor and progressively zoom the same nodes. Blueprint 2 expands one scenario. Blueprint 3 expands its provider socket. Blueprint 4 replaces the generic market-price thumbnail with an actual business circuit. Blueprint 5 returns to the anchor and illuminates the observed paths. This gives the audience a navigable architecture rather than unrelated diagram styles.

The “transistor” analogy can be a small legend: **1 — declared meaning / 0 — native resolver**. Avoid literal electrical current, voltage, or silicon claims. A circuit illustration can use schematic visual grammar without claiming the software graph has electronic-circuit security guarantees.

Do not add arbitrary parallel branches, consensus gates, human approvals, cryptographic signatures, globally durable stores, formal-proof gates, or provider retries to the recorded path. Those can appear only as separately labeled architecture extensions with their own admission/evidence obligations.

