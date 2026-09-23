# Capability absorption playbook

**Date:** 2026-09-23. **Status:** Proposed operating procedure. These states and
gates are documentation vocabulary, not installed commands or a new change
lifecycle. Use the estate's admitted procedures for actual changes.

This playbook applies the [architecture](capability-estate-modernization.md) using
the [evidence model](modernization-evidence-model.md). Its unit is a scenario
slice and its execution responsibilities. Valid outcomes include increased
native authority, better-governed external use, and deliberate external retention.

## 1. Establish scope and ownership

Start with the objective and observable outcome. Find existing capabilities and
scenarios before inventing identities. Locate actual provider selections, nested
dependencies, shared state, and side effects. Mark unknown behavior explicitly.

Record current authority, contracts, binding, implementation version where
observable, environment, scenario population, and operational baseline. Preserve
evidence of what works today; an unversioned recollection is not a comparison
baseline.

| Responsibility | Decision owned |
| --- | --- |
| Capability owner | Meaning, acceptable business outcomes and intended changes. |
| Provider/operator owner | Dependency behavior, operational evidence, state and effects. |
| Candidate author | Proposed declarations and fixtures; no self-granted admission. |
| Evaluator/reviewer | Comparison policy, proof adequacy, mismatches and limitations. |
| Admission authority | The allowed change under existing estate governance. |
| Rollout owner | Selection, stop conditions, rollback/reconciliation and retirement. |

One person may hold several roles. The output is a bounded migration case:
responsibility to move, reason, evidence, destination, success criteria, unresolved
risks, and decision ownership. An application rewrite is not a prerequisite.

## 2. Progression and exit evidence

Activities may overlap, but later status requires its prerequisites. A blocked
transition retains the current selection and a finding naming the missing proof.

| State | Work | Evidence required to advance |
| --- | --- | --- |
| Unknown dependency | Discover callers, outputs, state, effects and ownership. | Identified scenario responsibility, boundary and remaining unknowns. |
| Declared external provider | Establish contracts, port, binding and applicable controls. | Resolvable declarations and observed enforcement of required boundary checks. |
| Observed provider | Gather outcomes, failures, timing and context through the boundary. | Version-linked observations, sampling/population definitions, missing cases and failures. |
| Characterized capability | Review meaning, expected outcomes and hidden state. | Scenario catalogue, legacy defects, comparison rules and proof obligations. |
| Candidate embodiment | Reuse, compose or author candidate estate declarations and fixtures. | Candidate version, scope, topology and proof results; admission remains separate. |
| Parallel/shadow evaluation | Compare against the declared relation with isolated effects. | Paired results, mismatches, coverage and reviewed dispositions. |
| Admitted estate capability | Complete the applicable declared change lifecycle. | Admitted authority/version, separately recorded from production selection. |
| Selected and verified capability | Move intended cohorts under explicit stop/rollback criteria. | Actual selected-version invocation proof and operational acceptance for the claimed scope. |
| Provider retired or retained alternate | Remove old paths or declare bounded alternate use. | Dependency/drain and retirement proof, or an alternate policy with ongoing evidence obligations. |

The selection state makes the source discussion's admission-to-retirement step
explicit. Admission can exist without selection, and selection can cover only
part of the population.

A characterized provider can instead enter **intentional external retention**.
Record rationale, owner, controls, evidence expectations, substitution constraints
and a revisit trigger. A replacement candidate is not required for that decision.

## 3. Govern and observe the boundary

For legacy pricing, identify the request, permitted context, outcome contract,
provider selection and failure semantics. Observe through that declared path.
Direct diagnostic calls may aid investigation but do not prove circuit selection.

Establish evidence for applicable input, binding, effect-scope, credential,
response-bound, outcome-admission and disposition controls. Retain absent controls
as gaps instead of treating an API wrapper as complete governance.

Distinguish failures: a pre-invocation refusal prevents dispatch through that
path; a provider rejection or malformed response describes the interaction; a
timeout may leave an effect uncertain; outcome admission may fail after a remote
effect succeeds. Use declared reconciliation, retry, compensation or escalation
behavior. Database rollback does not reverse a remote payment or notification.
Record idempotency only where the operation and provider actually support it.

## 4. Characterize the meaning

Use authorized observations, known fixtures, incidents and domain-owner review
to define normal, boundary, refusal, failure, stale-data and effect-uncertain
cases. For pricing, consider currency, rounding, discounts, policy dates,
customer classes and unavailable reference data. Name the combinations in scope
and how expected results were established.

