import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rawFixture} from './fixtures/capability-presentation.mjs';
import {normalizeSnapshot} from '../src/capability-presentation/snapshot.mjs';
import {buildBlueprint} from '../src/capability-presentation/blueprint.mjs';
import {projectBlueprint} from '../src/capability-presentation/projection.mjs';
import {handle} from '../src/capability-presentation/provider.mjs';

test('an unbound executor retains the declared provider without inventing a platform',()=>{
 const raw=rawFixture();delete raw.graph.interfaceAuthority.portBindings[1].platformCapabilityId;
 const model=buildBlueprint(normalizeSnapshot(raw));
 const detail=projectBlueprint(model,{altitude:'provider',scenarioId:'accept',operationId:'operation:accept.v1:1'});
 assert.ok(detail.nodes.some(n=>n.id==='provider:example-provider'));
 assert.ok(!detail.nodes.some(n=>n.kind==='platform'));
 assert.ok(model.review.issues.some(i=>i.code==='PORT_PLATFORM_UNBOUND'&&i.nodeIds.includes('operation:accept.v1:1')));
 assert.equal(model.observations.state,'unobserved');
});

test('long scenario circuits retain every ordered operation and provider owner across pages',async()=>{
 const raw=rawFixture();
 const operations=Array.from({length:17},(_,i)=>({operationId:'step-'+(i+1),kind:'invoke-port',portId:i%5===4?'deliver':'policy'}));
 raw.graph.executionAuthorities[0].operations=operations;
 const snapshot=normalizeSnapshot(raw);
 const result=await handle({contractId:'capability-presentation-request.v1',capabilityId:'review-request',view:'scenario',scenarioId:'review',contextAltitude:1},{readEstate:async()=>snapshot});
 assert.equal(result.disposition,'AUTHORED',JSON.stringify(result.findings));
 const pages=result.candidate.storyboard.slides.filter(s=>s.blueprint?.role==='scenario-blueprint'&&s.blueprint.scenarioId==='review');
 assert.equal(pages.length,3);
 assert.deepEqual(result.candidate.storyboard.slides.slice(1,4),pages);
 assert.deepEqual(pages.map(p=>p.subtitle.split(' · ').at(-1)),['page 1/3','page 2/3','page 3/3']);
 assert.deepEqual(pages.map(p=>p.blueprint.inlineOperationIds.length),[7,7,3]);
 assert.deepEqual(pages.flatMap(p=>p.blueprint.inlineOperationIds),operations.map((_,i)=>'operation:review.v1:'+(i+1)));
 for(const page of pages){
  assert.equal(page.blueprint.pageCount,3);
  for(const port of page.blueprint.providerPorts) assert.ok(page.blueprint.inlineOperationIds.includes(port.operationId));
 }
 assert.deepEqual(pages.flatMap(p=>p.blueprint.providerPorts.map(p=>p.operationId)),[5,10,15].map(i=>'operation:review.v1:'+i));
});

test('review scene retains client input provenance, exact inline operations, and held admission',async()=>{
 const raw=rawFixture();
 raw.capability.definition_json=JSON.stringify({semantics:{readiness:{declaration:'REVIEWABLE',execution:'HELD',reason:'Private host bindings are not installed'}}});
 raw.provenance.admission='NOT_INSTALLED';
 raw.graph.contractAuthorities.contracts['request.v1'].schema['x-input-provider']={providerId:'client-input-provider',location:'client-terminal',privateMembers:['secret-canary']};
 const snapshot=normalizeSnapshot(raw);
 assert.ok(!JSON.stringify(snapshot).includes('secret-canary'));
 const result=await handle({contractId:'capability-presentation-request.v1',capabilityId:'review-request',view:'scenario',scenarioId:'review',contextAltitude:1},{readEstate:async()=>snapshot});
 assert.equal(result.disposition,'AUTHORED',JSON.stringify(result.findings));
 const scene=result.candidate.storyboard.slides.find(s=>s.blueprint?.role==='scenario-blueprint');
 assert.deepEqual(scene.blueprint.inlineOperationIds,['operation:review.v1:1','operation:review.v1:2']);
 assert.equal(scene.blueprint.inputProvider.providerId,'client-input-provider');
 const codes=result.candidate.storyboard.blueprint.review.issues.map(i=>i.code);
 assert.ok(codes.includes('DECLARED_EXECUTION_HELD'));
 assert.ok(codes.includes('CANDIDATE_NOT_INSTALLED'));
});
