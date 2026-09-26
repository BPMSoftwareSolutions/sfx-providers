import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rawFixture} from './fixtures/capability-presentation.mjs';
import {normalizeSnapshot} from '../src/capability-presentation/snapshot.mjs';
import {buildBlueprint,layoutBlueprint} from '../src/capability-presentation/blueprint.mjs';
import {projectBlueprint} from '../src/capability-presentation/projection.mjs';
import {handle} from '../src/capability-presentation/provider.mjs';

function fixture(){
 const raw=rawFixture();
 raw.graph.interfaceAuthority.portBindings[0]={portId:'policy',platformCapabilityId:'http.v1',configuration:{providerId:'policy-provider'}};
 raw.graph.interfaceAuthority.portBindings.push({portId:'unused',platformCapabilityId:'http.v1',configuration:{providerId:'unused-provider'}});
 return normalizeSnapshot(raw);
}

test('provider involvement retains exact scenario-operation-binding evidence without shared-platform leakage',()=>{
 const model=buildBlueprint(fixture()),p=projectBlueprint(model);
 assert.deepEqual(p.nodes.filter(n=>n.kind==='provider').map(n=>n.label).sort(),['example-provider','policy-provider']);
 const links=p.edges.filter(e=>e.kind==='scenario-provider');assert.equal(links.length,2);
 for(const [sc,provider,port]of [['review','policy-provider','policy'],['accept','example-provider','deliver']]){
  const edge=links.find(e=>e.from==='scenario:'+sc);assert.equal(edge.to,'provider:'+provider);
  assert.equal(edge.via[0].bindingId,'binding:'+port);assert.equal(edge.via[0].operationId,'operation:'+sc+'.v1:1');
  assert.equal(edge.sourceEdgeIds.length,4);assert.ok(edge.sourceEdgeIds.every(id=>model.edges.some(e=>e.id===id)));
  const detail=projectBlueprint(model,{altitude:'provider',scenarioId:sc,operationId:edge.via[0].operationId});
  assert.deepEqual(detail.nodes.filter(n=>n.kind==='provider').map(n=>n.label),[provider]);
 }
 assert.ok(!p.nodes.some(n=>n.id==='provider:unused-provider'));
});

test('repeated uses share one provider glyph while retaining every owning operation',()=>{
 const raw=rawFixture();raw.graph.executionAuthorities[1].operations.push({kind:'invoke-port',portId:'deliver'});
 const p=projectBlueprint(buildBlueprint(normalizeSnapshot(raw)));
 assert.equal(p.nodes.filter(n=>n.kind==='provider').length,1);
 const link=p.edges.find(e=>e.kind==='scenario-provider');assert.equal(link.via.length,2);
 assert.deepEqual(link.via.map(v=>v.operationId),['operation:accept.v1:1','operation:accept.v1:2']);
 const l=layoutBlueprint(p);assert.equal(l.routes.length,p.edges.length);
 for(const r of l.routes.filter(e=>e.kind==='scenario-provider')){
  const a=l.positions[r.from],b=l.positions[r.to];
  assert.deepEqual(r.points[0],[a.x+a.w/2,a.y]);assert.deepEqual(r.points.at(-1),[b.x+b.w/2,b.y+b.h]);
 }
});

test('unconnected scenarios and platform-only bindings do not invent provider involvement',()=>{
 const raw=rawFixture();raw.graph.transitions=[];raw.graph.executionAuthorities[0].operations=[{kind:'invoke-port',portId:'policy'}];
 const p=projectBlueprint(buildBlueprint(normalizeSnapshot(raw)));
 assert.deepEqual(p.nodes.map(n=>n.id),['scenario:review']);
 assert.equal(p.edges.length,0);
});

test('capability provider captions link to an operation with that exact declared provider',async()=>{
 const s=fixture(),r=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId,contextAltitude:7},{readEstate:async()=>s});
 assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
 const slides=r.candidate.storyboard.slides,cap=slides[1];
 for(const label of ['policy-provider','example-provider']){
  const text=cap.commands.find(c=>c.op==='t'&&c.args[0].replaceAll('\n','')===label);assert.ok(text,label);
  const dest=slides[text.args[9].slideIndex];assert.equal(dest.blueprint.role,'provider-inspection');
  assert.ok(dest.detail.includes(label.replaceAll(' ','-')));
  assert.ok(dest.commands.some(c=>c.op==='t'&&slides[c.args[9]?.slideIndex]?.blueprint?.role==='provider-detail'));
 }
});

test('transformation testimony exposes omitted identities with provenance but does not assign them to shared exchanges',()=>{
 const raw=rawFixture();
 raw.graph.semanticTransformations[0].expression={op:'object',fields:{providerTestimony:{op:'object',fields:{providerId:{op:'literal',value:'another/provider'},bindingId:{op:'literal',value:'another.binding.v1'}}},payload:{op:'literal',value:{providerId:'not-authority',secret:'never-retain'}}}};
 const s=normalizeSnapshot(raw),t=s.transformations[0];
 assert.equal(t.providerReferences[0].providerId,'another/provider');assert.equal(t.providerReferences[0].basis,'declared provider testimony');assert.ok(!JSON.stringify(s).includes('never-retain'));
 const model=buildBlueprint(s),p=projectBlueprint(model),edge=p.edges.find(e=>e.to==='provider:another/provider');
 assert.equal(edge.from,'scenario:review');assert.equal(edge.via[0].operationId,'operation:review.v1:1');assert.equal(edge.via[0].basis,'declared provider testimony');
 assert.ok(edge.sourceRefs.some(r=>r.endsWith('/fields/providerTestimony/fields/providerId/value')));
 assert.ok(!projectBlueprint(model,{altitude:'provider',scenarioId:'accept',operationId:'operation:accept.v1:1'}).nodes.some(n=>n.id==='provider:another/provider'));
});

test('endpoint bindings without identity and old snapshots produce explicit inspection gaps',()=>{
 const raw=rawFixture();delete raw.graph.interfaceAuthority.portBindings[1].configuration.providerId;
 const s=normalizeSnapshot(raw),model=buildBlueprint(s);
 const issue=model.review.issues.find(i=>i.code==='ENDPOINT_BINDING_WITHOUT_PROVIDER_ID');
 assert.ok(issue.nodeIds.includes('operation:accept.v1:1'));assert.ok(issue.sourceRefs.includes(s.bindings[1].sourceRef));
 delete s.transformations[0].providerReferences;
 assert.ok(buildBlueprint(s).review.issues.some(i=>i.code==='TRANSFORMATION_PROVIDER_REFERENCES_NOT_RETAINED'));
});
