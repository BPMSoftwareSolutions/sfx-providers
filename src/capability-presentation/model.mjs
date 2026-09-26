import { digest, fail } from './snapshot.mjs';

export const VIEWS = ['capability', 'scenario', 'event', 'mechanic', 'provider', 'physical'];
export const ALTITUDES = [
  ['Feature parse','What need and feature frame this capability?'],
  ['Capability meaning','Who needs the capability, for what purpose and outcome?'],
  ['Scenario inputs/events/outcomes','What enters, what happens, and what can leave?'],
  ['Contracts and schemas','What makes each input or outcome well formed?'],
  ['Semantic authority envelope','Which selected definitions establish the meaning?'],
  ['Transformation AST','How are declared values transformed?'],
  ['Execution authorities and ports','Which operations and calls form the circuit?'],
  ['Providers, bindings, overlays','Which provider or platform realizes each port?'],
  ['Interface and CLI display','How is the capability exposed to a person or caller?'],
  ['Fixtures and proof','What expectations and proof obligations are declared?'],
  ['Alignment evaluation','What evidence supports consistency across the layers?'],
].map(([name, question], i) => ({ altitude: i + 1, name, question }));
export const humanize = value => String(value || '').replace(/\.v\d+$/, '').replace(/[-_.:#/]+/g, ' ').replace(/\s+/g, ' ').trim();

export function buildContexts(s) {
  const evidence = [s.features, s.identity.intent || s.identity.actor || s.identity.outcome ? [s.identity] : [], s.scenarios,
    s.contracts, [s.identity], s.transformations, s.authorities, s.bindings, s.interfaces, [...s.fixtures, ...s.obligations], []];
  const facts = [
    s.features.length ? (s.features[0].sourceTitle||s.features[0].title||s.features[0].name) : 'No linked feature writeup was returned by the reader.',
    s.identity.intent || s.identity.experiencePromise || 'The selected capability version has no retained intent prose.',
    `${s.scenarios.length} scenarios; ${s.scenarios.filter(v=>v.authored?.steps.length).length} with authored steps; ${s.transitions.length} transitions.`,
    `${s.contracts.length} contracts with field types, required members and retained constraints.`,
    `Estate ${s.identity.estateModelId}; capability version ${s.identity.capabilityVersionPk}; selected definition ${s.identity.definitionPk}.`,
    `${s.transformations.length} transformations; ${s.transformations.reduce((n,t)=>n+t.nodeCount,0)} expression nodes.`,
    `${s.authorities.length} execution authorities; ${s.authorities.reduce((n,a)=>n+a.operations.length,0)} declared operations.`,
    `${s.bindings.length} port bindings in the selected interface authority.`,
    `${s.interfaces.length} interfaces with declared input, display and root selection.`,
    `${s.fixtures.length} fixture case(s); ${s.obligations.length} proof obligation(s). These are declarations, not test results.`,
    'Reference checks are derived; no alignment receipt was read.',
  ];
  const gaps=[
    [!s.features.length?'No linked feature returned':null,s.features.some(f=>!f.sourceText)?'Retained Gherkin bytes missing for a feature':null,s.features.some(f=>f.selectionSource&&f.versionBound===false)?'No version-owned feature binding returned':null],
    [!s.identity.actor?'Actor prose missing':null,!s.identity.intent?'Intent prose missing':null,!s.identity.experiencePromise?'Experience promise missing':null,s.identity.observableConditions?.some(c=>!c.statement&&!(s.conditions??[]).some(v=>v.id===c.id&&v.statement))?'An observable condition has no statement':null],
    [s.scenarios.some(sc=>!sc.authored?.steps.length)?'Authored Gherkin steps missing for a selected scenario':null],
    [s.contracts.some(c=>!c.fields)?'Field constraints absent from an older snapshot':null,'Schema defaults, example values and literal enum values are not projected'],
    [s.identity.declaredRootScenarioId&&s.identity.declaredRootScenarioId!==s.identity.rootScenarioId?'Authority root differs from graph root':null,'Authority selection is not an admission receipt'],
    [s.transformations.some(t=>!t.previewComplete)?'Expression diagrams collapse deeper operators':null,'Literal values are represented by type and digest'],
    [s.bindings.some(b=>b.selectors?.capabilityIdPath)?'Nested capability selection depends on runtime input':null,'Declared order does not establish an observed execution trace'],
    [s.bindings.some(b=>!b.providerIds.length)?'Some bindings name a platform without an explicit provider ID':null,'Provider qualification, binding scopes and overlay resolution outside graph_source are not queried'],
    [s.interfaces.some(i=>i.rootScenarioId&&!s.scenarios.some(sc=>sc.id===i.rootScenarioId))?'An interface root is absent from the graph':null],
    [!s.fixtures.length?'No linked fixture cases returned':null,!s.obligations.length?'No linked proof obligations returned':null,'Execution results and assertion values are not queried'],
    ['No alignment, reviewer decision or admission receipt queried','Reference consistency is not a semantic alignment evaluation'],
  ];
  return ALTITUDES.map((a, i) => {
    const catalog = s.altitudeCatalog.find(c => c.id.startsWith(`altitude-${a.altitude}-`) || c.name.match(new RegExp(`altitude ${a.altitude}:`, 'i')));
    return { ...a, catalogRef: catalog?.sourceRef ?? null, catalogName: catalog?.name ?? null,
      status: i === 10 ? 'derived' : evidence[i].length ? 'declared' : 'not-read', summary: facts[i],
      missingContext:gaps[i].filter(Boolean),
      evidenceRefs: evidence[i].map(e => e.sourceRef ?? e.meaningSourceRef ?? 'model:capability_version/' + s.identity.capabilityVersionPk) };
  });
}

export function buildCircuitModel(s, view) {
  if (!VIEWS.includes(view)) fail('Unsupported semantic view.');
  const nodes = [], edges = [], findings = contextFindings(s);
  if(s.graphFeatures?.edgeGroups.length||s.graphFeatures?.dispatchAuthorities.length)findings.push({code:'ADVANCED_GRAPH_POLICY_RETAINED',message:'Dispatch and edge-group policies are retained as IDs and digests; this declaration view does not simulate arbitration or execution.'});
  const byId = new Map();
  function node(id, label, kind, ref, extra = {}) {
    if (!byId.has(id)) { const n = { id, label, kind, ref, ...extra }; nodes.push(n); byId.set(id, n); }
    return id;
  }
  const edge = (from, to, relation, ref, label = '') => edges.push({ id: `edge:${edges.length + 1}`, from, to, relation, ref, label });
  const scenario = id => node('scenario:' + id, s.scenarios.find(v => v.id === id)?.name ?? id, 'scenario', s.scenarios.find(v => v.id === id)?.sourceRef ?? '', { missing: !s.scenarios.some(v => v.id === id) });
  if (view === 'scenario' || view === 'capability') {
    for (const sc of s.scenarios) scenario(sc.id);
    for (const t of s.transitions) {
      edge(scenario(t.from), scenario(t.to), 'transition', t.sourceRef, t.variant || t.topologyKind);
      edges.at(-1).classification=s.scenarios.find(s=>s.id===t.from)?.variants.find(v=>v.id===t.variant)?.classification??'unspecified';
    }
    for (const a of s.authorities) for (const op of a.operations) if (op.kind === 'invoke-scenario') edge(scenario(a.scenarioId), scenario(op.scenarioId), 'invocation', op.sourceRef, `call ${op.ordinal}`);
  } else if (view === 'mechanic' || view === 'event') {
    for (const a of s.authorities) {
      const parent = scenario(a.scenarioId);
      let prior;
      for (const op of a.operations) {
        const id = node('operation:' + a.id + ':' + op.ordinal, op.portId || op.scenarioId || op.id, 'operation', op.sourceRef, { operationKind: op.kind, ordinal: op.ordinal });
        if (!prior) edge(parent, id, 'authority', a.sourceRef, a.id);
        else edge(prior, id, 'order', op.sourceRef, 'declared order');
        prior = id;
        const b = s.bindings.find(b => b.portId === op.portId);
        if (op.kind === 'invoke-scenario') edge(id, scenario(op.scenarioId), 'invocation', op.sourceRef, 'call');
        if (b?.transformationId && view==='mechanic') {
          const t = s.transformations.find(t => t.id === b.transformationId);
          const transform = node('transform:' + b.transformationId, b.transformationId, 'transformation', t?.sourceRef ?? b.sourceRef, { missing: !t, nodeCount: t?.nodeCount ?? 0 });
          edge(id, transform, 'binding', b.sourceRef, 'transformation');
          if(t)for(const m of t.preview){
            const mechanic=node(`mechanic:${t.id}:${m.path}`,m.op,'mechanic',t.sourceRef+m.path,{expressionPath:m.path,transformationId:t.id});
            edge(m.parent?`mechanic:${t.id}:${m.parent}`:transform,mechanic,'expression',t.sourceRef+m.path,m.path.split('/').at(-1));
          }
        }
      }
    }
  } else {
    // Group multiple operations sharing a port without inventing a separate
    // physical provider for each occurrence. Include retained unused bindings.
    const used = new Set(s.authorities.flatMap(a => a.operations.map(o => o.portId).filter(Boolean)));
    for (const b of s.bindings) {
      const port = node('port:' + b.portId, b.portId, 'port', b.sourceRef, { used: used.has(b.portId) });
      const platform = node('platform:' + b.platformCapabilityId, b.platformCapabilityId || 'Unresolved platform binding', 'provider', b.sourceRef, { missing: !b.platformCapabilityId });
      edge(port, platform, 'binding', b.sourceRef, 'declared binding');
      if (view === 'physical') {
        for (const e of b.endpoints) {
          const endpoint = node('endpoint:' + e.origin + e.path, e.origin + e.path, 'endpoint', b.sourceRef + '/configuration' + e.sourcePointer);
          edge(platform, endpoint, 'physical', b.sourceRef, 'declared destination');
        }
        for (const r of b.realizations.filter(r => r.field !== 'method')) {
          const realization = node(`realization:${r.field}:${r.value}`, `${r.field}: ${r.value}`, 'physical', b.sourceRef + '/configuration' + r.sourcePointer);
          edge(platform, realization, 'physical', b.sourceRef, 'declared metadata');
        }
      } else for (const providerId of b.providerIds) {
        edge(platform, node('provider:' + providerId, providerId, 'provider', b.sourceRef), 'provider-selection', b.sourceRef, 'declared provider');
      }
    }
    for (const portId of used) if (!s.bindings.some(b => b.portId === portId)) node('port:' + portId, portId, 'port', '', { missing: true, used: true });
    if (view === 'physical' && !nodes.some(n => ['endpoint','physical'].includes(n.kind))) findings.push({ code: 'PHYSICAL_REALIZATION_NOT_READ', message: 'No physical destination or host realization metadata was returned. Platform declarations remain visible.' });
  }
  for (const n of nodes) if (n.missing) findings.push({ code: 'UNRESOLVED_REFERENCE', nodeId: n.id, message: n.label });
  if(view==='mechanic'){
    // Shared transformations produce one expression subcircuit and retain all
    // incoming binding edges; avoid repeated expression edges from every call.
    const keys=new Set();
    for(let i=edges.length-1;i>=0;i--){const e=edges[i],key=JSON.stringify([e.from,e.to,e.relation,e.ref]);if(keys.has(key))edges.splice(i,1);else keys.add(key);}
    const collapsed=s.transformations.filter(t=>!t.previewComplete&&byId.has('transform:'+t.id));
    if(collapsed.length)findings.push({code:'EXPRESSION_SUBCIRCUITS_COLLAPSED',message:`${collapsed.length} expressions extend below the three-level diagram preview. Complete operator counts and expression digests are retained in the snapshot.`,transformationIds:collapsed.map(t=>t.id)});
  }
  const scenarioEdges = [...s.transitions.map(t => [t.from,t.to]), ...s.authorities.flatMap(a => a.operations.filter(o => o.kind === 'invoke-scenario').map(o => [a.scenarioId,o.scenarioId]))];
  const reachable = new Set([s.identity.rootScenarioId]);
  for (let changed = true; changed;) { changed = false; for (const [a,b] of scenarioEdges) if (reachable.has(a) && !reachable.has(b)) {reachable.add(b); changed = true;} }
  const unconnected = s.scenarios.filter(sc => !reachable.has(sc.id)).map(sc => sc.id);
  if (unconnected.length) findings.push({ code: 'SCENARIOS_WITHOUT_DECLARED_ROOT_PATH', scenarioIds: unconnected, message: 'Retained scenarios without a transition or invocation path from the selected root.' });
  for (const n of nodes) if (n.kind === 'scenario') n.reachable = reachable.has(n.id.slice(9));
  edges.forEach((e,i)=>{e.id=`edge:${i+1}`;});
  return { view, nodes, edges, findings, digest: digest({ nodes, edges }) };
}

export function structuralChecks(s) {
  const ports = new Set(s.bindings.map(b => b.portId)), contracts = new Set(s.contracts.map(c => c.id)), scenarios = new Set(s.scenarios.map(s => s.id)), authorities = new Set(s.authorities.map(a => a.id));
  const missingPorts = [...new Set(s.authorities.flatMap(a => a.operations.filter(o => o.kind === 'invoke-port' && !ports.has(o.portId)).map(o => o.portId)))];
  const missingContracts = [...new Set(s.scenarios.flatMap(sc => [sc.inputContractId,sc.outcomeContractId]).filter(id => id && !contracts.has(id)))];
  const missingCalls = [...new Set(s.authorities.flatMap(a => a.operations.filter(o => o.kind === 'invoke-scenario' && !scenarios.has(o.scenarioId)).map(o => o.scenarioId)))];
  return [
    { label: 'Scenario authority references', missing: s.scenarios.filter(sc => !authorities.has(sc.authorityId)).map(sc => sc.id) },
    { label: 'Port binding references', missing: missingPorts },
    { label: 'Scenario call references', missing: missingCalls },
    { label: 'Scenario contract references', missing: missingContracts },
    ...contextFindings(s).map(f=>({label:f.label,status:'gap',detail:f.message,sourceRef:f.sourceRef})),
    { label: 'Execution testimony', status: 'not-read', detail: 'This presentation does not invoke the capability.' },
    { label: 'Estate alignment decision', status: 'not-read', detail: 'No alignment receipt was queried.' },
  ].map(c => ({ ...c, status: c.status ?? (c.missing.length ? 'gap' : 'resolved') }));
}

export function contextFindings(s) {
  const findings=[],add=(code,label,message,sourceRef)=>findings.push({code,label,message,sourceRef});
  for(const f of s.features){
    if(f.selectionSource&&f.versionBound===false)add('FEATURE_VERSION_BINDING_NOT_READ','Feature version binding',`Feature ${f.id} is selected through the capability identity; no version-owned binding was returned.`,f.sourceRef);
    if(f.scenarios?.length){
      const owned=s.scenarios.filter(sc=>sc.owned!==false),declared=f.scenarios;
      const missing=owned.filter(sc=>!declared.some(d=>d.id===sc.id&&d.versionPk===sc.versionPk));
      const extra=declared.filter(d=>!owned.some(sc=>sc.id===d.id&&sc.versionPk===d.versionPk));
      if(missing.length||extra.length)add('FEATURE_SCENARIO_SELECTION_DIFFERS','Feature and graph scenarios',`Feature versions: ${declared.map(d=>`${d.id}@${d.versionPk}`).join(', ')}. Selected owned scenarios: ${owned.map(d=>`${d.id}@${d.versionPk}`).join(', ')}.`,f.sourceRef);
      const raw=f.sourceText?.replace(/\s+/g,' ');
      if(raw&&declared.some(d=>d.steps?.some(step=>!raw.includes(step.text.replace(/\s+/g,' ')))))add('FEATURE_PROSE_DIFFERS_FROM_SOURCE','Parsed and retained Gherkin',`Parsed scenario prose for ${f.id} differs from its retained source bytes. Both are preserved.`,f.sourceRef);
    }
  }
  if(s.identity.declaredRootScenarioId&&s.identity.declaredRootScenarioId!==s.identity.rootScenarioId)
    add('AUTHORITY_GRAPH_ROOT_DIFFERS','Authority and graph roots',`Authority root: ${s.identity.declaredRootScenarioId}. Graph root: ${s.identity.rootScenarioId}.`,s.identity.meaningSourceRef);
  for(const i of s.interfaces)if(i.rootScenarioId&&!s.scenarios.some(sc=>sc.id===i.rootScenarioId))add('INTERFACE_ROOT_NOT_IN_GRAPH','Interface root reference',`Interface ${i.id} names ${i.rootScenarioId}; that scenario is absent from the selected graph.`,i.sourceRef);
  return findings;
}
