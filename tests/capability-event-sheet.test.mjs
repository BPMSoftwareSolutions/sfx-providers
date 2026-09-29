import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rawFixture} from './fixtures/capability-presentation.mjs';
import {normalizeSnapshot} from '../src/capability-presentation/snapshot.mjs';
import {buildBlueprint} from '../src/capability-presentation/blueprint.mjs';
import {projectBlueprint} from '../src/capability-presentation/projection.mjs';
import {layoutEventCircuit,validateEventLayout,eventAction,eventComponent} from '../src/capability-presentation/event-sheet.mjs';
import {COMPONENT_STYLE,validateComponentStyle,glyphAnchor} from '../src/capability-presentation/component-glyphs.mjs';
import {handle} from '../src/capability-presentation/provider.mjs';

function denseFixture(platforms=['transform.v1']){
 const raw=rawFixture();
 raw.graph.executionAuthorities[0].operations=Array.from({length:35},(_,i)=>({kind:'invoke-port',portId:['build-binding-request','bind-provider-credential','build-exchange-request','observe-exchange','select-route'][i%5]+'-'+i}));
 raw.graph.interfaceAuthority.portBindings.push(...raw.graph.executionAuthorities[0].operations.map((o,i)=>({portId:o.portId,platformCapabilityId:platforms[i%platforms.length],configuration:{}})));
 return normalizeSnapshot({...raw,platformImplementations:platforms.map(p=>({platform_capability_id:p,provider_id:'declared-platform-provider',target_language:'node',declaration_status:'ADMITTED'}))});
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

test('Event symbols follow exact binding types even when labels suggest a different role',()=>{
 const b=buildBlueprint(denseFixture()),p=projectBlueprint(b,{altitude:'event'}),n=p.nodes[0];
 const binding=b.nodes.find(v=>v.id==='binding:'+n.portId);
 const before=structuredClone(n);
 for(const [id,glyph] of [['sda-external-credential-reference-binding-port.v1','event-adapter'],['sda-governed-http-exchange-port.v1','event-device'],['sda-authority-transformation-port.v1','event-transform']]){
  binding.platformCapabilityId=id;const c=eventComponent(b,n);
  assert.equal(c.glyph,glyph);assert.equal(c.basis,'declared-platform-binding');
  assert.equal(c.bindingId,binding.id);assert.equal(c.sourceRef,binding.ref);assert.equal(c.platformCapabilityId,id);
 }
 assert.deepEqual(n,before);
 binding.platformCapabilityId='unknown-http-lookalike';assert.equal(eventComponent(b,n).glyph,'event-execution');
 binding.platformCapabilityId='constructor';assert.equal(eventComponent(b,n).glyph,'event-execution');
 const unbound={...n,portId:'missing',label:'select-route'};
 assert.equal(eventComponent(b,unbound).basis,'unclassified');assert.equal(eventComponent(b,unbound).glyph,'event-execution');
 assert.equal(eventComponent(b,{...unbound,operationKind:'invoke-scenario'}).glyph,'event-call');
});

test('JSON Event mappings drive glyphs and connector anchors without changing the graph',()=>{
 const b=buildBlueprint(denseFixture()),p=projectBlueprint(b,{altitude:'event'}),before=structuredClone(p),style=structuredClone(COMPONENT_STYLE);
 style.event.platforms['transform.v1']={glyph:'socket',label:'Custom symbol'};validateComponentStyle(style);
 const l=layoutEventCircuit(p,{model:b,style});assert.deepEqual(p,before);
 for(const e of l.routes){
  assert.deepEqual(e.points[0],glyphAnchor(p.nodes.find(n=>n.id===e.from),l.positions[e.from],'right',style,'socket'));
  assert.deepEqual(e.points.at(-1),glyphAnchor(p.nodes.find(n=>n.id===e.to),l.positions[e.to],'left',style,'socket'));
 }
 const invalid=structuredClone(l);invalid.components[p.nodes[0].id].glyph='gate';
 assert.throws(()=>validateEventLayout(p,invalid,{model:b,style}),{code:'CAPABILITY_EVENT_RENDER_INVALID'});
});

test('all three bound component families fit a dense Event and preserve operation and edge coverage',async()=>{
 const s=denseFixture(['sda-authority-transformation-port.v1','sda-external-credential-reference-binding-port.v1','sda-governed-http-exchange-port.v1']);
 const r=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId,view:'event',contextAltitude:7},{readEstate:async()=>s});
 assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
 const slide=r.candidate.storyboard.slides[2],render=slide.blueprint.render,p=projectBlueprint(r.candidate.storyboard.blueprint,{altitude:'event'});
 assert.equal(render.cells.length,35);assert.equal(render.routes.length,34);
 assert.equal(new Set(render.cells.map(c=>c.component.glyph)).size,3);
 assert.ok(render.cells.every(c=>c.fontSize>=8&&c.component.bindingId&&c.component.sourceRef));
 assert.deepEqual(render.cells.map(c=>c.nodeId),p.nodes.map(n=>n.id));
 assert.deepEqual(render.routes.map(e=>[e.id,e.from,e.to]),p.edges.map(e=>[e.id,e.from,e.to]));
 assert.equal(slide.blueprint.glyphs.length,35,'Legend symbols must not enter topology records');
 assert.ok(!slide.blueprint.glyphs.some(g=>g.glyph==='gate'));
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

test('scenario operation references reuse the complete Event component symbols and preserve provider ownership',async()=>{
 const raw=rawFixture();
 raw.graph.executionAuthorities[0].operations=[{kind:'invoke-port',portId:'observe-exchange'},{kind:'invoke-port',portId:'select-route'}];
 raw.graph.interfaceAuthority.portBindings.push(
  {portId:'observe-exchange',platformCapabilityId:'sda-governed-http-exchange-port.v1',configuration:{providerId:'example-provider'}},
  {portId:'select-route',platformCapabilityId:'sda-authority-transformation-port.v1',configuration:{transformationId:'policy.v1'}});
 raw.graph.semanticTransformations[0].expression={op:'object',fields:{providerTestimony:{op:'object',fields:{providerId:{op:'literal',value:'example-provider'}}}}};
 const s=normalizeSnapshot(raw),r=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId,view:'event',contextAltitude:7},{readEstate:async()=>s});
 assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
 const slides=r.candidate.storyboard.slides,summary=slides[1],event=slides[2],ports=summary.blueprint.providerPorts;
 assert.deepEqual(ports.map(p=>p.component.glyph),['event-device','event-transform']);
 assert.deepEqual(ports.map(p=>p.basis),['declared provider','declared provider testimony']);
 for(const port of ports){
  const cell=event.blueprint.render.cells.find(c=>c.nodeId===port.operationId);
  assert.deepEqual(port.component,cell.component);assert.deepEqual(port.action,cell.action);
  const glyph=summary.blueprint.glyphs.find(g=>g.nodeId===port.operationId);
  assert.equal(glyph.glyph,cell.component.glyph);assert.deepEqual(glyph.anchors.right,port.anchor);
  const wire=summary.commands.find(c=>c.op==='route'&&JSON.stringify(c.args[0][0])===JSON.stringify(port.anchor));
  assert.ok(wire);assert.equal(wire.args[2].dash,port.basis!=='declared provider');
  const nativeLink=summary.commands.find(c=>c.op==='t'&&c.args[0]===(port.component.glyph==='event-device'?'observe exchange':'select route'));
  assert.ok(slides[nativeLink.args[9].slideIndex].blueprint.operationIds.includes(port.operationId));
 }
 assert.equal(summary.blueprint.nodes.length,3);assert.equal(summary.blueprint.disclosedOperationIds.length,2);
});

