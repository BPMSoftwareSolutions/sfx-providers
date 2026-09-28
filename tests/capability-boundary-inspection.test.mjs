import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rawFixture} from './fixtures/capability-presentation.mjs';
import {normalizeSnapshot,digest} from '../src/capability-presentation/snapshot.mjs';
import {buildBlueprint} from '../src/capability-presentation/blueprint.mjs';
import {handle} from '../src/capability-presentation/provider.mjs';
import {emptyObjectEvidence} from '../src/capability-presentation/boundary-inspection.mjs';

function fixture(){
 const r=rawFixture();r.graph.executionAuthorities[0].operations=[{kind:'invoke-port',portId:'policy'},{kind:'invoke-port',portId:'deliver'}];
 r.graph.semanticTransformations[0].expression={op:'object',fields:{request:{op:'object',fields:{prompt:{op:'literal',value:'DO_NOT_RETAIN_SECRET'}}}}};
 const plan={capabilityId:'nested-worker',rootNodeId:'entry',nodes:[{nodeId:'entry',scenario:{input:{contract:{contractId:'planned-request.v1'}}},operations:[{operationId:'nested-start',kind:'invoke-port',mechanicBindingId:'run'}]}],
  mechanicBindings:[{bindingId:'run',configuration:{requestPath:'payload.plan',password:'DO_NOT_RETAIN_SECRET'}}]};
 Object.assign(r.graph.interfaceAuthority.portBindings[1].configuration,{requestPath:'request',declaredApplication:{executionPlanDocument:JSON.stringify(plan),nestedApplications:{arbitrary:{secret:'DO_NOT_RETAIN_SECRET'}}}});
 r.graph.interfaceAuthority.interfaces[0]={id:'inspect-cli',profile:'cli',rootScenarioId:'review',configuration:{display:{select:'outcome.payload',as:'json'}}};
 return r;
}
const review=r=>buildBlueprint(normalizeSnapshot(r));
const codes=m=>m.review.issues.map(i=>i.code);

test('unguarded nested handoff and display counterexample reach the main scenario sheet',async()=>{
 const s=normalizeSnapshot(fixture()),m=buildBlueprint(s),nested=m.review.issues.find(i=>i.code==='NESTED_INVOCATION_REQUEST_PATH_ABSENT'),display=m.review.issues.find(i=>i.code==='CLI_DISPLAY_SELECTOR_NOT_TOTAL');
 assert.ok(nested);assert.ok(display);assert.equal(nested.evidence.conditional,false);
 assert.equal(nested.evidence.proof.verdict,'disproved');assert.equal(nested.evidence.execution,'not-observed');
 assert.equal(nested.evidence.nestedOperationId,'nested-start');assert.ok(nested.sourceRefs.some(r=>r.endsWith('#/nodes/0/operations/0')));
 assert.deepEqual(display.evidence.proof.witness,{});assert.equal(display.evidence.proof.witnessAdmitted,true);
 assert.ok(!JSON.stringify(s).includes('DO_NOT_RETAIN_SECRET'));
 const result=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId},{readEstate:async()=>s});
 assert.equal(result.disposition,'AUTHORED',JSON.stringify(result.findings));
 const slides=result.candidate.storyboard.slides,main=slides[1];
 assert.ok(main.blueprint.scenarioIssueIds.includes(nested.id));assert.ok(main.blueprint.outcomeIssueIds.includes(display.id));
 for(const text of ['payload.plan absent','outcome.payload can hide details'])assert.ok(main.commands.some(c=>c.op==='t'&&c.args[0].includes(text)),text);
 for(const finding of [nested,display]){
  const target=slides.findIndex(p=>p.blueprint?.role==='boundary-inspection'&&p.blueprint.issueIds.includes(finding.id));
  assert.ok(target>=0);assert.ok(main.commands.some(c=>c.op==='t'&&c.args[9]?.slideIndex===target));
 }
});

