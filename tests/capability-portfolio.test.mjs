import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rawFixture} from './fixtures/capability-presentation.mjs';
import {normalizeSnapshot} from '../src/capability-presentation/snapshot.mjs';
import {buildBlueprint} from '../src/capability-presentation/blueprint.mjs';
import {projectBlueprint} from '../src/capability-presentation/projection.mjs';
import {layoutCapabilityPortfolio,validateCapabilityPortfolio} from '../src/capability-presentation/capability-sheet.mjs';
import {handle} from '../src/capability-presentation/provider.mjs';
import {renderBlueprintSvg} from '../src/capability-presentation/blueprint-sheet.mjs';
import {validateConnectorAttachment} from '../src/circuit-presentation/contracts.mjs';

test('portfolio preserves branch, call, join, recurrence and self-reference identities',()=>{
 const raw=rawFixture();raw.graph.transitions.push({transitionId:'join',from:{scenarioId:'accept'},to:{scenarioId:'refuse'},topologyKind:'join'},{transitionId:'again',from:{scenarioId:'refuse'},to:{scenarioId:'review'},topologyKind:'recurrence'},{transitionId:'self',from:{scenarioId:'review'},to:{scenarioId:'review'},topologyKind:'recurrence'});
 const p=projectBlueprint(buildBlueprint(normalizeSnapshot(raw))),before=structuredClone(p),layout=layoutCapabilityPortfolio(p);
 assert.deepEqual(p,before);assert.equal(Object.keys(layout.positions).length,3);assert.equal(layout.routes.length,6);
 assert.ok(layout.routes.some(e=>e.kind==='call'));assert.ok(layout.routes.some(e=>e.topologyKind==='join'));assert.ok(layout.routes.some(e=>e.from===e.to));
 assert.deepEqual(layout.routes.map(e=>[e.id,e.from,e.to]),p.edges.filter(e=>e.kind!=='scenario-provider').map(e=>[e.id,e.from,e.to]));
 assert.deepEqual(layout.badges,p.edges.filter(e=>e.kind==='scenario-provider'));
});

test('portfolio contract rejects missing scenarios, altered provider provenance and misplaced wires',()=>{
 const p=projectBlueprint(buildBlueprint(normalizeSnapshot(rawFixture()))),base=layoutCapabilityPortfolio(p);
 for(const mutate of [l=>delete l.positions['scenario:review'],l=>l.routes.pop(),l=>l.badges[0].via[0].bindingId='invented',l=>l.routes[0].points[0][0]+=1,l=>l.positions['scenario:review'].x=-1,l=>l.width=NaN]){
  const l=structuredClone(base);mutate(l);assert.throws(()=>validateCapabilityPortfolio(p,l));
 }
});

test('one scenario with many operations remains one scenario and retains every provider badge',async()=>{
 const raw=rawFixture();raw.graph.transitions=[];raw.graph.executionAuthorities[0].operations=Array.from({length:35},(_,i)=>({kind:'invoke-port',portId:'route-'+i}));
 raw.graph.interfaceAuthority.portBindings.push(...raw.graph.executionAuthorities[0].operations.map((o,i)=>({portId:o.portId,platformCapabilityId:'http.v1',configuration:i<2?{providerId:'provider-'+i}:{}})));
 const s=normalizeSnapshot(raw),r=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId,view:'event',contextAltitude:7},{readEstate:async()=>s});
 assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
 const story=r.candidate.storyboard,p=story.slides.find(s=>s.blueprint?.altitude==='capability'),portfolio=p.blueprint.portfolio;
 assert.equal(p.title,'Capability circuit blueprint');assert.deepEqual(portfolio.scenarioIds,['scenario:review']);assert.equal(portfolio.routes.length,0);assert.equal(portfolio.badges.length,2);
 assert.equal(portfolio.badges.flatMap(e=>e.via).length,2);
 assert.ok(!portfolio.scenarioIds.includes('scenario:accept'));assert.ok(story.slides.some(s=>s.blueprint?.role==='inventory'));
 const target=p.commands.find(c=>c.op==='t'&&c.args[0]==='Open scenario circuit blueprint').args[9].slideIndex;
 assert.equal(target,1);assert.equal(story.slides[target].blueprint.role,'scenario-blueprint');
 assert.equal(story.slides[2].blueprint.render.cells.length,35);
 assert.deepEqual(p.blueprint.outcomeVariantIds,s.scenarios[0].variants.map(v=>v.id));
 const svg=renderBlueprintSvg(story.blueprint,{altitude:'capability'},s);assert.ok(svg.includes('Capability circuit blueprint'));assert.ok(svg.includes('provider-0')&&svg.includes('provider-1'));
});

