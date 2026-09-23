# Modernization evidence and measurement model

**Date:** 2026-09-23. **Status:** Proposed information and measurement model.
No fields, enums, metrics, or views in this document are installed by documenting
them. All business examples and measurements below are illustrative.

This model supports the claims in
[Capability estate modernization](capability-estate-modernization.md). It keeps
declared authority, selected execution, observation, and interpretation distinct.

## 1. The unit of a claim

Classify an **execution responsibility within a versioned scenario/circuit
scope**, not a provider name in isolation. One provider can serve several
capabilities; one capability can select different providers by scenario, region,
cohort, or fallback condition. A composite capability can contain native and
external responsibilities.

Each claim must identify:

- Capability and scenario identities, contract versions, and selected authority.
- The operation, port, binding, and implementation responsible for the behavior.
- The environment and applicable selection condition or cohort.
- The observation interval and evidence supporting the classification.
- The decomposition level, nested dependencies, and unresolved boundaries.

An overall `estateNative: true` flag loses too much information for mixed
circuits. It may be a derived label only when the specified scope and evidence
justify it. An absent binding or unobserved nested dependency is unknown, not
implicitly native.

## 2. Proposed record families

These are logical record families. They should reuse existing estate identities,
contracts, testimony, and change receipts where available. A documentation JSON
example is not a proposal to establish a second source of execution authority.

| Record | Minimum information | Purpose |
| --- | --- | --- |
| Capability/scenario scope | Identities, meaning version, input/outcome contracts, scenario catalogue, graph revision | Defines what the claim covers. |
| Execution responsibility | Operation/port, native/external/mixed/unknown classification, governing definition, nested dependencies | Locates internal authority. |
| Provider and binding | Provider identity, binding version, owner, implementation posture, selected scope, effective period | Separates implementation identity from route selection. |
| Boundary controls | Each applicable control, its governing authority, evidence, and enforced/missing/unknown assessment | Prevents a broad "governed" label from hiding gaps. |
| Strategic decision | Intent, rationale, owner, constraints, review date or trigger | Distinguishes a deliberate external dependency from an unexamined one. |
| Execution observation | Correlation, selected versions, timings, provider outcome, circuit disposition, effect evidence | Connects intended and actual execution. |
| Characterization/evaluation | Corpus version, comparison policy, denominators, mismatches, omissions, reviewer | Defines the limits of equivalence claims. |
| Migration event | Prior and successor identities, transition, effective scope, evidence references, decision authority | Preserves lineage, including rollback and partial selection. |

When a remote implementation version cannot be observed, record that limitation
alongside the binding revision. A stable endpoint and binding do not imply stable
remote behavior.

### Classification dimensions

| Dimension | Suggested values or content | Rule |
| --- | --- | --- |
| Ownership | Enterprise, third-party, shared, unknown | Does not determine estate relationship. |
| Internal authority | Estate-native, external, mixed, unknown | Must be scoped to the behavior being assessed. |
| Provider posture | Legacy-service, current-service, library, SaaS, model, declared-behavior | Descriptive; does not imply quality. |
| Boundary controls | Input, binding, effect scope, evidence, outcome admission | Assess each control separately. |
| Repeatability | Proven within conditions, observed only, variable by design, unknown | Name state/version/randomness assumptions and proof scope. |
| Strategic intent | Intentional-external, temporary-bridge, absorption-candidate, undecided | Requires rationale and review ownership. |
| Migration state | The progression in the playbook, plus current rollout/rollback facts | Does not replace selected-execution evidence. |

Implementation-specific admitted vocabulary takes precedence over these proposed
labels. Do not write these labels into existing contracts without a declared
change that admits them.

## 3. Illustrative assessment record

This is a documentation-only example, **not** `provider-binding-change.v1`, an
admitted schema, or a file to pass to `provider add`. `example:` references are
placeholders; they do not resolve to real estate objects or evidence.

```json
{
  "recordPurpose": "illustrative-modernization-assessment",
  "scope": {
    "capabilityId": "example:resolve-price",
    "scenarioId": "example:price-eligible-customer",
    "circuitRevision": "example:pricing-circuit-r3",
    "authorityRef": "example:pricing-authority-r3",
    "inputContractRef": "example:pricing-input-v1",
    "outcomeContractRef": "example:pricing-outcome-v1",
    "environment": "example-production",
    "selectionCondition": "all eligible pricing requests",
    "decomposition": "price-calculation responsibility"
  },
  "responsibility": {
    "operationId": "example:calculate-price",
    "portId": "example:pricing-port",
    "bindingRef": "example:legacy-pricing-binding-r2",
    "providerId": "example:legacy-pricing-engine",
    "providerVersion": null,
    "providerVersionObservation": "not reported by provider",
    "ownership": "enterprise",
    "posture": "legacy-service",
    "internalAuthority": "external",
    "nestedDependencyVisibility": "unknown"
  },
  "boundaryAssessment": {
    "inputAdmission": "enforced",
    "bindingSelection": "enforced",
    "effectScope": "enforced",
    "evidenceCapture": "enforced",
    "outcomeAdmission": "enforced",
    "evidenceRefs": ["example:boundary-control-evaluation-r2"]
  },
  "repeatability": {
    "status": "observed-only",
    "conditions": "same request corpus and recorded pricing context",
    "limitation": "hidden provider state and implementation version unpinned"
  },
  "strategy": {
    "intent": "absorption-candidate",
    "rationale": "characterize pricing rules before proposing a native replacement",
    "decisionOwner": "example:pricing-capability-owner",
    "reviewTrigger": "characterization corpus and candidate evaluation complete"
  },
  "migration": {
    "state": "observed-provider",
    "candidateRef": null,
    "selectedImplementation": "external",
    "lineageRef": "example:pricing-lineage"
  },
  "evidenceScope": {
    "observationWindow": "example:baseline-window",
    "graphCompleteness": "boundary-only",
    "evidenceRefs": ["example:pricing-observations-r1"],
    "limitations": ["provider internals and nested calls are not observed"]
  }
}
```

