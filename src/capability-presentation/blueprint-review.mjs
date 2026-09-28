// These are projection diagnostics, not an estate admission verdict. Findings
// name the source and visible components; missing evidence is not called failure.
import {inspectInvocationPaths} from './invocation-evidence.mjs';
import {inspectBoundaries} from './boundary-inspection.mjs';
export function reviewBlueprint(snapshot,model){
 const issues=[];
 const add=(severity,code,message,nodeIds=[],refs=[])=>issues.push({id:`R${String(issues.length+1).padStart(2,'0')}`,severity,code,message,nodeIds,sourceRefs:refs.filter(Boolean)});
 const scenarios=new Map(snapshot.scenarios.map(s=>[s.id,s]));
 const reachable=new Set([snapshot.identity.rootScenarioId]);let changed=true;
 while(changed){changed=false;for(const sc of [...reachable]){
  const a=snapshot.authorities.find(a=>a.id===scenarios.get(sc)?.authorityId);
  const targets=[...(a?.operations.filter(o=>o.kind==='invoke-scenario').map(o=>o.scenarioId)??[]),...snapshot.transitions.filter(t=>t.from===sc).map(t=>t.to)];
  for(const target of targets)if(scenarios.has(target)&&!reachable.has(target)){reachable.add(target);changed=true;}
 }}
 for(const sc of snapshot.scenarios){
  const a=snapshot.authorities.find(a=>a.id===sc.authorityId);
  if(!reachable.has(sc.id))add('warning','SCENARIO_DISCONNECTED','No declared call or transition from the selected root reaches this scenario.',['event:'+sc.id],[sc.sourceRef]);
  if(!a?.operations.length)add('error','EXECUTION_AUTHORITY_EMPTY','No execution path is available for this Event. A completion wire cannot establish its Outcome.',['event:'+sc.id],[sc.sourceRef]);
 }
 for(const r of model.references??[])add(r.code==='RUNTIME_TARGET_UNRESOLVED'?'warning':'error',r.code,r.code==='RUNTIME_TARGET_UNRESOLVED'?`The target is selected from ${r.targetId}; no executed capability is identified.`:`The reference ${r.targetId} has no retained target declaration.`,r.nodeIds,[r.sourceRef]);
 for(const n of model.nodes){
  if(n.missing)add('error',n.kind==='binding'?'PORT_BINDING_MISSING':'TARGET_OR_AUTHORITY_MISSING','A referenced binding, target or owning authority is absent.',[n.id],[n.ref]);
  if(n.kind==='binding'&&n.used===false)add('warning','BINDING_NOT_INVOKED',`Binding ${n.portId} has no invoking operation in the selected graph.`,[n.id],[n.ref]);
  if(n.kind==='binding'&&n.used&&n.endpoints?.length&&!n.providerIds?.length){
   const ops=model.nodes.filter(op=>op.kind==='operation'&&op.portId===n.portId);
   add('warning','ENDPOINT_BINDING_WITHOUT_PROVIDER_ID',`Binding ${n.portId} declares an endpoint but no provider identity. A provider named by a route transformation does not establish this exchange binding's ownership.`,[n.id,...ops.map(op=>op.id)],[n.ref]);
  }
  if(n.kind==='dynamic')add('warning','RUNTIME_TARGET_UNRESOLVED',`The target is selected from ${n.selector}; this source does not identify the executed capability.`,[n.id],[n.ref]);
 }
 for(const a of snapshot.authorities)for(const op of a.operations){
  const id=`operation:${a.id}:${op.ordinal}`;
  if(op.kind==='invoke-scenario'&&op.scenarioId===a.scenarioId)add('error','SELF_CALL_BOUND_NOT_RETAINED','This responsibility calls its own scenario. No bounded-return authority was retained.',[id,'event:'+a.scenarioId],[op.sourceRef]);
 }
 for(const t of snapshot.transitions){
  if(/select|branch/i.test(t.topologyKind)&&!t.variant)add('error','BRANCH_SELECTOR_MISSING','A branch route has no selecting outcome variant.',['outcome:'+t.from],[t.sourceRef]);
  if(t.variant&&!scenarios.get(t.from)?.variants.some(v=>v.id===t.variant))add('error','BRANCH_VARIANT_UNDECLARED','The route selects a variant absent from its source scenario.',['outcome:'+t.from],[t.sourceRef]);
 }
 for(const gap of model.coverage.gaps.filter(g=>!['SELF_CALL_BOUND_NOT_RETAINED','EXECUTION_AUTHORITY_EMPTY'].includes(g.code)))add('warning',gap.code,{
  CANONICAL_BLUEPRINT_EDGES_NOT_AVAILABLE:'No selected canonical blueprint with edge records was returned. Operation order is not a proof of complete canonical semantics.',
  ADVANCED_ROUTING_NOT_PROJECTED:'Advanced routing declarations are retained as digests; their paths are not expanded by this projection.',
  OBSERVABILITY_CONTRACT_NOT_RETAINED:'The reader did not retain a per-cell observation contract. Runtime state is separate and unobserved.',
  MONOTONIC_PROGRESS_NOT_PROVEN:'No complete semantic-progress proof was retained. Forward placement must not imply proven monotonicity.'
  ,TRANSFORMATION_PROVIDER_REFERENCES_NOT_RETAINED:'This snapshot predates transformation provider inspection. Refresh it from the estate to establish provider coverage.'
 }[gap.code]??gap.code,[],gap.ref?[gap.ref]:[]);
 for(const n of model.nodes){
  if(n.kind!=='binding'||!n.used||!n.platformCapabilityId)continue;
  if(n.declaredRead||n.providerIds?.length||n.transformationId)continue;
  // A platform catalog link is declaration evidence, not a binding-specific
  // installation or execution receipt. It must never silence this finding.
  const declarations=(snapshot.platformImplementations??[]).flatMap((p,i)=>p.platformCapabilityId===n.platformCapabilityId?[{...p,sourceRef:`snapshot:/platformImplementations/${i}`}]:[]);
  const ops=model.nodes.filter(op=>op.kind==='operation'&&op.portId===n.portId);
  add('warning','PLATFORM_BINDING_WITHOUT_PROVIDER',`Binding ${n.portId} names ${n.platformCapabilityId} but has no binding-level statement, provider identity or transformation. ${declarations.length} platform implementation declaration(s) do not prove installation or binding compatibility; execution is unverified.`,[n.id,...ops.map(op=>op.id)],[n.ref,...declarations.map(p=>p.sourceRef)]);
  issues.at(-1).evidence={bindingAssociation:'not-retained',platformDeclaration:declarations.length?'declared':'not-retained',installation:'not-verified',configurationCompatibility:'not-verified',execution:'not-observed',platformDeclarations:declarations};
 }
 if(snapshot.bindings.some(b=>!Object.hasOwn(b,'invocationCondition'))||snapshot.transformations.some(t=>!t.resultShape))
  add('warning','INVOCATION_CONDITION_EVIDENCE_NOT_RETAINED','This snapshot predates invocation-condition and output-shape inspection. Refresh it before assessing guarded invocation paths.');
 if(snapshot.bindings.some(b=>!Object.hasOwn(b,'nestedInvocation'))||snapshot.contracts.some(c=>!Object.hasOwn(c,'emptyObjectEvidence')))
  add('warning','BOUNDARY_INSPECTION_EVIDENCE_NOT_RETAINED','This snapshot lacks nested handoff or display-totality evidence. Refresh it before assessing these boundaries.');
 for(const finding of [...inspectInvocationPaths(snapshot),...inspectBoundaries(snapshot)]){
  add(finding.severity,finding.code,finding.message,finding.nodeIds,finding.sourceRefs);
  issues.at(-1).evidence=finding.evidence;
 }
 return {contractId:'capability-blueprint-review.v1',signal:issues.some(i=>i.severity==='error')?'ISSUES_FOUND':issues.length?'EVIDENCE_INCOMPLETE':'NO_DETECTED_ISSUES',
  isAdmissionReceipt:false,errors:issues.filter(i=>i.severity==='error').length,warnings:issues.filter(i=>i.severity==='warning').length,issues};
}
