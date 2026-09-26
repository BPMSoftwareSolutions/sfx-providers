import assert from 'node:assert/strict';
import {test} from 'node:test';
import {COMPONENT_STYLE,componentGlyph,drawComponentGlyph,glyphAnchor,validateComponentStyle} from '../src/capability-presentation/component-glyphs.mjs';
import {buildBlueprint,layoutBlueprint} from '../src/capability-presentation/blueprint.mjs';
import {projectBlueprint} from '../src/capability-presentation/projection.mjs';
import {normalizeSnapshot} from '../src/capability-presentation/snapshot.mjs';
import {rawFixture} from './fixtures/capability-presentation.mjs';
import {compilePresentation} from '../src/circuit-presentation/compile.mjs';

test('component symbols follow declared kinds, with a gate only for an exact conditional declaration',()=>{
 const names=['port','binding','provider','platform','input'].map(kind=>componentGlyph({kind}).name);
 assert.equal(new Set(names).size,5);
 assert.equal(componentGlyph({kind:'mechanic',label:'if'}).name,'gate');
 assert.equal(componentGlyph({kind:'operation',label:'select-route'}).name,'execution');
 assert.equal(componentGlyph({kind:'unknown',label:'invented-gate'}).name,'execution');
});

test('JSON-only style changes alter native symbols without altering node identity or label',async()=>{
 const node={id:'provider:example',kind:'provider',label:'example'},before=structuredClone(node),style=structuredClone(COMPONENT_STYLE);
 style.roles.provider='terminal';validateComponentStyle(style);
 const commands=[],p={blueprint:{},add:(op,...args)=>commands.push({op,args})};
 drawComponentGlyph(p,node,{x:100,y:150,w:230,h:110},'#A98AF2',{style});
 assert.deepEqual(node,before);assert.equal(p.blueprint.glyphs[0].nodeId,node.id);assert.equal(p.blueprint.glyphs[0].glyph,'terminal');
 const result=await compilePresentation({contractId:'circuit-presentation-request.v1',deck:{title:'Typed glyph',slides:[{title:'Provider',commands}]}});
 assert.equal(result.slides[0].requests.filter(r=>r.createShape?.shapeType==='ELLIPSE').length,2);
});

test('provider connectors terminate at socket contacts and retain every declared edge',()=>{
 const model=buildBlueprint(normalizeSnapshot(rawFixture())),p=projectBlueprint(model,{altitude:'provider',scenarioId:'accept'}),layout=layoutBlueprint(p);
 assert.deepEqual(layout.routes.map(r=>[r.id,r.from,r.to]),p.edges.map(e=>[e.id,e.from,e.to]));
 for(const e of layout.routes){
  const from=p.nodes.find(n=>n.id===e.from),to=p.nodes.find(n=>n.id===e.to);
  assert.deepEqual(e.points[0],glyphAnchor(from,layout.positions[from.id],'right'));
  assert.deepEqual(e.points.at(-1),glyphAnchor(to,layout.positions[to.id],'left'));
  assert.equal(e.points.length,2,'Unobstructed aligned contacts must remain straight');
 }
});

test('rendering contract rejects invalid symbols, clipped frames, absent recipes and invalid contacts',()=>{
 for(const mutate of [s=>s.roles.port='absent',s=>s.glyphs.socket.label=[0.8,0.7,0.5,0.5],s=>s.glyphs.socket.anchors.left=[-0.1,0.5],s=>s.glyphs.device.primitives[0].type='untrusted',s=>s.glyphs.socket.primitives[1].box=[0,0,0,0],s=>s.event.fallback.glyph='absent',s=>s.event.operations['invoke-scenario'].label='',s=>delete s.event.platforms]){
  const style=structuredClone(COMPONENT_STYLE);mutate(style);assert.throws(()=>validateComponentStyle(style),{code:'CAPABILITY_GLYPH_STYLE_INVALID'});
 }
});
