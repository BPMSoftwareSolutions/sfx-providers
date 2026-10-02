# Objective invocation: six published scenario findings

Six reports are declared in the live estate and visible on the objective
capability's scenario blueprint (slide 2), review (slides 16–17), and inspection
evidence (slides 71–73). Each scenario label has a native evidence link.

| ID | Finding | Severity |
| --- | --- | --- |
| R05 | EXECUTOR_DECLARATION_UNRESOLVED | Error |
| R06 | GRAPH_SOURCE_READ_LATENCY | Error |
| R07 | INVOCATION_PURPOSE_MISMATCH | Error |
| R08 | LEGACY_DECLARED_READ_REFERENCE | Error |
| R09 | SESSION_SETUP_OVERHEAD | Warning |
| R10 | FORMAL_VERIFICATION_NOT_COMPOSED | Error |

The selected final invoke port constructed a graph in 33.084 seconds with
3,563,538 logical reads, consuming about 92% of the 35.791-second reproduction.
The stdout document was a capability graph. Details and limits are recorded in
`sfx-embody/docs/request-objective-invocation-graph-read-delay.md`; the truth
lane is `sfx-embody/sql/inspect/objective-invocation-delay/`.

The reports, classification, wording, measurements and generation pins are read
from rows through the declared `read-scenario-bugs` reading. The renderer
contains no capability identity, elapsed-time detector or hard-coded bug text.
The observation strip presents retained evidence and links to the complete
inspection record. It does not claim a currently executing invocation.

Visual verification exposed an existing operation-address projection error:
walking incoming edges of an already resolved operation marked its predecessor.
The scenario sheet now uses resolved operation addresses directly. The final
slide highlights operation **07**, the invoke port, and legacy-reference
operations **01** and **05**. It does not flag the invoke port's predecessor.
Selector captions are limited to selector findings: an invocation-purpose bug
cannot invent a missing request-path claim.

Validation:

- SQL rollback preflight and uncommitted Node invocation returned six findings.
  The final report-reading cell took 133.239 ms in that preflight.
- Installation through the commit twin succeeded; replay returned unchanged.
- The installed C# `sfx capability invoke read-scenario-bugs` returned five error
  findings and one warning, exit 0 and empty stderr. An unrelated capability
  returned explicit zero. Base-row inspection counted six reports and six
  declared repair mappings, all held pending their next declared unit of work.
- Four SQL dependency checks passed: baseline six; modified related capability,
  modified port and newly present provider each returned explicit zero.
  Probe mutations affect in-memory report variables only.
- 27 presentation tests passed across inspection-envelope, boundary,
  provider-involvement and invocation-inspection suites. Tests cover direct
  operation ownership, evidence links, unchanged circuit routes and stale
  envelope suppression.
- Live deck regeneration returned all six located reports and their repair map.
  The final presentation replays that same live snapshot after the caption fix.
  The scenario, review and inspection SVGs were rendered and visually checked;
  PowerPoint XML confirmed every scenario label and its exact evidence link.
  Inspection remains 14/15 readings, with witnesses held after a recorded failure.

Final local output directory:
`outputs/objective-purpose-bugs-final-20260928/` (scenario PNG, SVGs, JSON evidence,
`bug-acceptance.json`, and PowerPoint). Earlier output directories are
diagnostic captures, not the final deck.

The performance defect remains open. Publication is complete; no latency repair
or successful market-price execution is claimed.

The repair guidance now requires removing the graph-read stand-in, not making
it faster. Proposal-only output versus formal-verification composition remains
a product decision. The 603.547 ms session setup measurement is a warning and
an SDA request; timing does not prove locks or impersonation can be removed
safely. The executor finding is scoped to the named provider and selected empty
port, not every possible executor estate-wide. These are generation-bound
reports with dependency checks, not a universal semantic-purpose detector.

Snapshot: `3b31030d0b2a9988180fa8228cc23d545de454dfc18bf9d40a65aa2295a2e6f2`.
Final content: `d28417d63d11ddab5a153c1d559c423bc3fbfdeb6b172d63db0ce26cb371daf2`.
