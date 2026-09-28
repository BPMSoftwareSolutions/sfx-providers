import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rawFixture} from './fixtures/capability-presentation.mjs';
import {normalizeSnapshot,digest} from '../src/capability-presentation/snapshot.mjs';
import {buildBlueprint} from '../src/capability-presentation/blueprint.mjs';
import {handle} from '../src/capability-presentation/provider.mjs';
import {invocationCondition,pathInShape,resultShape} from '../src/capability-presentation/invocation-evidence.mjs';

function fixture(){
 const raw=rawFixture();
 raw.graph.executionAuthorities[0].operations=[{kind:'invoke-port',portId:'policy'},{kind:'invoke-port',portId:'deliver'}];
 raw.graph.semanticTransformations[0].expression={op:'object',fields:{modelRequest:{op:'object',fields:{content:{op:'literal',value:'private input'}}}}};
 Object.assign(raw.graph.interfaceAuthority.portBindings[1].configuration,{invocationCondition:{path:'payload.authorization',equals:'AUTHORIZED',whenFalse:'preserve-carrier'},requestPath:'invocationRequest',resultPath:'evidence',resultMode:'bind-outcome'});
 return raw;
}

test('bound provider does not hide an absent invocation gate or latent request selector',async()=>{
 const snapshot=normalizeSnapshot(fixture()),model=buildBlueprint(snapshot);
 const issues=model.review.issues.filter(i=>i.code.startsWith('INVOCATION_'));
 assert.deepEqual(issues.map(i=>i.code),['INVOCATION_CONDITION_PATH_ABSENT','INVOCATION_REQUEST_PATH_ABSENT']);
 assert.ok(issues.every(i=>i.severity==='error'&&i.nodeIds.includes('operation:review.v1:2')&&i.nodeIds.includes('binding:deliver')));
 assert.ok(issues.every(i=>i.evidence.originOperationId==='operation:review.v1:1'&&i.evidence.execution==='not-observed'));
 assert.ok(issues[0].sourceRefs.includes('graph:/interfaceAuthority/portBindings/1/configuration/invocationCondition'));
 const r=await handle({contractId:'capability-presentation-request.v1',capabilityId:snapshot.identity.capabilityId},{readEstate:async()=>snapshot});
 assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
 const slides=r.candidate.storyboard.slides,scenario=slides[1];
 assert.ok(issues.every(i=>scenario.blueprint.bindingIssueIds.includes(i.id)));
 assert.ok(scenario.commands.some(c=>c.op==='t'&&c.args[0].includes('payload.authorization absent')));
 assert.ok(scenario.commands.some(c=>c.op==='t'&&c.args[0].includes('invocationRequest absent')));
 const detail=slides.find(s=>s.blueprint?.role==='invocation-inspection'&&s.blueprint.operationIds.includes('operation:review.v1:2'));
 assert.ok(detail.commands.some(c=>c.op==='t'&&c.args[0].includes('AUTHORIZED')));
 assert.ok(scenario.commands.some(c=>c.op==='t'&&c.args[9]?.slideIndex===slides.indexOf(detail)));
 const event=slides.find(s=>s.blueprint?.render&&s.blueprint.scenarioId==='review');
 assert.ok(issues.every(i=>event.blueprint.render.cells.find(c=>c.nodeId==='operation:review.v1:2').issues.includes(i.id)));
 assert.ok(!model.review.issues.some(i=>i.code==='PLATFORM_BINDING_WITHOUT_PROVIDER'&&i.nodeIds.includes('binding:deliver')));
 assert.ok(!JSON.stringify(snapshot).includes('private input'));
});

test('source mappings fix path findings without changing provider identity or circuit edges',()=>{
 const raw=fixture(),before=buildBlueprint(normalizeSnapshot(raw));
 raw.graph.semanticTransformations[0].expression.fields.payload={op:'object',fields:{authorization:{op:'literal',value:'AUTHORIZED'}}};
 raw.graph.interfaceAuthority.portBindings[1].configuration.requestPath='modelRequest';
 const after=buildBlueprint(normalizeSnapshot(raw));
 assert.ok(!after.review.issues.some(i=>i.code.startsWith('INVOCATION_')));
 assert.deepEqual(after.edges,before.edges);assert.deepEqual(after.nodes.map(n=>n.id),before.nodes.map(n=>n.id));
});

test('unknown, conditional and mapped predecessors never establish missing-path proof',()=>{
 for(const mutate of [
  raw=>{raw.graph.semanticTransformations[0].expression={op:'if',when:{op:'literal',value:true},then:{op:'object',fields:{}},else:{op:'path',path:'input'}};},
  raw=>{raw.graph.interfaceAuthority.portBindings[0].configuration.resultPath='child';},
  raw=>{raw.graph.interfaceAuthority.portBindings[0].configuration.invocationCondition={path:'ready',equals:true,whenFalse:'preserve-carrier'};},
  raw=>{raw.graph.executionAuthorities[0].operations.splice(1,0,{kind:'invoke-scenario',scenarioId:'accept'});},
 ]){const raw=fixture();mutate(raw);assert.ok(!buildBlueprint(normalizeSnapshot(raw)).review.issues.some(i=>i.code.startsWith('INVOCATION_')));}
 assert.equal(pathInShape(resultShape({op:'object',fields:{payload:{op:'path',path:'input'}}}),'payload.authorization'),'unknown');
 assert.equal(pathInShape(resultShape({op:'object',fields:{}}),'$/payload'),'unknown');
 const raw=fixture();raw.graph.interfaceAuthority.portBindings[1].configuration.invocationCondition.equals=null;
 assert.ok(!buildBlueprint(normalizeSnapshot(raw)).review.issues.some(i=>i.code==='INVOCATION_CONDITION_PATH_ABSENT'));
});

test('old snapshots disclose missing gate evidence; condition literals keep redaction boundaries',()=>{
 const s=normalizeSnapshot(fixture());delete s.bindings[1].invocationCondition;delete s.transformations[0].resultShape;
 const {snapshotDigest,...body}=s;s.snapshotDigest=digest(body);
 assert.ok(buildBlueprint(s).review.issues.some(i=>i.code==='INVOCATION_CONDITION_EVIDENCE_NOT_RETAINED'));
 for(const [path,equals]of [['payload.secret','PRIVATE_KEY'],['status','Bearer private-secret'],['status',{private:'secret'}]]){
  const c=invocationCondition({invocationCondition:{path,equals,whenFalse:'preserve-carrier'}});
  assert.match(c.equalsLabel,/withheld/);assert.match(c.equalsDigest,/^[a-f0-9]{64}$/);
 }
});