Separate intended behavior, observed behavior still needing interpretation, and
known legacy defects. An observed result does not become authoritative by being
copied into a fixture. Resolve disputed cases with the capability owner; retain
unresolved ones as holds or explicit exclusions. Version acceptance policy and
contracts when meaning changes. Never redefine equivalence merely to pass a
candidate.

Record state snapshots, effective dates, ordering, randomness where controllable,
model versions where observable and shared transaction assumptions. If the slice
cannot be characterized independently, enlarge it or improve observation before
attempting absorption.

## 5. Define comparison before evaluation

| Relation | Suitable use | Required definition |
| --- | --- | --- |
| Exact outcome equality | Deterministic calculations under pinned context | Canonical fields and normalization rules. |
| Domain equivalence | Different representations of the same business result | Approved predicates and ignored representation differences. |
| Numeric tolerance | Legitimate bounded numeric variation | Units, absolute/relative tolerance and boundary behavior. |
| Invariant satisfaction | Several acceptable outcomes | Required properties and forbidden outcomes. |
| Distributional evaluation | Probabilistic behavior | Versioned dataset, measures, sample adequacy and thresholds. |
| Approved behavior change | Correcting a legacy defect | New intended outcome and authorized justification. |

Compare failures and effect semantics as well as successful payloads. Include
decision evidence required by the contract. Define latency, resource, cost and
availability thresholds separately from semantic validity.

A high aggregate pass rate cannot override a mandatory failing case. Publish
attempts, evaluable pairs, missing/unevaluable cases, mismatches by severity and
coverage gaps using the evidence model's denominators.

## 6. Author and evaluate a candidate

Prefer reuse, composition or declared profiling before new identity. Candidate
meaning belongs in estate authority/data; wrapping a new handwritten module
leaves its internal behavior external. Identify missing platform mechanics
through the appropriate governed change process.

AI may propose declarations and fixtures from bounded, referenced context. Its
output remains a candidate. Alignment evaluation should examine intent, scenarios,
semantic altitude, reuse, topology, authority, provider boundaries, proof, novelty
and admission readiness. Use accepted criteria and independently grounded examples,
not only tests generated from the candidate itself.

Attach candidate version, topology, proof and gaps to the migration case. A
candidate that calls a remote model retains an external dependency even when
its orchestration is native.

### Choose a comparison mode that isolates effects

| Mode | When useful | Effect rule |
| --- | --- | --- |
| Offline replay | Inputs and required state can be captured | Recorded effects or isolated simulation; disclose simulation limits. |
| Read-only shadow | Both executions can read equivalent state | Confirm read-only behavior and account for provider cost/limits. |
| Isolated dual execution | Stateful behavior requires comparison | Separate environments and state; reconcile differences. |
| Candidate decision shadow | Decision can be separated from delivery | One authorized path performs the real effect; compare proposed decisions. |
| Controlled live cohort | Earlier proof supports a bounded trial | One selected effect authority per business invocation; retain stop and recovery procedures. |

Do not shadow by charging twice, sending duplicate messages or mutating the same
record twice. Correlate input and state versions; calls near each other in time
may see different reference data. A simulator does not prove real-provider
delivery semantics. Retain limitations and obtain appropriate operational
evidence before expanding the claim.

## 7. Admit, select and verify

Use the applicable admitted change lifecycle. Existing provider-binding work
describes author, prepare, dry-run, preflight, install and verify stages; it does
not establish that every replacement has a working installer. Resolve missing
writers and contracts before claiming admission.

Prepare a reviewable cutover case with:

- Exact candidate authority, contracts, binding/selection change and cohort.
- Evaluation evidence and disposition of every mandatory mismatch.
- State migration/synchronization, ordering and in-flight work handling.
- Observation interval, operational limits, stop conditions and responsible owner.
- Prior viable selection, rollback conditions and reconciliation procedure.
- Evidence that will demonstrate successful selected execution.

Admission authorizes the declared scope; production selection can follow in
stages. Bind each invocation to its selected versions where required by the
execution model. Do not change implementation halfway through a stateful
operation without declared semantics for doing so.

Verify through the real capability path after selection. Capture selected
authority/provider, outcome, disposition and lane/testimony evidence. Evaluate
semantic and operational criteria, including failures before accepted outcomes.
A healthy endpoint is insufficient proof.

