import { normalizeSnapshot, validateSnapshot, digest, fail } from './snapshot.mjs';

// The declaration document is a circuit-first authoring surface: capability,
// scenarios, execution authorities, port bindings, contracts and the declared
// lighting transitions. It is the same shape the estate reader fills, without a
// database. Imports carry retained normalized closures selected from other
// capability snapshots (for example an entry circuit read from the estate).
export const DECLARATION_ID = 'capability-declaration-presentation.v1';

const pointer = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const clone = value => value == null ? value : structuredClone(value);

function rawFromDeclaration(declaration) {
  if (declaration?.contractId !== DECLARATION_ID) fail('Expected a capability-declaration-presentation.v1 document.', 'CAPABILITY_DECLARATION_INVALID');
  const c = declaration.capability ?? {};
  if (!c.id || !c.rootScenarioId) fail('Declaration capability identity and root scenario are required.', 'CAPABILITY_DECLARATION_INVALID');
  const scenarios = declaration.scenarios ?? [], authorities = declaration.authorities ?? [];
  if (!scenarios.some(s => s.id === c.rootScenarioId)) fail('Declaration root scenario is not declared.', 'CAPABILITY_DECLARATION_INVALID');
  const scenarioIds = new Set(scenarios.map(s => s.id));
  for (const a of authorities) if (!scenarioIds.has(a.scenarioId)) fail(`Authority ${a.id} names an undeclared scenario.`, 'CAPABILITY_DECLARATION_INVALID');
  const definitionJson = JSON.stringify({ semantics: {
    ...(c.authority ? { authority: c.authority } : {}),
    ...(c.readiness ? { readiness: c.readiness } : {}),
  } });
  const authored = s => JSON.stringify({ semantics: { scenario: s.authored ?? { keyword: 'Scenario', name: s.name ?? s.id } } });
  const rows = scenarios.map(s => ({ scenario_id: s.id, name: s.name ?? s.id,
    scenario_version_pk: s.versionPk ?? 'declared', definition_digest: s.definitionDigest ?? '',
    owned: s.owned !== false, definition_json: authored(s),
    input_name: s.input?.description, event_name: s.event?.description, responsibility: s.event?.description,
    experience: s.outcome?.description, terminal_disposition: s.descriptions?.terminalDisposition }));
  const graph = {
    capabilityId: c.id, rootScenarioId: c.rootScenarioId, graphType: declaration.graphType ?? 'declaration document',
    scenarios: scenarios.map(s => ({ scenarioId: s.id,
      input: { inputId: s.input?.id, contract: { contractId: s.input?.contractId } },
      event: { eventId: s.event?.id, executionAuthorityId: s.authorityId },
      outcome: { outcomeId: s.outcome?.id, contract: { contractId: s.outcome?.contractId }, terminal: s.outcome?.terminal === true } })),
    scenarioOutcomes: scenarios.map(s => ({ scenarioId: s.id, variants: (s.variants ?? []).map(v => typeof v === 'string'
      ? { variantId: v, classification: 'unspecified' } : { variantId: v.id, classification: v.classification ?? 'unspecified' }) })),
    transitions: (declaration.transitions ?? []).map(t => ({ transitionId: t.id, from: { scenarioId: t.from }, to: { scenarioId: t.to },
      selectsVariant: t.variant ?? '', topologyKind: t.topologyKind ?? '', semanticProgress: t.semanticProgress ?? '', contractRelation: t.contractRelation ?? '' })),
    executionAuthorities: authorities.map(a => ({ id: a.id, owningScenarioId: a.scenarioId,
      operations: (a.operations ?? []).map(op => ({ operationId: op.id, kind: op.kind, portId: op.portId, scenarioId: op.scenarioId, outcomeVariants: op.outcomeVariants })) })),
    interfaceAuthority: { interfaces: declaration.interfaces ?? [],
      portBindings: (declaration.bindings ?? []).map(b => ({ portId: b.portId, platformCapabilityId: b.platformCapabilityId, configuration: b.configuration ?? {} })) },
    semanticTransformations: declaration.transformations ?? [],
    contractAuthorities: { contracts: declaration.contracts ?? {} },
  };
  return {
    capability: { capability_id: c.id, namespace_id: c.namespaceId, estate_model_pk: c.estateModelId ?? '',
      capability_pk: c.pk ?? '', capability_version_pk: c.versionPk ?? '', definition_pk: c.definitionPk ?? '', definition_digest: c.definitionDigest ?? '',
      name: c.name, actor: c.actor, intent: c.intent, outcome: c.outcome, experience_promise: c.experiencePromise, definition_json: definitionJson },
    graph, scenarios: rows, features: declaration.features ?? [], fixtures: declaration.fixtures ?? [], obligations: declaration.obligations ?? [],
    altitudeCatalog: declaration.altitudeCatalog ?? [], conditions: declaration.conditions ?? [],
    platformImplementations: declaration.platformImplementations ?? [], providerLabels: declaration.providerLabels ?? [],
    inspection: declaration.inspection ?? null,
    provenance: { adapter: 'declaration-capability-presentation.v1', isolation: 'declaration', ...(declaration.provenance ?? {}) },
  };
}

