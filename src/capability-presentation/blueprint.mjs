import {digest} from './snapshot.mjs';
import {reviewBlueprint} from './blueprint-review.mjs';
export {layoutBlueprint,appendBlueprintSlides} from './blueprint-sheet.mjs';

// Retain declarations once. Geometry, diagnostic state and testimony are not
// authority. Derived relationships name their basis and keep the source pointer.
export function buildBlueprint(s){
 const nodes=[],edges=[],scenarios=[],references=[],byId=new Map();
 const add=(id,kind,label,ref,extra={})=>{if(!byId.has(id)){const n={id,kind,label,ref,...extra};nodes.push(n);byId.set(id,n);}return id;};
 const wire=(from,to,kind,ref,label='',extra={})=>{if(byId.has(from)&&byId.has(to))edges.push({id:`B${edges.length+1}`,from,to,kind,ref,label,...extra});};
 for(const sc of s.scenarios){
  const a=s.authorities.find(a=>a.id===sc.authorityId);
  scenarios.push({...sc,ref:sc.sourceRef,root:sc.id===s.identity.rootScenarioId,operationIds:(a?.operations??[]).map(op=>`operation:${a.id}:${op.ordinal}`)});
  add('scenario:'+sc.id,'scenario',sc.name,sc.sourceRef,{scenarioId:sc.id});
  if(sc.inputId)add('input:'+sc.id,'input',sc.inputId,sc.sourceRef,{scenarioId:sc.id,description:sc.inputDescription,contractId:sc.inputContractId});
  if(sc.eventId||sc.authorityId)add('event:'+sc.id,'event',sc.eventId||sc.authorityId,sc.sourceRef,{scenarioId:sc.id,description:sc.eventDescription,authorityId:sc.authorityId});
  if(sc.outcomeId)add('outcome:'+sc.id,sc.terminal?'terminal':'outcome',sc.outcomeId,sc.sourceRef,{scenarioId:sc.id,description:sc.outcomeDescription,contractId:sc.outcomeContractId});
  wire('input:'+sc.id,'event:'+sc.id,'semantic-input',sc.sourceRef,'Given → When',{basis:'scenario semantic positions'});
  wire('event:'+sc.id,'outcome:'+sc.id,'semantic-outcome',sc.sourceRef,'When → Then',{basis:'scenario semantic positions; not an execution receipt'});
  for(const v of sc.variants){add(`variant:${sc.id}:${v.id}`,'variant',v.id,sc.sourceRef,{scenarioId:sc.id,classification:v.classification});wire('outcome:'+sc.id,`variant:${sc.id}:${v.id}`,'variant',sc.sourceRef,v.id,{basis:'variant membership',classification:v.classification});}
 }
 for(const a of s.authorities){let prior;
  const owners=s.scenarios.filter(sc=>sc.authorityId===a.id).map(sc=>sc.id);
  for(const op of a.operations){
   const id=add(`operation:${a.id}:${op.ordinal}`,'operation',op.portId||op.scenarioId||op.kind,op.sourceRef,{semanticId:op.id,scenarioId:owners[0],scenarioIds:owners,authorityId:a.id,operationKind:op.kind,ordinal:op.ordinal,portId:op.portId,targetScenarioId:op.scenarioId,variants:op.variants??[]});
   if(prior)wire(prior,id,'sequence',op.sourceRef,'declared operation order',{basis:'ordered execution authority; canonical routing not established'});prior=id;
   if(op.kind==='invoke-port'){
    add('port:'+op.portId,'port',op.portId,op.sourceRef,{portId:op.portId});
    wire(id,'port:'+op.portId,'port',op.sourceRef,'invokes port');
    if(!s.bindings.some(b=>b.portId===op.portId))references.push({code:'PORT_BINDING_MISSING',nodeIds:[id,'port:'+op.portId],sourceRef:op.sourceRef,targetId:op.portId});
   }
   if(op.kind==='invoke-scenario'){
    if(byId.has('scenario:'+op.scenarioId))wire(id,'scenario:'+op.scenarioId,'call',op.sourceRef,'call',{targetScenarioId:op.scenarioId});
    else references.push({code:'TARGET_OR_AUTHORITY_MISSING',nodeIds:[id],sourceRef:op.sourceRef,targetId:op.scenarioId});
   }
  }
 }
 for(const t of s.transitions){
  if(byId.has('scenario:'+t.from)&&byId.has('scenario:'+t.to))wire('scenario:'+t.from,'scenario:'+t.to,'transition',t.sourceRef,t.variant||t.topologyKind,{transitionId:t.id,topologyKind:t.topologyKind,semanticProgress:t.semanticProgress,contractRelation:t.contractRelation,variant:t.variant});
  else references.push({code:'TARGET_OR_AUTHORITY_MISSING',nodeIds:['scenario:'+t.from].filter(id=>byId.has(id)),sourceRef:t.sourceRef,targetId:t.to});
 }
 for(const b of s.bindings){
  const used=nodes.some(n=>n.kind==='operation'&&n.portId===b.portId);
  add('port:'+b.portId,'port',b.portId,b.sourceRef,{portId:b.portId});
  add('binding:'+b.portId,'binding',b.platformCapabilityId,b.sourceRef,{...b,used,ref:b.sourceRef});
  wire('port:'+b.portId,'binding:'+b.portId,'binding',b.sourceRef,'bound to');
  if(b.platformCapabilityId){add('platform:'+b.platformCapabilityId,'platform',b.platformCapabilityId,b.sourceRef);wire('binding:'+b.portId,'platform:'+b.platformCapabilityId,'realization',b.sourceRef,'platform capability');}
  for(const providerId of b.providerIds??[]){add('provider:'+providerId,'provider',providerId,b.sourceRef);wire('platform:'+b.platformCapabilityId,'provider:'+providerId,'provider-selection',b.sourceRef,'declared provider',{bindingId:'binding:'+b.portId});}
  const transformation=s.transformations.find(t=>t.id===b.transformationId);
  for(const reference of transformation?.providerReferences??[]){
   const ref=transformation.sourceRef+reference.expressionPath;
   add('provider:'+reference.providerId,'provider',reference.providerId,ref);
   wire('binding:'+b.portId,'provider:'+reference.providerId,'provider-reference',ref,reference.basis,{bindingId:'binding:'+b.portId,transformationId:transformation.id,providerBindingId:reference.bindingId,conditional:reference.conditional});
  }
  for(const [i,e]of (b.endpoints??[]).entries()){const id=add(`endpoint:${b.portId}:${i}`,'endpoint',e.origin+e.path,b.sourceRef+'/configuration'+e.sourcePointer);wire('binding:'+b.portId,id,'physical',b.sourceRef,'declared destination');}
  for(const [i,r]of (b.realizations??[]).entries()){const id=add(`physical:${b.portId}:${i}`,'physical',r.field+': '+r.value,b.sourceRef+'/configuration'+r.sourcePointer);wire('binding:'+b.portId,id,'physical',b.sourceRef,'declared metadata');}
  if(b.selectors?.capabilityIdPath)references.push({code:'RUNTIME_TARGET_UNRESOLVED',nodeIds:['binding:'+b.portId],sourceRef:b.sourceRef,targetId:b.selectors.capabilityIdPath});
 }
 const gaps=[];
 if(s.transformations.some(t=>!Array.isArray(t.providerReferences)))gaps.push({code:'TRANSFORMATION_PROVIDER_REFERENCES_NOT_RETAINED'});
 for(const sc of scenarios)if(!sc.operationIds.length)gaps.push({code:'EXECUTION_AUTHORITY_EMPTY',ref:sc.ref,scenarioId:sc.id});
 if(!(s.blueprintSources??[]).some(b=>b.edgeCount>0))gaps.push({code:'CANONICAL_BLUEPRINT_EDGES_NOT_AVAILABLE'});
 if(s.graphFeatures?.edgeGroups?.length||s.graphFeatures?.dispatchAuthorities?.length)gaps.push({code:'ADVANCED_ROUTING_NOT_PROJECTED'});
 gaps.push({code:'OBSERVABILITY_CONTRACT_NOT_RETAINED'},{code:'MONOTONIC_PROGRESS_NOT_PROVEN'});
 const coverage={scenarios:s.scenarios.length,operations:s.authorities.reduce((n,a)=>n+a.operations.length,0),transitions:s.transitions.length,bindings:s.bindings.length,nodes:nodes.length,edges:edges.length,canonicalComplete:false,gaps,scope:'selected declaration graph; no admission receipt'};
 const body={contractId:'capability-circuit-blueprint.v2',capabilityId:s.identity.capabilityId,snapshotDigest:s.snapshotDigest,rootScenarioId:s.identity.rootScenarioId,scenarios,nodes,edges,references,coverage,
  authority:{basis:'selected capability declaration graph',admission:'not-established-by-reader',blueprintSources:s.blueprintSources??[]},
  mechanismCircuits:s.transformations.map(t=>({id:t.id,sourceRef:t.sourceRef,nodeCount:t.nodeCount,cells:t.cells??t.preview,complete:!!t.cells||t.previewComplete})),
  observations:{state:'unobserved',contractStatus:'not-retained',testimony:[]},policies:s.graphFeatures??{},
  sourceCoverage:[...s.scenarios,...s.authorities.flatMap(a=>a.operations),...s.transitions,...s.bindings].map(v=>({sourceRef:v.sourceRef,nodeIds:nodes.filter(n=>n.ref===v.sourceRef).map(n=>n.id),edgeIds:edges.filter(e=>e.ref===v.sourceRef).map(e=>e.id),referenceIds:references.filter(r=>r.sourceRef===v.sourceRef).map(r=>r.targetId)}))};
 body.review=reviewBlueprint(s,body);
 return {...body,digest:digest(body)};
}
