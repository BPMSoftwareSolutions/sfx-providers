import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {loadArtifactTool} from '../src/circuit-presentation/pptx.mjs';
import {compilePresentation} from '../src/circuit-presentation/compile.mjs';
import {objectsFromRequests} from '../src/circuit-presentation/render.mjs';

test('PPTX runtime can be configured once, with an explicit module override taking precedence',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'sfx-pptx-host-'));
 try{
  const configured=path.join(temp,'configured.mjs'),override=path.join(temp,'override.mjs'),configUrl=path.join(temp,'config.json');
  await fs.writeFile(configured,'export const identity="configured";');await fs.writeFile(override,'export const identity="override";');
  await fs.writeFile(configUrl,JSON.stringify({artifactModule:configured}));
  assert.equal((await loadArtifactTool({modulePath:'',configUrl})).identity,'configured');
  assert.equal((await loadArtifactTool({modulePath:override,configUrl})).identity,'override');
  await fs.writeFile(configUrl,JSON.stringify({artifactModule:'relative/module.mjs'}));
  await assert.rejects(loadArtifactTool({modulePath:'',configUrl}),/absolute local module/);
  await fs.writeFile(configUrl,'invalid JSON');
  await assert.rejects(loadArtifactTool({modulePath:'',configUrl}),SyntaxError);
 }finally{
  const resolved=await fs.realpath(temp);assert.equal(path.dirname(resolved),await fs.realpath(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('sfx-pptx-host-'));await fs.rm(resolved,{recursive:true,force:true});
 }
});

test('transport volumes retain the complete presentation page numbers in native objects and SVG',async()=>{
 const presentation=await compilePresentation({contractId:'circuit-presentation-request.v1',deck:{title:'Continuation',startSlideNumber:33,slides:[{title:'Evidence',commands:[]},{title:'Replay',commands:[]}]}});
 for(const [index,slide]of presentation.slides.entries()){
  const number=objectsFromRequests(slide.requests).find(o=>o.kind==='shape'&&o.elementProperties.transform.translateX===895&&o.elementProperties.transform.translateY===510);
  assert.equal(number.text,String(33+index));assert.ok(slide.svg.includes('>'+String(33+index)+'</tspan>'));
 }
});
