import { createHash } from 'node:crypto';
import {json,gherkinScenario,featureContext,schemaContext,bindingContext,interfaceContext} from './context-evidence.mjs';

export const SNAPSHOT_ID = 'capability-presentation-snapshot.v1';
export const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
export const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const str = value => typeof value === 'string' ? value : value == null ? '' : String(value);
const list = value => Array.isArray(value) ? value : [];
const compact = value => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
const variants = value => list(value).map(v => typeof v === 'string' ? { id: v, classification: 'unspecified' }
  : { id: str(v.variantId), classification: str(v.classification || 'unspecified') });
export const fail = (message, code = 'CAPABILITY_PRESENTATION_INVALID') => { throw Object.assign(new Error(message), { code }); };
const pointer = value => str(value).replaceAll('~','~0').replaceAll('/','~1');

function mechanics(expression) {
  const counts = {}, preview = [], inputPaths=[], cells=[];
  let count = 0, branchCount = 0;
  const walk = (value, path, parent, depth) => {
    if (!value || typeof value !== 'object') return;
    // Literal payloads are data, even if they contain an "op" member.
    if (typeof value.op === 'string') {
      count++; counts[value.op] = (counts[value.op] ?? 0) + 1;
      cells.push({path,parent,op:value.op,operand:parent===null?'root':path.slice(parent.length+1),
        ...(value.op==='path'&&typeof value.path==='string'?{inputPath:value.path}:{}),
        ...(value.op==='literal'?{literalType:value.value===null?'null':Array.isArray(value.value)?'array':typeof value.value}:{}),
        ...(value.op==='object'?{outputFields:Object.keys(value.fields??{})}:{})});
      if(value.op==='path'&&typeof value.path==='string')inputPaths.push({expressionPath:path,inputPath:value.path});
      if (['if','switch','case','match','coalesce'].includes(value.op)) branchCount++;
      if (depth < 3 && preview.length < 40) preview.push({ path, parent, op: value.op,
        ...(value.op==='path'&&typeof value.path==='string'?{inputPath:value.path}:{}),
        ...(value.op==='literal'?{literalType:value.value===null?'null':Array.isArray(value.value)?'array':typeof value.value}:{}),
        ...(value.op==='object'?{outputFields:Object.keys(value.fields??{})}:{}) });
      if (value.op === 'literal') return;
      parent = path; depth++;
    }
    for (const [key, child] of Object.entries(value)) if (key !== 'op') walk(child, path + '/' + pointer(key), parent, depth);
  };
  walk(expression, '/expression', null, 0);
  return { nodeCount: count, branchCount, operatorCounts: counts, preview,inputPaths,cells,
    previewComplete: preview.length === count, expressionDigest: digest(expression ?? null) };
}

function physicalFields(config) {
  const providers = new Set(), endpoints = [], credentials = new Set(), realizations = [];
  // Selected declaration metadata only. Never retain SQL text, request headers,
  // bodies, arbitrary literal values, access tokens, or connection strings.
  const walk = (value, path = '', depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 12) return;
    for (const [key, child] of Object.entries(value)) {
      const at = path + '/' + pointer(key);
      if (['providerId','providerProfileId'].includes(key) && typeof child === 'string') providers.add(child);
      if (['credentialReference','referenceName','credentialReferenceName'].includes(key) && typeof child === 'string') credentials.add(child);
      if (['endpoint','url','baseUrl','origin','host','hostname','allowedOrigin','allowedHost','urlPrefixes','allowedOrigins','allowedHosts'].includes(key)) for(const [i,address] of (Array.isArray(child)?child:[child]).entries()) {
        if(typeof address !== 'string') continue;
        try { const u = new URL(address.includes('://') ? address : 'https://' + address);
          if (['https:','http:'].includes(u.protocol) && !u.username && !u.password)
            endpoints.push({ sourcePointer: at+(Array.isArray(child)?'/'+i:''), origin: u.origin, path: u.pathname, selector: key });
        } catch { /* non-URL selector; do not invent a destination */ }
      }
      if (['module','export','language','runtime','target','targetId','method'].includes(key) && typeof child === 'string') realizations.push({ field: key, value: child, sourcePointer: at });
      if (!/secret|token|password|header|body|statement|expression/i.test(key)) walk(child, at, depth + 1);
    }
  };
  walk(config);
  return { providerIds: [...providers].sort(), endpoints, credentialReferences: [...credentials].sort(), realizations };
}

