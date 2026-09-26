import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rawFixture} from './fixtures/capability-presentation.mjs';
import {normalizeSnapshot} from '../src/capability-presentation/snapshot.mjs';
import {buildBlueprint,layoutBlueprint} from '../src/capability-presentation/blueprint.mjs';
import {projectBlueprint,projectionOverlays,declarationInventory,applyObservationFrame} from '../src/capability-presentation/projection.mjs';
import {handle} from '../src/capability-presentation/provider.mjs';
import fs from 'node:fs/promises';
import {inputShape,outputShape} from '../src/capability-presentation/provider.mjs';
import {requestSchema} from '../src/circuit-presentation/contracts.mjs';

test('published request and output schemas stay aligned with the executable provider',async()=>{
 for(const [file,schema]of [['capability-presentation/request.v1.schema.json',inputShape.schema],['capability-presentation/output.v1.schema.json',outputShape.schema],['circuit-presentation/request.v1.schema.json',requestSchema]])assert.deepEqual(JSON.parse(await fs.readFile(new URL('../contracts/'+file,import.meta.url),'utf8')),schema);
});

test('capability topology collapses calls with their source edge identity and preserves branch/join/recurrence declarations',()=>{
 const raw=rawFixture();raw.graph.transitions.push({transitionId:'join',from:{scenarioId:'accept'},to:{scenarioId:'refuse'},topologyKind:'join'},{transitionId:'again',from:{scenarioId:'refuse'},to:{scenarioId:'review'},topologyKind:'recurrence'});
 const b=buildBlueprint(normalizeSnapshot(raw)),p=projectBlueprint(b);
 assert.equal(p.nodes.filter(n=>n.kind==='scenario').length,3);assert.equal(p.nodes.filter(n=>n.kind==='provider').length,1);assert.equal(p.edges.filter(e=>e.kind!=='scenario-provider').length,5);
 assert.ok(p.edges.some(e=>e.topologyKind==='join'));assert.ok(p.edges.some(e=>e.topologyKind==='recurrence'));
 const call=p.edges.find(e=>e.kind==='call');assert.equal(call.from,'scenario:review');assert.equal(call.to,'scenario:accept');assert.ok(b.edges.some(e=>e.id===call.sourceEdgeIds[0]&&e.from==='operation:review.v1:2'));
 const l=layoutBlueprint(p);assert.equal(l.routes.length,6);assert.ok(l.routes.every(e=>e.points.every(p=>p.every(Number.isFinite))));
});
test('scenario meaning and Event operations occupy distinct projections without invented responsibilities',()=>{
 const b=buildBlueprint(normalizeSnapshot(rawFixture())),sc=projectBlueprint(b,{altitude:'scenario'}),ev=projectBlueprint(b,{altitude:'event'});
 assert.deepEqual(sc.nodes.map(n=>n.kind),['input','event','outcome']);
 assert.deepEqual(ev.nodes.map(n=>n.id),['operation:review.v1:1','operation:review.v1:2']);
 assert.ok(ev.edges.every(e=>e.kind==='sequence'));assert.ok(ev.nodes.every(n=>n.ref.startsWith('graph:')));
 assert.ok(!ev.nodes.some(n=>['provider','binding','scenario'].includes(n.kind)));
});
test('a complete 35-operation Event survives independently of the primary capability and unused bindings',async()=>{
 const raw=rawFixture();raw.graph.executionAuthorities[0].operations=Array.from({length:35},(_,i)=>({kind:'invoke-port',portId:'port-'+i}));
 raw.graph.interfaceAuthority.portBindings.push(...raw.graph.executionAuthorities[0].operations.map(o=>({portId:o.portId,platformCapabilityId:'transform.v1',configuration:{}})));
 const s=normalizeSnapshot(raw),r=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId,contextAltitude:7},{readEstate:async()=>s});
 assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
 const story=r.candidate.storyboard,primary=story.slides.find(s=>s.blueprint?.role==='overview');
 assert.equal(primary.blueprint.altitude,'capability');assert.equal(primary.blueprint.nodes.length,4);
 const event=story.slides.find(s=>s.blueprint?.altitude==='event'&&s.blueprint?.scenarioId==='review'&&s.blueprint?.role==='projection');
 assert.equal(event.blueprint.nodes.length,35);assert.equal(event.blueprint.edges.length,34);
 assert.ok(!primary.blueprint.nodes.some(id=>id.startsWith('binding:')));
 assert.ok(story.slides.some(s=>s.blueprint?.role==='inventory'));
});
test('provider detail traces one exact operation through its explicit port, binding and provider',()=>{
 const b=buildBlueprint(normalizeSnapshot(rawFixture())),p=projectBlueprint(b,{altitude:'provider',scenarioId:'accept',operationId:'operation:accept.v1:1'});
 assert.deepEqual(p.edges.map(e=>e.kind),['port','binding','realization','provider-selection']);
 const ids=new Set(p.nodes.map(n=>n.id));assert.ok(ids.has('operation:accept.v1:1'));assert.ok(ids.has('port:deliver'));assert.ok(ids.has('binding:deliver'));assert.ok(ids.has('provider:example-provider'));
 assert.ok(!ids.has('binding:policy'));
 for(const n of p.nodes.filter(n=>n.kind==='provider'))assert.ok(p.edges.some(e=>e.to===n.id));
 assert.throws(()=>projectBlueprint(b,{altitude:'provider',scenarioId:'review',operationId:'operation:accept.v1:1'}));
});
test('unconnected declarations move to inventory and absent targets never create fictional nodes',()=>{
 const raw=rawFixture();raw.graph.transitions=[];raw.graph.executionAuthorities[0].operations=[{kind:'invoke-scenario',scenarioId:'absent'},{kind:'invoke-port',portId:'missing-port'}];
 const b=buildBlueprint(normalizeSnapshot(raw)),p=projectBlueprint(b),inventory=declarationInventory(b);
 assert.deepEqual(p.nodes.map(n=>n.id),['scenario:review']);assert.equal(p.edges.length,0);
 assert.ok(inventory.some(n=>n.id==='scenario:accept'));assert.ok(inventory.some(n=>n.id==='binding:deliver'));
 assert.ok(!b.nodes.some(n=>n.id==='scenario:absent'||n.id==='binding:missing-port'));assert.ok(b.review.issues.some(i=>i.code==='PORT_BINDING_MISSING'));
 assert.ok(!b.edges.some(e=>e.kind==='return'));
});
test('diagnostics and observation frames cannot mutate topology or geometry',()=>{
 const b=buildBlueprint(normalizeSnapshot(rawFixture())),p=projectBlueprint(b,{altitude:'event'}),before=JSON.stringify(p),geometry=layoutBlueprint(p);
 projectionOverlays(b,p,{diagnostics:true});projectionOverlays(b,p,{diagnostics:false});
 const frame={snapshotDigest:b.snapshotDigest,invocationId:'run-1',nodeId:'operation:review.v1:1',status:'active',durationMs:328};
 const state=applyObservationFrame(b,{},frame);const overlay=projectionOverlays(b,p,{observations:state.nodes});
 assert.equal(overlay.states[frame.nodeId].durationMs,328);assert.equal(JSON.stringify(p),before);assert.deepEqual(layoutBlueprint(p),geometry);
 assert.throws(()=>applyObservationFrame(b,state,{...frame,nodeId:'invented'}));assert.throws(()=>applyObservationFrame(b,state,{...frame,snapshotDigest:'wrong'}));assert.throws(()=>applyObservationFrame(b,state,{...frame,invocationId:'run-2'}));
});
test('native drill-down links resolve to a slide at the intended altitude',async()=>{
 const s=normalizeSnapshot(rawFixture()),r=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId},{readEstate:async()=>s});
 assert.equal(r.disposition,'AUTHORED');
 const slides=r.candidate.storyboard.slides,cap=slides.find(s=>s.blueprint?.role==='overview'),scenarioLinks=cap.commands.filter(c=>c.op==='t'&&c.args[9]?.slideIndex!=null&&slides[c.args[9].slideIndex]?.blueprint?.altitude==='scenario');
 assert.equal(scenarioLinks.length,3);
 for(const slide of slides)for(const c of slide.commands)if(c.op==='t'&&typeof c.args[9]==='object')assert.ok(slides[c.args[9].slideIndex]);
 const scenario=slides[scenarioLinks[0].args[9].slideIndex];
 assert.ok(scenario.commands.some(c=>c.op==='t'&&slides[c.args[9]?.slideIndex]?.blueprint?.altitude==='event'));
});
test('shared execution authority preserves calls from each scenario owner',()=>{
 const raw=rawFixture();raw.graph.scenarios[1].event.executionAuthorityId='review.v1';
 const p=projectBlueprint(buildBlueprint(normalizeSnapshot(raw)));
 assert.ok(p.edges.some(e=>e.kind==='call'&&e.from==='scenario:review'&&e.to==='scenario:accept'));
 assert.ok(p.edges.some(e=>e.kind==='call'&&e.from==='scenario:accept'&&e.to==='scenario:accept'));
 assert.equal(new Set(p.edges.map(e=>e.id)).size,p.edges.length);
});
test('physical view retains only metadata attached to the selected operation binding',()=>{
 const b=buildBlueprint(normalizeSnapshot(rawFixture())),p=projectBlueprint(b,{altitude:'physical',scenarioId:'accept',operationId:'operation:accept.v1:1'});
 assert.ok(p.nodes.some(n=>n.kind==='endpoint'&&n.label==='https://example.org/review'));
 assert.ok(p.edges.some(e=>e.kind==='physical'&&e.from==='binding:deliver'));
 assert.ok(!JSON.stringify(p).includes('never-keep'));
});