test('source-compatible request and complete display selector close findings without topology edits',()=>{
 const r=fixture(),before=review(r);
 r.graph.semanticTransformations[0].expression.fields.request.fields.payload={op:'object',fields:{plan:{op:'object',fields:{}}}};
 r.graph.interfaceAuthority.interfaces[0].configuration.display.select='outcome';
 const after=review(r);assert.ok(!codes(after).includes('NESTED_INVOCATION_REQUEST_PATH_ABSENT'));assert.ok(!codes(after).includes('CLI_DISPLAY_SELECTOR_NOT_TOTAL'));
 assert.deepEqual(after.edges,before.edges);assert.deepEqual(after.nodes.map(n=>n.id),before.nodes.map(n=>n.id));
});

test('unguarded outer selectors are inspected too',()=>{
 const r=fixture();r.graph.interfaceAuthority.portBindings[1].configuration.requestPath='missing';
 const f=review(r).review.issues.find(i=>i.code==='INVOCATION_REQUEST_PATH_ABSENT');assert.ok(f);assert.equal(f.evidence.conditional,false);
});

test('opaque, absent and non-entry nested shapes remain explicitly unverified',()=>{
 for(const change of [
  r=>{delete r.graph.interfaceAuthority.portBindings[1].configuration.declaredApplication;r.graph.interfaceAuthority.portBindings[1].configuration.bindingRef='local/ref.json';},
  r=>{r.graph.interfaceAuthority.portBindings[1].configuration.declaredApplication.executionPlanDocument='not json';},
  r=>{r.graph.semanticTransformations[0].expression={op:'path',path:'.'};},
  r=>{const c=r.graph.interfaceAuthority.portBindings[1].configuration;const p=JSON.parse(c.declaredApplication.executionPlanDocument);p.nodes[0].operations.unshift({kind:'invoke-scenario',scenarioNodeId:'prepare'});c.declaredApplication.executionPlanDocument=JSON.stringify(p);},
 ]){const r=fixture();change(r);const c=codes(review(r));assert.ok(c.includes('NESTED_INVOCATION_INPUT_UNVERIFIED'));assert.ok(!c.includes('NESTED_INVOCATION_REQUEST_PATH_ABSENT'));}
});

test('nested guard makes the handoff finding conditional, never observed dispatch',()=>{
 const r=fixture(),c=r.graph.interfaceAuthority.portBindings[1].configuration,p=JSON.parse(c.declaredApplication.executionPlanDocument);
 p.mechanicBindings[0].configuration.invocationCondition={path:'ready',equals:true,whenFalse:'preserve-carrier'};c.declaredApplication.executionPlanDocument=JSON.stringify(p);
 const f=review(r).review.issues.find(i=>i.code==='NESTED_INVOCATION_REQUEST_PATH_ABSENT');assert.equal(f.evidence.conditional,true);assert.match(f.message,/If its guards allow entry/);
});

test('display proof rejects unsupported schemas and respects transformation precedence',()=>{
 for(const schema of [{$ref:'#/$defs/output'}, {allOf:[{required:['payload']}]},{const:{}},{minProperties:1,type:'object'},{type:'object',required:['payload']}])assert.notEqual(emptyObjectEvidence(schema).admitted,true);
 assert.equal(emptyObjectEvidence({type:'object',additionalProperties:false,properties:{payload:{type:'string'}}}).admitted,true);
 const r=fixture();r.graph.interfaceAuthority.interfaces[0].configuration.display.transformationId='failure-aware-display';
 assert.ok(!codes(review(r)).includes('CLI_DISPLAY_SELECTOR_NOT_TOTAL'));
});

test('old snapshots cannot silently claim boundary coverage',()=>{
 const s=normalizeSnapshot(fixture());delete s.bindings[1].nestedInvocation;delete s.contracts[1].emptyObjectEvidence;
 const {snapshotDigest,...body}=s;s.snapshotDigest=digest(body);
 assert.ok(codes(buildBlueprint(s)).includes('BOUNDARY_INSPECTION_EVIDENCE_NOT_RETAINED'));
});