export function normalizeSnapshot({ capability: c, graph: g, scenarios = [], features = [], fixtures = [], obligations = [], altitudeCatalog = [], conditions = [], blueprintSources = [], provenance = {} }) {
  if (g.declaredExecutionGraphRefused) fail(g.declaredExecutionGraphRefused, 'CAPABILITY_GRAPH_REFUSED');
  if (c.capability_id !== g.capabilityId) fail('The graph and selected capability identity disagree.');
  const declared = c.definition_json ? JSON.parse(c.definition_json)?.semantics?.authority ?? {} : {};
  const scenarioRows = new Map();
  for (const row of scenarios) {
    if (scenarioRows.has(row.scenario_id)) fail('Multiple selected versions share a scenario ID; a qualified graph is required.');
    scenarioRows.set(row.scenario_id, row);
  }
  const outcomeMap = new Map(list(g.scenarioOutcomes).map(o => [o.scenarioId, variants(o.variants)]));
  const authorities = list(g.executionAuthorities).map((a, index) => ({
    id: a.id, scenarioId: a.owningScenarioId ?? list(g.scenarios).find(s => s.event?.executionAuthorityId === a.id)?.scenarioId ?? '',
    sourceRef: `graph:/executionAuthorities/${index}`, digest: digest(a),
    operations: list(a.operations).map((op, i) => compact({ id: op.operationId ?? `${a.id}#${i + 1}`, ordinal: i + 1,
      kind: op.kind, portId: op.portId, scenarioId: op.scenarioId, outcomeContractId: op.outcomeContractId,
      variants: variants(op.outcomeVariants), digest: digest(op), sourceRef: `graph:/executionAuthorities/${index}/operations/${i}` })),
  }));
  const snapshot = {
    contractId: SNAPSHOT_ID,
    identity: { capabilityId: c.capability_id, namespaceId: c.namespace_id, estateModelId: str(c.estate_model_pk),
      capabilityPk: str(c.capability_pk), capabilityVersionPk: str(c.capability_version_pk), definitionPk: str(c.definition_pk), definitionDigest: str(c.definition_digest),
      name: str(c.name || declared.name || c.capability_id), actor: str(c.actor || declared.userStory?.actor), intent: str(c.intent || declared.userStory?.intent), outcome: str(c.outcome || declared.userStory?.outcome), experiencePromise: str(c.experience_promise || declared.experience?.promise), rootScenarioId: g.rootScenarioId,
      declaredRootScenarioId:str(declared.rootScenarioId),mode:str(declared.mode),experienceId:str(declared.experience?.experienceId),
      observableConditions:list(declared.experience?.observableConditions).map(v=>({id:str(v.conditionId),statement:str(v.statement)})),
      meaningSourceRef: `model:semantic_object_definition/${c.definition_pk}/semantics/authority` },
    provenance: { ...provenance, graphDigest: digest(g), selection: 'current estate capability version and its declared scenario closure' },
    scenarios: list(g.scenarios).map((s, i) => {
      const row = scenarioRows.get(s.scenarioId) ?? {};
      return { id: s.scenarioId, name: str(row.name || s.scenarioId), versionPk: str(row.scenario_version_pk), definitionDigest: str(row.definition_digest),
        authorityId: str(s.event?.executionAuthorityId), eventId: str(s.event?.eventId), inputId: str(s.input?.inputId), inputContractId: str(s.input?.contract?.contractId),
        outcomeId: str(s.outcome?.outcomeId), outcomeContractId: str(s.outcome?.contract?.contractId), terminal: s.outcome?.terminal === true,
        variants: outcomeMap.get(s.scenarioId) ?? [], owned:row.owned==null?null:Boolean(row.owned),
        authored:gherkinScenario(json(row.definition_json).semantics?.scenario),
        inputDescription:str(row.input_name),eventDescription:str(row.responsibility||row.event_name),outcomeDescription:str(row.experience||row.outcome_name),terminalDisposition:str(row.terminal_disposition),
        meaningSourceRef:row.scenario_version_pk?`model:scenario_version/${row.scenario_version_pk}`:'',sourceRef: `graph:/scenarios/${i}` };
    }),
    transitions: list(g.transitions).map((t, i) => ({ id: t.transitionId ?? `transition:${i}`, from: t.from?.scenarioId, to: t.to?.scenarioId,
      variant: str(t.selectsVariant), topologyKind: str(t.topologyKind), bindingAuthorityId: str(t.bindingAuthorityId),
      semanticProgress:str(t.semanticProgress),contractRelation:str(t.contractRelation),
      digest: digest(t), sourceRef: `graph:/transitions/${i}` })),
    authorities,
    bindings: list(g.interfaceAuthority?.portBindings).map((b, i) => ({ portId: b.portId, platformCapabilityId: str(b.platformCapabilityId),
      transformationId: str(b.configuration?.transformationId), configurationDigest: digest(b.configuration ?? {}),
      ...physicalFields(b.configuration ?? {}),...bindingContext(b.configuration), sourceRef: `graph:/interfaceAuthority/portBindings/${i}` })),
    transformations: list(g.semanticTransformations).map((t, i) => ({ id: t.id, ...mechanics(t.expression), sourceRef: `graph:/semanticTransformations/${i}` })),
    contracts: Object.entries(g.contractAuthorities?.contracts ?? {}).map(([id, c]) => ({ id, schemaId: str(c.schemaId || c.schema?.$id),
      title: str(c.schema?.title || id), type: str(c.schema?.type), required: list(c.schema?.required), properties: Object.keys(c.schema?.properties ?? {}),
      ...schemaContext(c.schema),schemaDigest: digest(c.schema ?? {}), sourceRef: `graph:/contractAuthorities/contracts/${pointer(id)}` })),
    interfaces: list(g.interfaceAuthority?.interfaces).map((i, n) => ({ id: str(i.interfaceId ?? i.id ?? `interface:${n}`),
      profile: str(i.profile ?? i.kind ?? i.interfaceType), configurationDigest: digest(i.configuration ?? {}),
      configurationKeys: Object.keys(i.configuration ?? {}),...interfaceContext(i), sourceRef: `graph:/interfaceAuthority/interfaces/${n}` })),
    features: features.map(f => ({ id: f.feature_id, name: str(f.name), role: str(f.binding_role), versionPk: str(f.feature_version_pk),
      definitionDigest: str(f.definition_digest),...featureContext(f), sourceRef: `model:feature_version/${f.feature_version_pk}` })),
    fixtures: fixtures.map(f => ({ id: f.fixture_id, caseId: str(f.case_id), expectedDisposition: str(f.expected_disposition), assertionCount: Number(f.assertion_count),
      assertions:list(json(f.assertions_json,[])).map(a=>({ordinal:a.ordinal,conditionId:str(a.condition_id),path:str(a.path),operator:str(a.operator),expectedDigest:str(a.expected_digest)})),
      definitionDigest: str(f.definition_digest), sourceRef: `model:fixture/${f.semantic_object_definition_pk}/${pointer(f.case_id)}` })),
    obligations: obligations.map(o => ({ id: o.proof_obligation_id, statement: str(o.statement), kind: str(o.obligation_kind), definitionDigest: str(o.definition_digest), sourceRef: `model:proof_obligation/${o.semantic_object_definition_pk}` })),
    altitudeCatalog: altitudeCatalog.map(a => ({ id: a.scenario_id, name: str(a.name), definitionDigest: str(a.definition_digest), sourceRef: `model:scenario_version/${a.scenario_version_pk}` })),
    conditions:conditions.map(v=>({id:str(v.condition_id),statement:str(v.statement),definitionDigest:str(v.definition_digest),sourceRef:`model:observable_condition/${v.semantic_object_definition_pk}`})),
    contextReaderVersion:'feature-prose-and-altitudes.v2',
    blueprintSources:blueprintSources.map(b=>({id:str(b.blueprint_id),versionPk:str(b.blueprint_version_pk),
      capabilityVersionPk:str(b.capability_version_pk),disposition:str(b.source_disposition),
      nodeCount:Number(b.node_count),edgeCount:Number(b.edge_count),definitionDigest:str(b.definition_digest),
      sourceRef:`model:blueprint_version/${b.blueprint_version_pk}`})),
    graphFeatures: { graphType: str(g.graphType || 'legacy declaration'), requiredExecutionFeatures: list(g.requiredExecutionFeatures),
      edgeGroups: list(g.edgeGroups).map((e, i) => ({ id: str(e.edgeGroupId ?? e.id ?? i), digest: digest(e), sourceRef: `graph:/edgeGroups/${i}` })),
      dispatchAuthorities: list(g.dispatchAuthorities).map((d, i) => ({ id: str(d.id ?? i), digest: digest(d), sourceRef: `graph:/dispatchAuthorities/${i}` })) },
  };
  snapshot.snapshotDigest = digest(snapshot);
  return validateSnapshot(snapshot);
}

