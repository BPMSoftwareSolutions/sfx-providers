import {digest,fail} from './snapshot.mjs';

export const OBSERVATION_ALTITUDES=['capability','scenario','event','provider','mechanic','physical'];
export function reachableScenarios(model){
 const reached=new Set([model.rootScenarioId]);let changed=true;
 while(changed){changed=false;for(const e of model.edges){
  const a=model.nodes.find(n=>n.id===e.from),b=model.nodes.find(n=>n.id===e.to);
  if(['call','transition'].includes(e.kind)&&(a?.scenarioIds??[a?.scenarioId]).some(id=>reached.has(id))&&b?.scenarioId&&!reached.has(b.scenarioId)){reached.add(b.scenarioId);changed=true;}
 }}return reached;
}

// Projection contains only known identities or source-backed collapsed edges.
// Inventory, findings and observation never participate in layout.
export function projectBlueprint(model,{altitude='capability',scenarioId=model.rootScenarioId,operationId,transformationId}={}){
 if(!OBSERVATION_ALTITUDES.includes(altitude))fail('Unsupported observation altitude.');
 const sc=model.scenarios.find(s=>s.id===scenarioId);if(!sc)fail('Selected scenario is not in authority.');
 const active=reachableScenarios(model),byId=new Map(model.nodes.map(n=>[n.id,n]));
 let nodes=[],edges=[];
 if(altitude==='capability'){
  nodes=model.nodes.filter(n=>n.kind==='scenario'&&active.has(n.scenarioId));
  edges=model.edges.filter(e=>['call','transition'].includes(e.kind)).flatMap(e=>e.kind==='call'?(byId.get(e.from).scenarioIds??[]).map(id=>({...e,id:e.id+':'+id,from:'scenario:'+id,sourceEdgeIds:[e.id],collapsed:true})):[{...e,sourceEdgeIds:[e.id],collapsed:false}]);
  // Summarize exact operation/port ownership at capability altitude, without
  // flattening its execution cells or treating shared platforms as provider grants.
  const involvement=new Map(),providers=new Map();
  for(const scenario of model.scenarios.filter(s=>active.has(s.id)))for(const opId of scenario.operationIds){
   const op=byId.get(opId);if(!op?.portId)continue;
   const detail=projectBlueprint(model,{altitude:'provider',scenarioId:scenario.id,operationId:opId});
   for(const provider of detail.nodes.filter(n=>n.kind==='provider')){
    const selected=detail.edges.filter(e=>!['provider-selection','provider-reference'].includes(e.kind)||e.to===provider.id);
    const id=`scenario-provider:${scenario.id}:${provider.id}`;
    const edge=involvement.get(id)??{id,from:'scenario:'+scenario.id,to:provider.id,kind:'scenario-provider',collapsed:true,label:'declared provider involvement',basis:'owning scenario operations and explicit port bindings',ref:scenario.ref,sourceEdgeIds:[],sourceRefs:[],via:[]};
    edge.via.push({operationId:opId,portId:op.portId,bindingId:'binding:'+op.portId,sourceEdgeIds:selected.map(e=>e.id),basis:selected.find(e=>e.to===provider.id)?.label});
    edge.sourceEdgeIds=[...new Set([...edge.sourceEdgeIds,...selected.map(e=>e.id)])];
    edge.sourceRefs=[...new Set([...edge.sourceRefs,...selected.map(e=>e.ref)])];
    involvement.set(id,edge);providers.set(provider.id,provider);
   }
  }
  nodes.push(...providers.values());edges.push(...involvement.values());
 }else if(altitude==='scenario'){
  nodes=model.nodes.filter(n=>n.scenarioId===scenarioId&&['input','event','outcome','terminal'].includes(n.kind));
  edges=model.edges.filter(e=>['semantic-input','semantic-outcome'].includes(e.kind));
 }else if(altitude==='event'){
  nodes=sc.operationIds.map(id=>byId.get(id));edges=model.edges.filter(e=>e.kind==='sequence');
 }else if(['provider','physical'].includes(altitude)){
  const op=operationId?byId.get(operationId):sc.operationIds.map(id=>byId.get(id)).find(n=>n.portId);
  if(operationId&&(!op||!sc.operationIds.includes(op.id)||!op.portId))fail('Selected operation has no declared port in this scenario.');
  if(op){operationId=op.id;const ids=new Set([op.id]),kinds=['port','binding','realization','provider-selection','provider-reference',...(altitude==='physical'?['physical']:[])];
   const owned=e=>e.kind!=='provider-selection'||e.bindingId==='binding:'+op.portId;
   for(const kind of kinds)for(const e of model.edges)if(e.kind===kind&&ids.has(e.from)&&owned(e))ids.add(e.to);
   nodes=model.nodes.filter(n=>ids.has(n.id));edges=model.edges.filter(e=>kinds.includes(e.kind)&&owned(e));}
 }else{
  const operation=operationId?byId.get(operationId):sc.operationIds.map(id=>byId.get(id)).find(n=>byId.get('binding:'+n.portId)?.transformationId);
  if(operationId&&(!operation||!sc.operationIds.includes(operationId)))fail('Selected operation is not in this scenario.');
  transformationId??=byId.get('binding:'+operation?.portId)?.transformationId;
  const t=model.mechanismCircuits.find(t=>t.id===transformationId);
  if(transformationId&&!t)fail('Selected transformation is not in retained authority.');
  if(t){nodes=t.cells.map(c=>({id:`mechanic:${t.id}:${c.path}`,kind:'mechanic',label:c.op,description:c.inputPath||c.operand,ref:t.sourceRef+c.path,parent:c.parent,expressionPath:c.path}));
   edges=t.cells.filter(c=>c.parent!=null).map(c=>({id:`operand:${t.id}:${c.path}`,from:`mechanic:${t.id}:${c.parent}`,to:`mechanic:${t.id}:${c.path}`,kind:'operand',label:c.operand,ref:t.sourceRef+c.path}));}
 }
 const ids=new Set(nodes.map(n=>n.id));edges=edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
 const body={contractId:'capability-blueprint-projection.v1',altitude,capabilityId:model.capabilityId,scenarioId,...(operationId?{operationId}:{}),...(transformationId?{transformationId}:{}),snapshotDigest:model.snapshotDigest,nodes,edges,
  scope:altitude==='event'?'All selected Event operations; wires retain declared order, not proven runtime routing.':altitude==='scenario'?'Scenario semantic positions; not execution sequencing.':altitude==='capability'?'Root-connected scenario topology and declared provider involvement; collapsed links retain exact operation and binding evidence, not observed execution.':altitude==='mechanic'?'Declared expression operands; not scenario transitions.':'Selected operation, explicit port and binding ownership.'};
 return {...body,topologyDigest:digest(body)};
}