### Rollback is a new recorded selection

Apply stop or rollback conditions when mandatory outcomes fail, unexplained
divergence appears, thresholds are crossed or evidence becomes insufficient.
Preserve the attempted migration and append its outcome.

Restoring a route works only when state and effects remain compatible. Otherwise
reconcile, compensate or pause affected scenarios under declared policy. Old
implementations may not understand newly written state; plan compatibility
before cutover. A saved binding alone does not guarantee reversibility.

After rollback, report actual selected execution. Keep candidate admission and
evaluation history without presenting it as native production execution.

## 8. Retire or retain the old provider

Establish that no active scenario, fallback, scheduled path or shared consumer
still needs the old selection. Drain in-flight work and settle uncertain effects.
Verify successor behavior before removing resources or credentials that could
be shared. Preserve lineage and historical evidence under the applicable
retention policy. Deleting selected code creates a broken dependency, not absorption.

An alternate remains a dependency. Declare its selection policy, state/contract
compatibility, exercised recovery evidence and review condition. Its executions
must appear as external selection in observation and coverage reports.

## 9. Apply this to the eleven-provider bridge

The [bridge decision](README-bridge.md), [policy](../bridge.policy.json) and
[swap-in map](swap-in-map.md) retain their existing authority. This playbook does
not reopen their closed surface.

1. Select an existing altitude and its recorded successor; no twelfth provider.
2. Recheck current successor admission, writer, contract, placement and binding
   prerequisites. Historical annotations are not current runtime proof.
3. Establish the declared-data counterpart through the admitted lifecycle and
   per-altitude map. A dashboard status is not an installer.
4. Retire the bridge placement through an available admitted mechanism. Some
   placement writers in the map are `PROPOSED`; their names do not establish
   installed or authorized behavior.
5. Capture both the successor invocation's declared outcome and required lane
   event, retaining prior/successor identities and selection evidence.
6. Remove the code provider only when successor and swap conditions hold. Count
   retirement once, after placement retirement and swap proof, keeping inventory,
   evidence and counters consistent.

```text
providers_retired + providers_remaining = 11
providers_remaining never increases
```

The record dated 2026-09-22 starts at zero retired and eleven remaining; these
docs change neither counter. Counterparts for altitudes 1 and 8 do not imply two
completed retirements.

The policy specifies `PROVIDER_BRIDGE_GROWTH_REFUSED` for growth and
`PROVIDER_BRIDGE_SUCCESSOR_OVERDUE` when a successor satisfies the policy's
admission/verification conditions while its bridge stays selected. Distinguish
these requirements from proven runtime enforcement.

Some successors still call external models. Their bridge retirement proves
movement of local coded responsibility into declarations; it does not prove
movement of inference into estate authority.

## 10. Completion and continuing review

Absorption is complete for the claimed scope when intended meaning is admitted,
selection uses that authority, semantic and operational proof exists, and the
old dependency is retired or explicitly retained. State remaining external
dependencies and limitations.

Intentional retention is complete as a decision when it has adequate boundary
governance, evidence obligations, ownership and a revisit trigger. Native
coverage need not increase for the decision to improve the architecture.

Revisit behavior, bindings, incidents, costs, required outcomes and candidate
feasibility as they change. A future declared dashboard or review capability can
expose triggers; these documents install no automation.

## 11. Implement the proposed observability surface

Build through admitted estate declarations and changes, without expanding this
code bridge:

| Increment | Deliverable | Acceptance evidence |
| --- | --- | --- |
| Inventory | Declared read linking scenarios, operations, ports and selections | Bounded dependency closure with unresolved edges reported. |
| Classification | Admitted assessment vocabulary linked to authority | Ownership, authority, controls, repeatability and intent remain distinct. |
| Observation join | Selected versions linked to execution and provider testimony | Configured, attempted, observed and accepted execution distinguished, including failures. |
| Lineage | Migration and selection events | Partial rollout and rollback reconstructable without rewriting history. |
| Measurement/view | Derived topology and scoped metrics | Reproducible numerators/denominators with unknown/stale evidence visible. |
| Decision support | Evidence-based prioritization and review triggers | Proposals remain separate from admission. |

These are proposed deliverables, not installed identities. Discover and reuse
admitted capabilities first. Demonstrate one scenario through a proved authority
change with the view showing exactly what moved and what remains external.