export function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.contractId !== SNAPSHOT_ID) fail('Expected a capability-presentation-snapshot.v1 snapshot.');
  const { snapshotDigest, ...body } = snapshot;
  if (!/^[a-f0-9]{64}$/.test(snapshotDigest ?? '') || digest(body) !== snapshotDigest) fail('Snapshot digest does not match its data.');
  if (!body.identity?.capabilityId || !body.identity?.rootScenarioId) fail('Snapshot identity and root scenario are required.');
  for (const key of ['scenarios','transitions','authorities','bindings','transformations','contracts','interfaces','features','fixtures','obligations','altitudeCatalog']) {
    if (!Array.isArray(body[key]) || body[key].length > 10000) fail(`Invalid snapshot collection: ${key}`);
  }
  for (const [rows, key] of [[body.scenarios,'id'],[body.authorities,'id'],[body.bindings,'portId'],[body.transformations,'id'],[body.contracts,'id']]) {
    if (rows.some(r => !r || typeof r[key] !== 'string' || !r[key]) || new Set(rows.map(r => r[key])).size !== rows.length) fail(`Duplicate or missing ${key} in snapshot.`);
  }
  if (!body.scenarios.some(s => s.id === body.identity.rootScenarioId)) fail('Root scenario is not present.');
  if (Buffer.byteLength(JSON.stringify(snapshot)) > 8 * 1024 * 1024) fail('Compact snapshot exceeds 8 MiB.');
  return snapshot;
}
