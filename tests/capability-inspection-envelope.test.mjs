import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rawFixture} from './fixtures/capability-presentation.mjs';
import {normalizeSnapshot,digest} from '../src/capability-presentation/snapshot.mjs';
import {buildBlueprint} from '../src/capability-presentation/blueprint.mjs';
import {handle} from '../src/capability-presentation/provider.mjs';

function fixture(){
 const r=rawFixture();r.inspection={contractId:'capability-inspection-evidence.v1',estateModelId:42,capabilityId:r.capability.capability_id,
  capabilityVersionPk:9,definitionPk:11,definitionDigest:'a'.repeat(64),readings:[{kind:'detection',reading:'declared-reading',status:'READ',document:{findings:[
   {code:'INPUT_RULE',severity:'error',message:'Input constraint violated',nodeIds:['input:review'],sourceRefs:['model:constraint/1']},
   {code:'EVENT_RULE',severity:'warning',message:'Event scope incomplete',nodeIds:['event:review'],sourceRefs:['model:constraint/2']},
   {code:'UNRESOLVED_SUBJECT',severity:'warning',message:'Unresolved finding address',nodeIds:['missing-node'],sourceRefs:['model:constraint/3']}
  ]}},{kind:'verification',reading:'declared-property',status:'READ',document:{rows:[{scenario_id:'review',disposition:'PROVED',basis:'Only contract presence checked'},{scenario_id:'review',disposition:'NOT_FORMALLY_OBSERVABLE',basis:'No witness retained'}]}}],
  receipts:[],repairMap:{entries:[{findingCode:'INPUT_RULE',disposition:'REPAIR',requiredParameters:['capability_id','constraint']} ]},sourceGraphDigest:digest(r.graph)};
 return r;
}
test('declared findings decorate all semantic surfaces and keep unknown addresses visible',async()=>{
 const s=normalizeSnapshot(fixture()),m=buildBlueprint(s),r=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId},{readEstate:async()=>s});
 assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
 const main=r.candidate.storyboard.slides[1],byCode=code=>m.review.issues.find(i=>i.code===code);
 assert.ok(main.blueprint.inputIssueIds.includes(byCode('INPUT_RULE').id));
 assert.ok(main.blueprint.scenarioIssueIds.includes(byCode('EVENT_RULE').id));
 assert.ok(main.blueprint.globalIssueIds.includes(byCode('UNRESOLVED_SUBJECT').id));
 assert.equal(byCode('INPUT_RULE').repair.status,'MAPPED');assert.deepEqual(byCode('INPUT_RULE').repair.requiredParameters,['capability_id','constraint']);
 assert.equal(m.review.inspection.summary.proved,1);assert.equal(m.review.inspection.summary.other,1);
 assert.ok(r.candidate.storyboard.slides.some(p=>p.blueprint?.role==='inspection-evidence'&&p.detail.includes('Only contract presence checked')));
});
test('stale readings cannot reopen repaired findings or claim current proofs',()=>{
 const r=fixture();r.inspection.capabilityVersionPk=8;const m=buildBlueprint(normalizeSnapshot(r));
 assert.equal(m.review.inspection.status,'STALE');assert.equal(m.review.inspection.checks.length,0);
 assert.ok(!m.review.issues.some(i=>i.code==='INPUT_RULE'));
});
test('adding evidence preserves exact topology and reports missing readings',()=>{
 const r=fixture(),before=buildBlueprint(normalizeSnapshot(rawFixture()));r.inspection.readings.push({kind:'verification',reading:'not-served',status:'UNAVAILABLE'});
 const after=buildBlueprint(normalizeSnapshot(r));
 assert.deepEqual(after.nodes,before.nodes);assert.deepEqual(after.edges,before.edges);
 assert.equal(after.review.inspection.summary.read,2);assert.equal(after.review.inspection.summary.readings,3);
 assert.ok(after.review.inspection.checks.some(c=>c.disposition==='UNAVAILABLE'));
});
test('edge-only findings resolve to their owning scenarios without invented nodes',()=>{
 const r=fixture(),base=buildBlueprint(normalizeSnapshot(r)),edge=base.edges.find(e=>e.from==='input:review');
 r.inspection.readings[0].document.findings.push({code:'EDGE_RULE',severity:'error',message:'Declared edge condition failed',nodeIds:[edge.id],sourceRefs:[edge.ref]});
 const m=buildBlueprint(normalizeSnapshot(r)),f=m.review.issues.find(i=>i.code==='EDGE_RULE');
 assert.ok(f.scenarioIds.includes('review'));assert.equal(f.addressStatus,'LOCATED');
});
test('old snapshots have explicit unavailable inspection and retain valid digest checks',()=>{
 const s=normalizeSnapshot(rawFixture());delete s.inspection;const {snapshotDigest,...body}=s;s.snapshotDigest=digest(body);
 assert.equal(buildBlueprint(s).review.inspection.status,'UNAVAILABLE');
});
test('changed graph dependencies stale evidence even when the capability version stays unchanged',()=>{
 const r=fixture();r.graph.interfaceAuthority.portBindings[0].configuration.requestPath='new-input';
 const m=buildBlueprint(normalizeSnapshot(r));assert.equal(m.review.inspection.status,'STALE');
 assert.ok(!m.review.issues.some(i=>i.code==='INPUT_RULE'));
});
test('SQL JSON object-form node and source IDs resolve and preserve their provenance',()=>{
 const r=fixture();r.inspection.readings[0].document.findings=[{code:'PORT_RULE',severity:'error',message:'Bound port incompatible',nodeIds:[{id:'binding:policy'}],sourceRefs:[{id:'model:port_version/1'}]}];
 const m=buildBlueprint(normalizeSnapshot(r)),f=m.review.issues.find(i=>i.code==='PORT_RULE');
 assert.ok(f.scenarioIds.includes('review'));assert.ok(f.resolvedNodeIds.includes('operation:review.v1:1'));assert.ok(f.sourceRefs.includes('model:port_version/1'));
});
