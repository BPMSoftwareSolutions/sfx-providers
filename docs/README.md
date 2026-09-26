# Provider architecture and modernization

SideFX treats modernization as a change in where capability execution authority
resides. A provider can be owned by the enterprise and still be external to the
capability estate. Declaring its interaction boundary makes that dependency
visible; absorbing its behavior into admitted estate authority is a separate step.

The documentation below develops the architecture discussion supplied on
2026-09-23 and connects it to this repository's existing migration bridge.

| Document | Purpose |
| --- | --- |
| [Circuit-presentation provider](circuit-presentation.md) | Reusable native diagrams, retained announcement design, JSON/HTTPS/CLI contracts and editable PowerPoint export. |
| [Capability estate modernization](capability-estate-modernization.md) | Architectural thesis, boundaries, terminology, determinism topology, scenario-based migration, and the role of AI. Start here. |
| [Modernization evidence model](modernization-evidence-model.md) | Proposed classification records, evidence and lineage, metrics, dashboard semantics, and worked measurements. |
| [Capability absorption playbook](capability-absorption-playbook.md) | Progression from an unknown dependency to governed use, characterization, candidate execution, admission, and retirement; includes cutover and rollback criteria. |
| [Code-provider bridge decision](README-bridge.md) | Existing admission ceiling and shrink-only rule for the eleven authoring-altitude providers. |
| [Swap-in map](swap-in-map.md) | Existing per-altitude successor mapping, prerequisites, retirement actions, and required invocation/lane proof. |

The first three documents describe a design and operating model. Their proposed
fields, state names, metrics, and views are not installed contracts, commands,
database objects, or runtime enforcement. The existing
[bridge policy](../bridge.policy.json) remains the policy record for this
repository. [Binding evidence](../bindings/README.md) records historical authoring
and dry-run results; it must not be read as proof of a current live installation.

For local service setup, request/response contracts, and implementation limits,
see the [repository README](../README.md).