This record says that pricing interaction is governed while the pricing
implementation remains external. It makes no claim about native completion,
unobserved internals, or universal determinism.

## 4. Evidence sufficient for a claim

Evidence should be attributable to a collector and capture method, correlated to
an invocation or evaluation, and bound to the relevant authority and binding
versions. Digests support integrity checks; they do not establish that a claim
is true or that the collector was authoritative.

| Claim | Required evidence | Insufficient substitute |
| --- | --- | --- |
| Dependency declared | Resolvable scenario, operation, port and binding under a selected definition | A diagram or endpoint inventory. |
| Boundary governed | Control declarations plus receipts demonstrating applicable checks and refusals | HTTP success or the existence of a wrapper. |
| Provider observed | Correlated attempts, outcomes, failures and evidence of actual selection | A health check or a configured route. |
| Behavior characterized | Versioned scenarios, reviewed expected outcomes, edge/failure cases, state assumptions and gaps | Many successful calls without a defined population. |
| Candidate conforms | Named obligations, independent expected outcomes and comparison results for a versioned candidate | Candidate schema validity alone. |
| Authority absorbed | Admitted declaration, selected routing for the claimed scope, and execution evidence against it | Candidate existence or admission with no production selection. |
| Provider retired | Removed selection/alternate paths, dependency checks, draining and retirement proof | Deleted local code or a zero count in a dashboard. |

Evidence capture should preserve the material needed to reproduce the assessment
without unnecessarily retaining secrets or full sensitive request bodies. Use
bounded, authorized references and redacted representations where appropriate;
record when redaction or unavailable state limits replay. Failed and held
invocations belong in the record as well as accepted ones.

Keep four layers distinguishable: a declaration states intent; runtime testimony
reports execution; provider testimony reports what the provider claims; an
assessment interprets those records under a stated policy. Contradictions between
layers are findings to resolve, not values to average away.

## 5. Measurement rules

Choose a root capability, environment, authority revision, observation window,
and decomposition policy before calculating anything. Use the same declared
dependency closure for comparisons. Include permitted conditional and fallback
paths in structural reports; distinguish those from the paths observed in a
particular execution window.

For structural counting, count each responsibility once using a stable scoped
identity. Shared dependencies are deduplicated under the published rule; cycles
do not create infinitely many units. Invocation-weighted measures count actual
execution occurrences, including repeated calls, under a separately stated rule.
Do not mix those denominators.

Split a mixed responsibility into justified leaf responsibilities where possible.
Otherwise retain `mixed` without awarding native credit. Unresolved edges must
be shown. If the dependency closure itself is incomplete, report any percentage
as coverage of the enumerated scope and withhold a whole-circuit percentage.

### Recommended measurements

| Measure | Definition | Interpretation |
| --- | --- | --- |
| Native execution-authority coverage | `native responsibilities / all enumerated in-scope responsibilities` | Where internal meaning/execution is under estate authority. Mixed and unknown stay in the denominator. |
| Boundary-governance coverage | `provider boundaries with all applicable required controls evidenced / all enumerated in-scope provider boundaries` | How much of the interaction surface is demonstrably governed. |
| Classification completeness | `responsibilities with evidenced native/external/mixed classification / all enumerated responsibilities` | How much of the known topology can be classified. Does not prove topology completeness. |
| Repeatability-proof coverage | `responsibilities with passing repeatability obligations / all responsibilities designated as requiring repeatability` | Coverage of a versioned obligation set; variable-by-design exclusions are listed. |
| Scenario-characterization coverage | `scenario cases with reviewed expected outcomes and required evidence / all cases in the declared catalogue` | Completeness against a named catalogue, not all possible real-world behavior. |
| Candidate comparison pass rate | `comparisons satisfying the declared relation / evaluable paired comparisons` | Report total attempted, excluded, failed, missing and unevaluable cases alongside it. |
| Native execution share | `observed responsibility executions using native selection / all observed in-scope responsibility executions` | Actual observed traffic, not declared availability; report trace completeness. |
| External failure exposure | Failed, held and effect-uncertain provider attempts by scenario, criticality and volume | Report both provider attempts and affected business invocations; retries can inflate counts. |
| Absorption change | Native responsibilities gained and lost between versioned scopes, with supporting lineage | Show net movement and reversals; normalize scope changes before comparison. |