test('eight root-connected scenarios retain every call, long label and input field',async()=>{
 const raw=rawFixture(),root=raw.graph.scenarios[0],authority=raw.graph.executionAuthorities[0];
 const names=['validate-blueprint-inspection-request','inspect-semantic-precedence','inspect-declared-field-support','inspect-altitude-appropriate-cell-geometry','inspect-feature-obligation-and-partition-coverage','inspect-observability-and-service-level-coverage','bind-blueprint-conformance-disposition'];
 raw.graph.transitions=[];raw.graph.scenarios=[root,...names.map(id=>({scenarioId:id,name:id,event:{eventId:id,executionAuthorityId:id+'.v1'},outcome:{outcomeId:id,terminal:true}}))];
 authority.operations=names.map(scenarioId=>({kind:'invoke-scenario',scenarioId}));
 raw.graph.executionAuthorities=[authority,...names.map(id=>({id:id+'.v1',owningScenarioId:id,operations:[]}))];
 const properties=Object.fromEntries(['candidate','featureAuthority','admittedPrecedents','designPartitionLedger','providerCandidateCompletenessRequest'].map(key=>[key,{type:'object'}]));
 raw.graph.contractAuthorities.contracts['request.v1'].schema={type:'object',properties:{payload:{type:'object',properties}}};
 const s=normalizeSnapshot(raw),r=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId,view:'capability',contextAltitude:7},{readEstate:async()=>s});
 assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
 const story=r.candidate.storyboard,portfolio=story.slides.find(p=>p.blueprint?.portfolio).blueprint;
 assert.equal(portfolio.portfolio.scenarioIds.length,8);assert.equal(portfolio.portfolio.routes.length,7);assert.equal(portfolio.portfolio.badges.length,0);assert.equal(portfolio.inputFieldPaths.length,5);
 assert.equal(portfolio.glyphs.length,8);assert.equal(new Set(portfolio.glyphs.map(g=>g.nodeId)).size,8);
 for(const edge of portfolio.portfolio.routes){
  assert.doesNotThrow(()=>validateConnectorAttachment(edge.points,{sourceNormal:[1,0],targetNormal:[-1,0],minimumLead:24}));
  const end=edge.points.at(-1),previous=edge.points.at(-2);assert.equal(previous[1],end[1]);assert.ok(previous[0]<end[0]);
 }
 const rendered=story.slides.find(p=>p.blueprint?.portfolio).commands.filter(c=>c.op==='route'&&c.args[2].attachment);
 assert.equal(rendered.length,7);for(const c of rendered)assert.doesNotThrow(()=>validateConnectorAttachment(c.args[0],c.args[2].attachment));
 const event=story.slides.find(p=>p.blueprint?.render&&p.blueprint.scenarioId==='review').blueprint.render;
 assert.ok(event.rows.length>1,'Long call identifiers require fewer columns');
 assert.equal(event.cells.length,7);assert.equal(event.routes.length,6);assert.ok(event.cells.every(c=>c.fontSize>=8));
 assert.deepEqual(event.cells.map(c=>c.caption.replaceAll(' ','-')),names);
 const links=story.slides.find(p=>p.blueprint?.portfolio).commands.filter(c=>c.op==='t'&&c.args[9]?.slideIndex!=null).map(c=>story.slides[c.args[9].slideIndex].blueprint?.scenarioId);
 for(const id of ['review',...names])assert.ok(links.includes(id),'Missing drill-down: '+id);
});

test('portfolio validation catches the screenshot defect even when both endpoints still belong to cards',()=>{
 const p=projectBlueprint(buildBlueprint(normalizeSnapshot(rawFixture()))),layout=layoutCapabilityPortfolio(p);
 const e=layout.routes[0],target=layout.positions[e.to],end=e.points.at(-1),start=e.points[0];
 e.points=[start,[start[0]+24,start[1]],[start[0]+24,target.y-12],[target.x,target.y-12],end];e.routing='orthogonal';
 assert.throws(()=>validateCapabilityPortfolio(p,layout),{code:'CIRCUIT_CONNECTOR_ATTACHMENT_INVALID'});
 const wrongSide=layoutCapabilityPortfolio(p),wire=wrongSide.routes[0],box=wrongSide.positions[wire.to];
 wire.points.at(-1)[0]=box.x+box.w;wire.routing='orthogonal';
 assert.throws(()=>validateCapabilityPortfolio(p,wrongSide),{code:'CAPABILITY_PORTFOLIO_INVALID'},'A perpendicular arrow on the wrong side must still fail ownership validation');
});
