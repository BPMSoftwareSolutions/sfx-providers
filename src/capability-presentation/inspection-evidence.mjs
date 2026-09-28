// Projection-only adapter. Detector rules and reading inventory come from rows.
// Unknown addresses remain unlocated; no topology or successful execution is inferred.
const array=v=>Array.isArray(v)?v:[];
const identifiers=v=>array(v).map(x=>typeof x==='string'?x:x?.id).filter(x=>typeof x==='string');
const unique=v=>[...new Set(v.filter(Boolean))];
const signature=f=>f.code+'|'+identifiers(f.nodeIds).slice().sort().join('|')+(f.code==='FORMAL_COUNTEREXAMPLE'?'|'+JSON.stringify(f.evidence):'');

export function inspectEvidence(snapshot,model,localIssues){
 const e=snapshot.inspection,issues=localIssues.map(i=>({...i,nodeIds:[...i.nodeIds],sourceRefs:[...i.sourceRefs]}));
 const available=e?.contractId==='capability-inspection-evidence.v1';
 const fresh=available&&String(e.estateModelId)===snapshot.identity.estateModelId&&e.capabilityId===model.capabilityId
  &&String(e.capabilityVersionPk)===snapshot.identity.capabilityVersionPk&&String(e.definitionPk)===snapshot.identity.definitionPk
  &&e.definitionDigest===snapshot.identity.definitionDigest&&e.sourceGraphDigest===snapshot.provenance.graphDigest;
 const report={status:!available?'UNAVAILABLE':fresh?'SNAPSHOT_MATCH':'STALE',capturedUtc:e?.capturedUtc??null,
  sourceRef:'snapshot:/inspection',executionBasis:e?.executionBasis??'No inspection envelope retained',
  readings:[],checks:[],receipts:[],unlocatedIssueIds:[],repairMap:e?.repairMap??null};
 const nodes=new Map(model.nodes.map(n=>[n.id,n])),edges=new Map(model.edges.map(v=>[v.id,v]));
 const scenariosFor=ids=>unique(ids.flatMap(id=>{
  const edge=edges.get(id),ends=edge?[edge.from,edge.to]:[id];
  return model.scenarios.filter(s=>ends.some(at=>s.operationIds.includes(at)||['scenario:','input:','event:','outcome:'].some(p=>at===p+s.id)
   ||model.edges.some(v=>s.operationIds.includes(v.from)&&v.to===at))).map(s=>s.id);
 }));
 const resolve=row=>{
  const ids=identifiers(row.nodeIds);
  for(const scId of unique([row.scenario_id,row.from_scenario,row.to_scenario,row.scope?.scenarioId])){
   if(nodes.has('scenario:'+scId))ids.push('scenario:'+scId);
  }
  for(const n of model.nodes){
   if(row.transformation_id&&n.id==='transformation:'+row.transformation_id)ids.push(n.id);
   if(row.port_id&&n.id==='binding:'+row.port_id)ids.push(n.id);
   if(row.contract_id&&n.contractId===row.contract_id)ids.push(n.id);
  }
  if(row.transformation_id){
   const ports=snapshot.bindings.filter(b=>b.transformationId===row.transformation_id).map(b=>b.portId);
   ids.push(...model.nodes.filter(n=>n.kind==='operation'&&ports.includes(n.portId)).map(n=>n.id));
  }
  // Binding/port-only diagnostics retain ownership through exact declared ports.
  const boundPorts=ids.map(id=>nodes.get(id)).filter(n=>['binding','port'].includes(n?.kind)).map(n=>n.portId);
  ids.push(...model.nodes.filter(n=>n.kind==='operation'&&boundPorts.includes(n.portId)).map(n=>n.id));
  return unique(ids.filter(id=>nodes.has(id)||edges.has(id)));
 };
 const add=f=>{
  const found=issues.find(i=>signature(i)===signature(f));
  if(found){found.sourceRefs=unique([...found.sourceRefs,...f.sourceRefs]);found.declaredEvidence=[...array(found.declaredEvidence),f.evidence];return;}
  issues.push({...f,id:'R'+String(issues.length+1).padStart(2,'0')});
 };
 if(fresh){
  for(const [ri,r] of array(e.readings).entries()){
   const sourceRef=`snapshot:/inspection/readings/${ri}`,d=r.document??{};
   report.readings.push({reading:r.reading,kind:r.kind,status:r.status,sourceRef,portDefinitionPk:r.portDefinitionPk,statementDigest:r.statementDigest});
   if(r.status!=='READ'){report.checks.push({id:`V${report.checks.length+1}`,reading:r.reading,disposition:r.status,basis:d.basis??'Reading unavailable; no empty-result claim',nodeIds:[],scenarioIds:[],sourceRef,raw:d});continue;}
   if(r.kind==='detection')for(const [fi,f]of array(d.findings).entries()){
    if(typeof f.code!=='string'||typeof f.message!=='string'||!['error','warning','info'].includes(f.severity))continue;
    add({...f,nodeIds:identifiers(f.nodeIds),sourceRefs:unique([...identifiers(f.sourceRefs),sourceRef+'/document/findings/'+fi]),evidence:{...f.evidence,scope:f.scope,reading:r.reading,portDefinitionPk:r.portDefinitionPk,statementDigest:r.statementDigest}});
   }
   if(r.kind==='verification'||r.kind==='obligations'){
    const rows=r.kind==='verification'?array(d.rows):array(d.capabilities).filter(c=>c.capabilityId===model.capabilityId).flatMap(c=>array(c.obligations).map(o=>({...o,scope:c.scope})));
    for(const [ci,c] of rows.entries()){
     const nodeIds=resolve(c),source=sourceRef+(r.kind==='verification'?'/document/rows/'+ci:'/document/capabilities');
     const subject=c.operator??c.transformation_id??c.contract_id??c.scenario_id??c.fixture_id;
     report.checks.push({id:`V${report.checks.length+1}`,reading:r.reading,property:c.obligation??r.reading,subject,disposition:c.disposition??'UNSPECIFIED',basis:c.basis??'',nodeIds,scenarioIds:scenariosFor(nodeIds),sourceRef:source,rowIndex:ci,raw:c});
     if(c.disposition==='COUNTEREXAMPLE')add({severity:'error',code:'FORMAL_COUNTEREXAMPLE',message:(c.obligation??r.reading)+': '+(c.basis??'Declared reading returned a counterexample'),nodeIds,sourceRefs:[source],evidence:{reading:r.reading,row:c}});
    }
    if(!rows.length)report.checks.push({id:`V${report.checks.length+1}`,reading:r.reading,disposition:'NO_ROWS',basis:'No property rows returned; not a proof',nodeIds:[],scenarioIds:[],sourceRef});
   }
  }
  report.receipts=array(e.receipts).map(r=>({...r,subjectMatch:r.document?.subjectDigest==='sha256:'+e.definitionDigest,
   applicability:'Dependency and detector freshness not established by a subject digest alone'}));
 }
 for(const issue of issues){
  issue.resolvedNodeIds=resolve(issue);issue.scenarioIds=scenariosFor(issue.resolvedNodeIds);
  issue.addressStatus=issue.resolvedNodeIds.length?'LOCATED':'UNLOCATED';
  if(!issue.resolvedNodeIds.length)report.unlocatedIssueIds.push(issue.id);
  const entry=fresh?array(e.repairMap?.entries).find(r=>r.findingCode===issue.code):null;
  issue.repair={status:!fresh?'NOT_READ':!entry?'UNMAPPED':entry.disposition==='REPAIR'?'MAPPED':'HELD',
   ...(entry?{declaration:entry,requiredParameters:array(entry.requiredParameters),execution:'Not attempted',closure:'Not verified'}:{})};
 }
 report.summary={readings:report.readings.length,read:report.readings.filter(r=>r.status==='READ').length,
  checks:report.checks.length,proved:report.checks.filter(c=>c.disposition==='PROVED').length,
  counterexamples:report.checks.filter(c=>c.disposition==='COUNTEREXAMPLE').length,
  other:report.checks.filter(c=>!['PROVED','COUNTEREXAMPLE'].includes(c.disposition)).length,
  unlocated:report.unlocatedIssueIds.length,receipts:report.receipts.length};
 return {issues,inspection:report};
}

export function scenarioInspection(model,scenarioId){
 const issues=model.review.issues.filter(i=>i.scenarioIds?.includes(scenarioId));
 const globalIssues=model.review.issues.filter(i=>!i.scenarioIds?.length);
 const checks=(model.review.inspection?.checks??[]).filter(c=>!c.scenarioIds.length||c.scenarioIds.includes(scenarioId));
 return {issues,globalIssues,checks};
}
