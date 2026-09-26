import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeSnapshot,validateSnapshot,digest } from '../src/capability-presentation/snapshot.mjs';
import { buildCircuitModel,buildContexts } from '../src/capability-presentation/model.mjs';
import { handle,inputShape } from '../src/capability-presentation/provider.mjs';
import { createSqlEstateReader } from '../src/capability-presentation/estate.mjs';
import { createCircuitRequestHandler,CAPABILITY_INVOKE } from '../src/circuit-presentation/http.mjs';
import * as api from '../src/capability-presentation/provider.mjs';
import {rawFixture,snapshotFixture} from './fixtures/capability-presentation.mjs';
import {buildStoryboard} from '../src/capability-presentation/storyboard.mjs';
const input={contractId:inputShape.contractId,capabilityId:'review-request'};
const readEstate=async()=>snapshotFixture();

test('selected story survives empty projected columns and preserves declaration provenance',()=>{
  const raw=rawFixture();raw.capability.actor='';raw.capability.intent='';raw.capability.outcome='';raw.capability.definition_json=JSON.stringify({semantics:{authority:{userStory:{actor:'Declared actor',intent:'Declared meaning',outcome:'Declared result'}}}});
  const s=normalizeSnapshot(raw);assert.equal(s.identity.intent,'Declared meaning');assert.match(s.identity.meaningSourceRef,/semantic_object_definition\/11/);
});
test('snapshot is deterministic, content addressed and rejects tampering or identity ambiguity',()=>{
  const s=snapshotFixture();assert.deepEqual(s,snapshotFixture());s.scenarios[0].id='tampered';assert.throws(()=>validateSnapshot(s),/digest/);
  const raw=rawFixture();raw.graph.scenarios.push(raw.graph.scenarios[0]);assert.throws(()=>normalizeSnapshot(raw),/Duplicate/);
});
test('physical metadata excludes credentials, headers, payload and URL query parameters',()=>{
  const s=snapshotFixture();assert.ok(!JSON.stringify(s).includes('never-keep'));const b=s.bindings.find(b=>b.portId==='deliver');assert.equal(b.endpoints[0].origin,'https://example.org');assert.equal(b.endpoints[0].path,'/review');assert.deepEqual(b.credentialReferences,['example-reference']);
});
test('AST counts mechanics and branches without interpreting literal payload objects',()=>{
  const t=snapshotFixture().transformations[0];assert.equal(t.nodeCount,4);assert.equal(t.branchCount,1);assert.ok(!('DO_NOT_COUNT_PAYLOAD' in t.operatorCounts));
  const m=buildCircuitModel(snapshotFixture(),'mechanic');assert.equal(m.nodes.filter(n=>n.kind==='mechanic').length,4);assert.ok(m.edges.some(e=>e.relation==='expression'&&e.label==='then'));
});
test('scenario view preserves branches, calls, joins and cycles as distinct relationships',()=>{
  const raw=rawFixture();raw.graph.transitions.push({transitionId:'return',from:{scenarioId:'accept'},to:{scenarioId:'review'},selectsVariant:'RETRY'});
  const m=buildCircuitModel(normalizeSnapshot(raw),'scenario');assert.equal(m.nodes.length,3);assert.equal(m.edges.length,4);assert.equal(m.edges.filter(e=>e.relation==='invocation').length,1);assert.ok(m.edges.some(e=>e.label==='RETRY'));
});
test('both axes persist: eleven context layers with an independent circuit view and focused context',async()=>{
  const r=await handle({...input,view:'provider',contextAltitude:4},{readEstate});assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
  assert.equal(r.candidate.storyboard.contexts.length,11);assert.equal(r.candidate.view,'provider');assert.equal(r.candidate.contextAltitude,4);
  assert.ok(r.candidate.storyboard.slides.some(s=>s.title==='04 · Contracts and schemas'));
  assert.ok(!r.candidate.storyboard.slides.some(s=>s.title==='03 · Scenario inputs/events/outcomes'));
  assert.deepEqual(buildContexts(snapshotFixture()).map(c=>c.altitude),[1,2,3,4,5,6,7,8,9,10,11]);
});
test('all four projections compile editable diagrams with complete model coverage and stable output',async()=>{
  for(const view of ['scenario','mechanic','provider','physical']){
    const a=await handle({...input,view},{readEstate}),b=await handle({...input,view},{readEstate});
    assert.equal(a.disposition,'AUTHORED',JSON.stringify(a.findings));assert.equal(a.candidate.contentDigest,b.candidate.contentDigest);
    const c=a.candidate.coverage;assert.equal(c.nodeCount,c.coveredNodes);assert.equal(c.edgeCount,c.coveredEdges);
    assert.ok(a.candidate.volumes.every(v=>v.presentation.requests.some(r=>r.createLine)));
  }
});
test('gaps stay gaps: missing bindings, disconnected scenarios and unobserved testimony',async()=>{
  const raw=rawFixture();raw.graph.interfaceAuthority.portBindings=[];raw.graph.scenarios.push({scenarioId:'unconnected',outcome:{terminal:true}});
  const s=normalizeSnapshot(raw);const r=await handle({...input,view:'physical'},{readEstate:async()=>s});
  assert.equal(r.disposition,'AUTHORED');assert.ok(r.findings.some(f=>f.code==='UNRESOLVED_REFERENCE'));assert.ok(r.findings.some(f=>f.code==='PHYSICAL_REALIZATION_NOT_READ'));assert.ok(r.findings.some(f=>f.code==='SCENARIOS_WITHOUT_DECLARED_ROOT_PATH'));
  assert.equal(r.candidate.storyboard.checks.find(c=>c.label==='Execution testimony').status,'not-read');
});
test('invalid capability requests and mismatched namespaces are refused before diagram generation',async()=>{
  for(const bad of [{...input,view:'invented'},{...input,contextAltitude:12},{...input,sql:'DROP TABLE x'},{...input,capabilityId:'other'},{...input,namespaceId:'other'}]){
    const r=await handle(bad,{readEstate});assert.equal(r.disposition,'HELD');assert.equal(r.candidate,null);
  }
});
test('inference is labeled, cites existing facts, and cannot change the circuit',async()=>{
  const base=await handle(input,{readEstate});
  const enriched=await handle(input,{readEstate,narrator:async({slides})=>[{slideId:slides[0].id,text:'An interpretation of the selected capability.',evidenceRefs:slides[0].evidenceRefs}]});
  assert.equal(enriched.disposition,'AUTHORED');assert.equal(enriched.candidate.model.digest,base.candidate.model.digest);assert.match(enriched.candidate.volumes[0].presentation.slides[0].notes,/Inferred explanation/);
  const bad=await handle(input,{readEstate,narrator:async({slides})=>[{slideId:slides[0].id,text:'Unsupported',evidenceRefs:['invented:fact']}]});assert.equal(bad.disposition,'HELD');
});
test('a narrator receives detached data and cannot mutate snapshot facts or evidence references',async()=>{
  const r=await handle(input,{readEstate,narrator:async payload=>{payload.capability.intent='rewritten';payload.contexts[0].summary='rewritten';payload.slides[0].evidenceRefs.push('invented');return [];}});
  assert.equal(r.disposition,'AUTHORED');assert.equal(r.candidate.snapshot.identity.intent,snapshotFixture().identity.intent);assert.ok(!r.candidate.storyboard.slides[0].evidenceRefs.includes('invented'));validateSnapshot(r.candidate.snapshot);
});
test('large circuits paginate instead of dropping nodes or edges',async()=>{
  const raw=rawFixture();raw.graph.interfaceAuthority.portBindings=Array.from({length:130},(_,i)=>({portId:'p'+i,platformCapabilityId:'platform'+i,configuration:{}}));
  const r=await handle({...input,view:'provider'},{readEstate:async()=>normalizeSnapshot(raw)});assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
  assert.ok(r.candidate.volumes.length>1);assert.equal(r.candidate.coverage.coveredEdges,130);assert.equal(r.candidate.coverage.coveredNodes,262);
  const ids=r.candidate.volumes.flatMap(v=>v.presentation.slides.map(s=>s.id));assert.equal(new Set(ids).size,ids.length);
});
test('cross-page incoming wires point into the node instead of reversing the call',()=>{
  const s=snapshotFixture();
  const nodes=Array.from({length:7},(_,i)=>({id:'n'+i,label:'Node '+i,kind:'scenario',ref:'example:'+i}));
  const model={view:'scenario',nodes,edges:[{id:'edge:1',from:'n0',to:'n6',relation:'invocation',ref:'example:call',label:'call'}],findings:[],digest:'f'.repeat(64)};
  // Keep the disconnected first-page nodes before the called node by including
  // six outgoing edges, then verify the continuation on circuit page two.
  model.edges=nodes.slice(1).map((n,i)=>({id:'edge:'+(i+1),from:'n0',to:n.id,relation:'invocation',ref:'example:call'+i,label:'call'}));
  const story=buildStoryboard(s,model,{contextAltitude:3});
  const second=story.slides.find(p=>p.title==='Scenario circuit · 2/2');
  assert.ok(second.commands.some(c=>c.op==='route'&&JSON.stringify(c.args[0])===JSON.stringify([[63,211],[83,211]])));
  assert.ok(!second.commands.some(c=>c.op==='route'&&JSON.stringify(c.args[0])===JSON.stringify([[302,211],[322,211]])));
});
test('SQL reader binds parameters, pins SNAPSHOT, and rolls back and closes on failure',async()=>{
  const log=[];const sql={NVarChar:n=>n,ISOLATION_LEVEL:{SNAPSHOT:'SNAPSHOT'},Transaction:class{async begin(v){log.push(['begin',v]);}async rollback(){log.push(['rollback']);}},Request:class{input(...a){log.push(['input',...a]);return this;}async query(q){assert.match(q,/analysis.capability_graph_source\(@capability_id/);throw new Error('connection password should not escape');}}};
  const read=createSqlEstateReader({openSql:async()=>({sql,pool:{close:async()=>log.push(['close'])}})});
  await assert.rejects(read({capabilityId:"x';DROP TABLE model.capability;--",namespaceId:'example'}),/^Error: CAPABILITY_ESTATE_READ_FAILED$/);
  assert.deepEqual(log[0],['begin','SNAPSHOT']);assert.equal(log[1][3],"x';DROP TABLE model.capability;--");assert.deepEqual(log.slice(-2),[['rollback'],['close']]);
});
test('new HTTPS route uses compact request limits and configured read binding',async()=>{
  const handler=createCircuitRequestHandler(undefined,{...api,handle:(i,o)=>handle(i,{...o,readEstate})});
  const server=http.createServer((req,res)=>handler(req,res,new URL(req.url,'http://localhost').pathname));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{const url=`http://127.0.0.1:${server.address().port}${CAPABILITY_INVOKE}`;
    const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});assert.equal(response.status,200);assert.equal((await response.json()).candidate.capabilityId,'review-request');
    assert.equal((await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:' '.repeat(16385)})).status,413);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('offline CLI replays from another directory without overwriting previous artifacts',async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'sfx-capability-test-'));const run=promisify(execFile);
  try{const snapshot=path.join(temp,'snapshot.json');await fs.writeFile(snapshot,JSON.stringify(snapshotFixture()));
    const cli=fileURLToPath(new URL('../capability-deck.mjs',import.meta.url));const output=path.join(temp,'deck');const args=[cli,'--snapshot',snapshot,'--output',output,'--view','scenario'];
    const r=await run(process.execPath,args,{cwd:temp});assert.equal(JSON.parse(r.stdout).capabilityId,'review-request');assert.equal(JSON.parse(await fs.readFile(path.join(output,'receipt.json'),'utf8')).coverage.contextLayers,11);await assert.rejects(run(process.execPath,args,{cwd:temp}));
  }finally{const target=await fs.realpath(temp);assert.equal(path.dirname(target),await fs.realpath(os.tmpdir()));assert.ok(path.basename(target).startsWith('sfx-capability-test-'));await fs.rm(target,{recursive:true,force:true});}
});