test('scenario calls run left-to-right across provider groups and connect directly to their owning event',async()=>{
 const raw=rawFixture();
 raw.graph.executionAuthorities[0].operations=Array.from({length:3},(_,i)=>({kind:'invoke-port',portId:'call-'+i}));
 raw.graph.interfaceAuthority.portBindings.push(...raw.graph.executionAuthorities[0].operations.map((op,i)=>({portId:op.portId,platformCapabilityId:'query.v1',configuration:{providerId:i===1?'provider-b':'provider-a'}})));
 const s=normalizeSnapshot(raw),r=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId,contextAltitude:7},{readEstate:async()=>s});
 assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
 const slide=r.candidate.storyboard.slides[1],ports=[...slide.blueprint.providerPorts].sort((a,b)=>a.bounds.x-b.bounds.x);
 assert.deepEqual(ports.map(p=>p.portId),['call-0','call-1','call-2']);
 assert.deepEqual(ports.map(p=>p.providerId),['provider:provider-a','provider:provider-b','provider:provider-a']);
 assert.equal(new Set(ports.map(p=>p.bounds.y)).size,1);
 const event=slide.blueprint.glyphs.find(g=>g.kind==='event');
 for(const port of ports){
  assert.equal(port.eventId,event.nodeId);
  assert.equal(port.eventAnchor[1],event.bounds.y);
  assert.deepEqual(port.eventRoute[0],port.eventAnchor);
  assert.deepEqual(port.eventRoute.at(-1),slide.blueprint.glyphs.find(g=>g.nodeId===port.operationId).anchors.bottom);
  assert(slide.commands.some(c=>c.op==='route'&&JSON.stringify(c.args[0])===JSON.stringify(port.eventRoute)));
 }
 assert.equal(slide.blueprint.providerCallLayout.total,3);
});

test('dense scenario summaries disclose their limit and retain all calls in the complete circuit',async()=>{
 const s=denseFixture(),r=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId,contextAltitude:7},{readEstate:async()=>s});
 const slide=r.candidate.storyboard.slides[1];
 // Platform implementation inventory alone must not invent explicit references.
 assert.equal(slide.blueprint.providerCallLayout.total,0);
 const raw=rawFixture();raw.graph.executionAuthorities[0].operations=Array.from({length:8},(_,i)=>({kind:'invoke-port',portId:'call-'+i}));
 raw.graph.interfaceAuthority.portBindings.push(...raw.graph.executionAuthorities[0].operations.map(op=>({portId:op.portId,platformCapabilityId:'query.v1',configuration:{providerId:'same-provider'}})));
 const x=normalizeSnapshot(raw),result=await handle({contractId:'capability-presentation-request.v1',capabilityId:x.identity.capabilityId,contextAltitude:7},{readEstate:async()=>x});
 assert.equal(result.disposition,'AUTHORED',JSON.stringify(result.findings));
 const summary=result.candidate.storyboard.slides[1];assert.equal(summary.blueprint.providerCallLayout.total,8);assert.equal(summary.blueprint.providerPorts.length,5);
 assert(summary.commands.some(c=>c.op==='t'&&c.args[0].includes('5 of 8 provider calls')));
 assert.equal(result.candidate.storyboard.slides.find(s=>s.blueprint?.render?.cells?.length===8).blueprint.render.cells.length,8);
});