export function projectionOverlays(model,projection,{diagnostics=true,observations={}}={}){
 const visible=new Set(projection.nodes.map(n=>n.id));
 const issues=diagnostics?model.review.issues.map(i=>({...i,visibleNodeIds:i.nodeIds.flatMap(id=>{
  if(visible.has(id))return[id];const n=model.nodes.find(n=>n.id===id);const scenario='scenario:'+n?.scenarioId;
  return projection.altitude==='capability'&&visible.has(scenario)?[scenario]:[];
 })})):[];
 return {issues,states:Object.fromEntries(Object.entries(observations).filter(([id])=>visible.has(id)))};
}

// A presentation-side adapter contract, not the estate's telemetry protocol.
// Reject unknown IDs/snapshots instead of creating cells from incoming frames.
export function applyObservationFrame(model,state,frame){
 if(frame.snapshotDigest!==model.snapshotDigest||typeof frame.invocationId!=='string'||!frame.invocationId)fail('Observation identity does not match this blueprint.');
 if(!model.nodes.some(n=>n.id===frame.nodeId)||!['pending','active','succeeded','failed'].includes(frame.status))fail('Observation names an unknown cell or unsupported state.');
 if(frame.durationMs!=null&&(!Number.isFinite(frame.durationMs)||frame.durationMs<0))fail('Invalid observation duration.');
 if(state.invocationId&&state.invocationId!==frame.invocationId)fail('Invocation state must be reset before selecting another invocation.');
 return {invocationId:frame.invocationId,snapshotDigest:model.snapshotDigest,nodes:{...(state.nodes??{}),[frame.nodeId]:{status:frame.status,...(frame.durationMs!=null?{durationMs:frame.durationMs}:{})}}};
}

export function declarationInventory(model){
 const active=reachableScenarios(model);
 return model.nodes.filter(n=>(n.kind==='scenario'&&!active.has(n.scenarioId))||(n.kind==='operation'&&!n.scenarioIds?.some(id=>active.has(id)))||(n.kind==='binding'&&!model.edges.some(e=>e.kind==='port'&&e.to==='port:'+n.portId&&byOperation(e.from))));
 function byOperation(id){return model.nodes.find(n=>n.id===id)?.scenarioIds?.some(sc=>active.has(sc));}
}