// Selected closures from retained snapshots keep their already-normalized rows.
// Re-indexing is deterministic: source pointers are recomputed from final order,
// never from the import order, and the digest is recomputed over the whole body.
export function snapshotFromDeclaration(declaration) {
  const snapshot = normalizeSnapshot(rawFromDeclaration(declaration));
  const imports = declaration.imports ?? [];
  const seen = new Map();
  for (const imp of imports) {
    if (!imp || typeof imp !== 'object' || !Array.isArray(imp.scenarioIds) || !imp.scenarioIds.length)
      fail('A declaration import must name the selected scenarios it carries.', 'CAPABILITY_DECLARATION_INVALID');
    for (const key of ['scenarios', 'authorities', 'bindings', 'transformations', 'contracts', 'interfaces', 'platformImplementations']) {
      if (imp[key] !== undefined && !Array.isArray(imp[key])) fail(`Declaration import ${key} must be an array.`, 'CAPABILITY_DECLARATION_INVALID');
      for (const row of imp[key] ?? []) snapshot[key].push(clone(row));
    }
  }
  const unique = (rows, key) => { for (const row of rows) {
    if (typeof row[key] !== 'string' || !row[key]) fail(`A merged row has no ${key}.`, 'CAPABILITY_DECLARATION_INVALID');
    if (seen.has(key + ':' + row[key])) fail(`Duplicate ${key} across the declaration and its imports.`, 'CAPABILITY_DECLARATION_INVALID');
    seen.set(key + ':' + row[key], true); } };
  unique(snapshot.scenarios, 'id'); unique(snapshot.authorities, 'id'); unique(snapshot.bindings, 'portId');
  unique(snapshot.transformations, 'id'); unique(snapshot.contracts, 'id'); unique(snapshot.interfaces, 'id');
  snapshot.scenarios.forEach((s, i) => { s.sourceRef = `graph:/scenarios/${i}`; });
  snapshot.authorities.forEach((a, i) => { a.sourceRef = `graph:/executionAuthorities/${i}`;
    a.operations.forEach((op, j) => { op.sourceRef = `graph:/executionAuthorities/${i}/operations/${j}`; }); });
  snapshot.bindings.forEach((b, i) => { b.sourceRef = `graph:/interfaceAuthority/portBindings/${i}`; });
  snapshot.transformations.forEach((t, i) => { t.sourceRef = `graph:/semanticTransformations/${i}`; });
  snapshot.contracts.forEach(c => { c.sourceRef = `graph:/contractAuthorities/contracts/${pointer(c.id)}`; });
  snapshot.interfaces.forEach((x, i) => { x.sourceRef = `graph:/interfaceAuthority/interfaces/${i}`; });
  if (imports.length) snapshot.provenance.imports = imports.map(i => ({ id: i.id, capabilityId: i.capabilityId,
    source: i.source, ...(i.sourceDigest ? { sourceDigest: i.sourceDigest } : {}), snapshotDigest: i.snapshotDigest, scenarios: i.scenarioIds ?? [] }));
  const { snapshotDigest: _discarded, ...body } = snapshot;
  snapshot.snapshotDigest = digest(body);
  // A declaration snapshot must survive its own JSON sidecar. Keys whose value
  // is undefined are dropped by JSON, so drop them before digesting; otherwise
  // the written snapshot.json would fail its own replay validation.
  return validateSnapshot(JSON.parse(JSON.stringify(snapshot)));
}
