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