An empty denominator yields **not applicable** or **no evidence**, as appropriate,
not 100%. A missing denominator yields unknown. Every measurement includes the
numerator, denominator, scope, interval, and evidence freshness.

If weighted coverage is useful, publish the weights and their basis:

```text
weighted_native_coverage = sum(weight[r] * native_indicator[r]) / sum(weight[r])
native_indicator[r] = 1 only for evidenced estate-native responsibility r; otherwise 0
```

Weights may represent observed execution frequency or agreed criticality, but
these are different views and must be named separately. Do not change the weights
between periods without restating the baseline. Show critical low-frequency
external dependencies even when their contribution to an aggregate is small.

### The deterministic-factor question

Do not derive determinism by counting native nodes. If the term *deterministic
factor* is retained in a product view, define it narrowly as the
repeatability-proof coverage above and display its conditions, exclusions, and
evidence. Keep it separate from native authority and boundary governance. A
topology with per-node claims is more informative than an unqualified score.

## 6. Worked before-and-after example

Assume a fixed five-responsibility scope with complete classification. The
notification row covers orchestration only; transport dependencies are outside
this illustrative scope and prevent an end-to-end native claim.

| Responsibility | September selection | December selection | Required change evidence |
| --- | --- | --- | --- |
| Identity resolution | Native | Native | Continuing selected version and observations. |
| Customer lookup | Native | Native | Continuing selected version and observations. |
| Credit decision | External legacy | Native | Candidate evaluation, admission, selected route and invocation proof. |
| Fraud scoring | External model | External model | Intentional-external decision and provider observations. |
| Notification orchestration | Native | Native | Continuing selected version and observations. |

Native coverage changes from `3 / 5 = 60%` to `4 / 5 = 80%`: a gain of one
responsibility and 20 percentage points in the fixed scope. If all five relevant
boundaries were already governed, their boundary coverage need not change.
Repeatability-proof coverage requires separate evidence and cannot be inferred.

During rollout, an admitted credit candidate may receive only 10% of credit
traffic. Report the current selection as mixed by cohort and show that traffic
share. Do not assign the completed December classification to the whole scope
until its selection criteria and evidence are satisfied.

## 7. Dashboard semantics

An illustrative estate view can combine these facts without collapsing them:

| Capability | Selected internal authority | Boundary evidence | Strategic intent | Migration state |
| --- | --- | --- | --- | --- |
| Resolve customer | Native in assessed scope | Current | Estate-native target | Admitted and selected |
| Calculate tax | External enterprise legacy | Boundary only | Absorption candidate | Characterized |
| Process payment | External SaaS | Boundary plus provider testimony | Intentional external | Retained with review trigger |
| Evaluate eligibility | Mixed by rollout cohort | Current evaluation evidence | Absorption candidate | Partial native selection |
| Send SMS | External SaaS | Boundary plus delivery testimony | Intentional external | Retained with review trigger |
| Generate invoice | Native in assessed scope | Current | Estate-native target | Admitted and selected |

Every row should drill down to scenario scope, authority and binding versions,
topology, evidence, unresolved dependencies, and decision ownership. Avoid labels
such as "full evidence" or "fully sovereign" without a bounded claim. Mark stale
and missing evidence explicitly. Keep configured, observed, candidate, alternate,
and retired providers distinguishable.

The view should answer whether a modernization gain arose from native behavior,
improved boundary control, better observation, or simply a changed inventory.
These are all potentially useful changes, but they support different claims.

## 8. Lineage and refresh

Retain a linked sequence such as:

```text
LegacyCreditService discovered
  -> declared binding selected
  -> characterization recorded
  -> candidate authored and evaluated
  -> candidate admitted
  -> selected for cohort A
  -> selected for complete intended scope
  -> legacy alternate retained
  -> alternate retired after dependency and drain proof
```

Each event records prior/successor references, effective time, scope, decision
authority, evidence, and its reason. Rollbacks append a new selection event;
they do not erase the attempted migration. Provider versions and old evidence
remain linked after operational retirement.

Refresh classifications when authority, contracts, bindings, remote behavior,
required controls, scenario catalogues, or evidence freshness change. A material
change invalidates only the claims that depend on it, but those claims must be
re-evaluated. This document proposes that behavior; no automatic monitor is
installed by these docs.

For this repository, use [bridge.policy.json](../bridge.policy.json) and the
[swap-in map](swap-in-map.md) for the existing eleven-provider inventory. The
policy baseline is a different denominator from scenario execution authority.
Keep `providers_retired + providers_remaining = 11` separate from the broader
metrics, and attach the required swap evidence before counting a retirement.
