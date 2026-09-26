import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rawFixture,snapshotFixture} from './fixtures/capability-presentation.mjs';
import {normalizeSnapshot} from '../src/capability-presentation/snapshot.mjs';
import {buildBlueprint,layoutBlueprint} from '../src/capability-presentation/blueprint.mjs';
import {buildCircuitModel} from '../src/capability-presentation/model.mjs';
import {buildStoryboard} from '../src/capability-presentation/storyboard.mjs';
import {handle} from '../src/capability-presentation/provider.mjs';

test('whole circuit retains branches, a join, recursion and explicit nested returns',()=>{
 const raw=rawFixture();raw.graph.transitions.push({transitionId:'join-accept',from:{scenarioId:'accept'},to:{scenarioId:'refuse'},topologyKind:'join'},{transitionId:'again',from:{scenarioId:'refuse'},to:{scenarioId:'review'},topologyKind:'recurrence'});
 const s=normalizeSnapshot(raw),b=buildBlueprint(s),layout=layoutBlueprint(b);
 assert.equal(b.coverage.transitions,4);assert.equal(b.coverage.operations,3);assert.equal(b.coverage.bindings,2);
 assert.equal(b.edges.filter(e=>e.kind==='transition').length,4);assert.ok(b.edges.some(e=>e.kind==='transition'&&e.from==='variant:review:REFUSED'&&e.to==='input:refuse'&&e.classification==='failure'));
 assert.ok(b.edges.some(e=>e.kind==='call'&&e.to==='input:accept'));assert.ok(b.edges.some(e=>e.kind==='return'&&e.from==='outcome:accept'));
 assert.equal(layout.routes.length,b.edges.length);assert.equal(Object.keys(layout.positions).length,b.nodes.length);
 assert.ok(b.edges.some(e=>e.topologyKind==='recurrence'));assert.ok(b.edges.some(e=>e.topologyKind==='join'));
 for(const edge of layout.routes){assert.ok(edge.points.length>=2);assert.ok(edge.points.every(p=>p.every(Number.isFinite)));}
});
test('every semantic view and altitude focus includes one complete overview after the cover',()=>{
 const s=snapshotFixture();for(const view of ['scenario','mechanic','provider','physical'])for(const contextAltitude of [1,7,'all']){
  const story=buildStoryboard(s,buildCircuitModel(s,view),{contextAltitude});const overview=story.slides[1];assert.equal(overview.blueprint.role,'overview');assert.equal(story.slides.filter(s=>s.blueprint?.role==='overview').length,1);
  assert.deepEqual(new Set(overview.blueprint.nodes),new Set(story.blueprint.nodes.map(n=>n.id)));assert.deepEqual(new Set(overview.blueprint.edges),new Set(story.blueprint.edges.map(e=>e.id)));
 }
});
test('dynamic capability selection stays a wired boundary and its result returns to the binding',()=>{
 const raw=rawFixture();raw.graph.interfaceAuthority.portBindings[0].configuration={capabilityIdPath:'selectedCapability',requestPath:'input',resultPath:'result'};
 const b=buildBlueprint(normalizeSnapshot(raw)),dynamic=b.nodes.find(n=>n.kind==='dynamic');assert.equal(dynamic.selector,'selectedCapability');
 assert.ok(b.edges.some(e=>e.from==='binding:policy'&&e.to===dynamic.id&&e.kind==='dynamic-call'));assert.ok(b.edges.some(e=>e.from===dynamic.id&&e.to==='binding:policy'&&e.kind==='return'));
 assert.ok(!b.nodes.some(n=>n.label==='guessed-capability'));
});
test('a dense circuit keeps every operation and binding on one sheet with a component register',async()=>{
 const raw=rawFixture();const a=raw.graph.executionAuthorities[0];a.operations=Array.from({length:35},(_,i)=>({kind:'invoke-port',portId:'port-'+i}));raw.graph.interfaceAuthority.portBindings.push(...a.operations.map(o=>({portId:o.portId,platformCapabilityId:'transform.v1',configuration:{}})));
 const s=normalizeSnapshot(raw);const r=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId,view:'scenario',contextAltitude:7},{readEstate:async()=>s});assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
 const b=r.candidate.storyboard.blueprint,overview=r.candidate.storyboard.slides.find(s=>s.blueprint?.role==='overview');assert.equal(b.coverage.operations,36);assert.equal(overview.blueprint.nodes.length,b.nodes.length);assert.equal(overview.blueprint.edges.length,b.edges.length);assert.ok(r.candidate.storyboard.slides.some(s=>s.blueprint?.role==='register'));
});
test('unused bindings and missing call targets remain visible without invented root wires',()=>{
 const raw=rawFixture();raw.graph.interfaceAuthority.portBindings.push({portId:'unused',platformCapabilityId:'retained.v1',configuration:{}});raw.graph.executionAuthorities[0].operations.push({kind:'invoke-scenario',scenarioId:'missing'});
 const b=buildBlueprint(normalizeSnapshot(raw));assert.equal(b.nodes.find(n=>n.id==='binding:unused').used,false);assert.ok(!b.edges.some(e=>e.to==='binding:unused'));
 assert.equal(b.nodes.find(n=>n.id==='input:missing').missing,true);assert.ok(b.edges.some(e=>e.kind==='call'&&e.to==='input:missing'));assert.equal(Object.keys(layoutBlueprint(b).positions).length,b.nodes.length);
});
test('unattached authorities retain their operations, bindings, order and calls without a fabricated root path',()=>{
 const raw=rawFixture();raw.graph.executionAuthorities.push({id:'unattached.v1',owningScenarioId:'outside',operations:[{kind:'invoke-port',portId:'policy'},{kind:'invoke-scenario',scenarioId:'accept'}]});
 const b=buildBlueprint(normalizeSnapshot(raw)),first='operation:unattached.v1:1',second='operation:unattached.v1:2';
 assert.ok(b.edges.some(e=>e.from===first&&e.to==='binding:policy'));assert.ok(b.edges.some(e=>e.from===first&&e.to===second&&e.kind==='sequence'));assert.ok(b.edges.some(e=>e.from===second&&e.to==='input:accept'&&e.kind==='call'));assert.ok(!b.edges.some(e=>e.to===first&&e.kind==='entry'));
});
