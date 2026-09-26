import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rawFixture} from './fixtures/capability-presentation.mjs';
import {normalizeSnapshot} from '../src/capability-presentation/snapshot.mjs';
import {buildBlueprint} from '../src/capability-presentation/blueprint.mjs';
import {projectBlueprint} from '../src/capability-presentation/projection.mjs';
import {layoutEventCircuit,validateEventLayout,eventAction} from '../src/capability-presentation/event-sheet.mjs';
import {handle} from '../src/capability-presentation/provider.mjs';

function denseFixture(){
 const raw=rawFixture();
 raw.graph.executionAuthorities[0].operations=Array.from({length:35},(_,i)=>({kind:'invoke-port',portId:['build-binding-request','bind-provider-credential','build-exchange-request','observe-exchange','select-route'][i%5]+'-'+i}));
 raw.graph.interfaceAuthority.portBindings.push(...raw.graph.executionAuthorities[0].operations.map(o=>({portId:o.portId,platformCapabilityId:'transform.v1',configuration:{}})));
 return normalizeSnapshot(raw);
}

test('35 retained operations form five readable rows with all four exact continuation edges',()=>{
 const b=buildBlueprint(denseFixture()),p=projectBlueprint(b,{altitude:'event'}),l=layoutEventCircuit(p);
 assert.equal(l.rows.length,5);assert.equal(Object.keys(l.positions).length,35);assert.equal(l.routes.length,34);
 assert.deepEqual(l.rows.map(r=>[r.first,r.last]),[[1,7],[8,14],[15,21],[22,28],[29,35]]);
 assert.deepEqual(l.routes.filter(e=>e.routing==='orthogonal').map(e=>[p.nodes.find(n=>n.id===e.from).ordinal,p.nodes.find(n=>n.id===e.to).ordinal]),[[7,8],[14,15],[21,22],[28,29]]);
 assert.deepEqual(l.routes.map(e=>[e.id,e.from,e.to]),p.edges.map(e=>[e.id,e.from,e.to]));
 assert.ok(l.rows.every(r=>r.basis==='layout-only'));
});

test('render contract rejects omitted edges, swapped endpoints, cell-crossing wires and out-of-bounds cells',()=>{
 const p=projectBlueprint(buildBlueprint(denseFixture()),{altitude:'event'}),base=layoutEventCircuit(p);
 const bad=mutate=>{const l=structuredClone(base);mutate(l);assert.throws(()=>validateEventLayout(p,l));};
 bad(l=>l.routes.pop());bad(l=>l.routes[0].to=p.nodes[2].id);bad(l=>l.positions[p.nodes[0].id].x=-1);
 bad(l=>{const r=l.routes[6],b=l.positions[p.nodes[2].id];r.points[2][1]=b.y+b.h/2;r.points[3][1]=b.y+b.h/2;});
});

test('action styling derives only from declared identifier prefixes and has a neutral fallback',()=>{
 for(const [label,kind]of [['build-request','build'],['bind-credential','bind'],['observe-response','observe'],['normalize-evidence','select'],['select-route','select'],['opaque-operation','other']]){
  const action=eventAction({label});assert.equal(action.category,kind);assert.equal(action.sourceLabel,label);assert.equal(action.basis,'identifier-prefix');
 }
});

test('dense Event labels retain readable fonts and native operation links with a separate scenario blueprint',async()=>{
 const s=denseFixture(),r=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId,view:'event',contextAltitude:7},{readEstate:async()=>s});
 assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
 const slides=r.candidate.storyboard.slides,event=slides[2],summary=slides[1];
 assert.equal(event.headerLayout,'custom');assert.equal(event.blueprint.render.cells.length,35);
 assert.ok(event.blueprint.render.cells.every(c=>c.fontSize>=8));
 assert.equal(summary.blueprint.role,'scenario-blueprint');assert.deepEqual(summary.blueprint.nodes,projectBlueprint(r.candidate.storyboard.blueprint,{altitude:'scenario'}).nodes.map(n=>n.id));
 const nav=event.commands.find(c=>c.op==='t'&&c.args[0]==='Scenario blueprint');assert.equal(nav.args[9].slideIndex,1);
 const back=summary.commands.find(c=>c.op==='t'&&c.args[0]==='Complete execution circuit');assert.equal(back.args[9].slideIndex,2);
 assert.deepEqual(slides.map(s=>s.id),slides.map((_,i)=>'slide-'+(i+1)));
 assert.equal(event.commands.filter(c=>c.op==='t'&&slides[c.args[9]?.slideIndex]?.blueprint?.role==='provider-detail').length,35);
});

test('scenario provider ports retain exact evidence and never assign an unbound provider to an exchange',async()=>{
 const raw=rawFixture();raw.graph.semanticTransformations[0].expression={op:'object',fields:{providerTestimony:{op:'object',fields:{providerId:{op:'literal',value:'declared/testimony'}}}}};
 const s=normalizeSnapshot(raw),r=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId,contextAltitude:7},{readEstate:async()=>s});
 assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
 const summary=r.candidate.storyboard.slides[1],ports=summary.blueprint.providerPorts;
 assert.equal(ports.length,1);assert.equal(ports[0].operationId,'operation:review.v1:1');assert.equal(ports[0].basis,'declared provider testimony');
 assert.ok(summary.detail.includes('/fields/providerTestimony/fields/providerId/value'));
 assert.ok(!ports.some(p=>p.operationId==='operation:accept.v1:1'));
});
