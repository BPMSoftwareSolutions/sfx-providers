import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rawFixture} from './fixtures/capability-presentation.mjs';
import {normalizeSnapshot} from '../src/capability-presentation/snapshot.mjs';
import {buildBlueprint,layoutBlueprint} from '../src/capability-presentation/blueprint.mjs';
import {renderBlueprintSvg} from '../src/capability-presentation/blueprint-sheet.mjs';
import {projectBlueprint} from '../src/capability-presentation/projection.mjs';
import {handle} from '../src/capability-presentation/provider.mjs';

test('empty authority leaves a visible gap instead of manufacturing completion',()=>{
 const b=buildBlueprint(normalizeSnapshot(rawFixture()));
 assert.ok(!b.edges.some(e=>e.from==='input:refuse'&&e.to==='outcome:refuse'));
 const issue=b.review.issues.find(i=>i.code==='EXECUTION_AUTHORITY_EMPTY');
 assert.equal(issue.severity,'error');assert.deepEqual(issue.nodeIds,['event:refuse']);
 assert.ok(issue.sourceRefs.length);assert.equal(b.review.signal,'ISSUES_FOUND');
});
test('disconnects, missing bindings, unresolved selection and self-calls retain exact affected IDs',()=>{
 const raw=rawFixture();raw.graph.transitions=[];
 raw.graph.executionAuthorities[0].operations=[{kind:'invoke-port',portId:'absent'},{kind:'invoke-scenario',scenarioId:'review'},{kind:'invoke-port',portId:'policy'}];
 raw.graph.interfaceAuthority.portBindings[0].configuration.capabilityIdPath='selected.capability';
 const b=buildBlueprint(normalizeSnapshot(raw));
 const find=code=>b.review.issues.find(i=>i.code===code);
 assert.deepEqual(find('PORT_BINDING_MISSING').nodeIds,['operation:review.v1:1','port:absent']);
 assert.ok(find('SELF_CALL_BOUND_NOT_RETAINED').nodeIds.includes('operation:review.v1:2'));
 assert.equal(find('SCENARIO_DISCONNECTED').nodeIds[0],'event:accept');
 assert.equal(find('RUNTIME_TARGET_UNRESOLVED').severity,'warning');
 assert.equal(b.review.isAdmissionReceipt,false);
 assert.ok(b.sourceCoverage.every(i=>i.nodeIds.length||i.edgeIds.length));
});
test('scenario SVG shows only the semantic frame while the Event projection retains operations',()=>{
 const b=buildBlueprint(normalizeSnapshot(rawFixture())),l=layoutBlueprint(projectBlueprint(b,{altitude:'event'}));
 assert.deepEqual(Object.keys(l.positions),['operation:review.v1:1','operation:review.v1:2']);
 const svg=renderBlueprintSvg(b,{altitude:'scenario'});assert.match(svg,/GIVEN \/ INPUT/);assert.match(svg,/WHEN \/ EVENT/);assert.match(svg,/THEN \/ OUTCOME/);assert.doesNotMatch(svg,/ISSUES_FOUND/);
});
test('review signals are visible on the overview, repeated beside affected cells, and machine-readable',async()=>{
 const s=normalizeSnapshot(rawFixture()),r=await handle({contractId:'capability-presentation-request.v1',capabilityId:s.identity.capabilityId},{readEstate:async()=>s});
 assert.equal(r.disposition,'AUTHORED');const b=r.candidate.storyboard.blueprint,slide=r.candidate.storyboard.slides[1];
 const texts=slide.commands.filter(c=>c.op==='t').map(c=>c.args[0]);
 assert.ok(texts.some(t=>t.includes('Review ·')));
 const empty=b.review.issues.find(i=>i.code==='EXECUTION_AUTHORITY_EMPTY');assert.ok(texts.includes(empty.id));
 assert.ok(r.findings.some(f=>f.code==='EXECUTION_AUTHORITY_EMPTY'));
 assert.ok(r.candidate.storyboard.slides.some(s=>s.blueprint?.role==='review'));
 assert.equal(b.coverage.canonicalComplete,false);
});
test('mechanic operand trees retain deeper branches without treating literal data as executable nodes',()=>{
 const raw=rawFixture();let expression={op:'literal',value:{op:'not-executable',password:'never-retain'}};
 for(let i=0;i<8;i++)expression={op:'if',when:{op:'path',path:'condition'+i},then:expression,else:{op:'literal',value:'never-retain'}};
 raw.graph.semanticTransformations[0].expression=expression;
 const s=normalizeSnapshot(raw),t=s.transformations[0];assert.equal(t.cells.length,t.nodeCount);assert.ok(t.cells.length>t.preview.length);
 assert.ok(!JSON.stringify(s).includes('never-retain'));assert.ok(!t.cells.some(c=>c.op==='not-executable'));
 assert.ok(t.cells.some(c=>c.operand==='then'));assert.ok(t.cells.some(c=>c.operand==='when'));
 assert.equal(buildBlueprint(s).mechanismCircuits[0].complete,true);
});
