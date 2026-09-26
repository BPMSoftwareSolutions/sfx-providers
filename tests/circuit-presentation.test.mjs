import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import * as provider from '../providers/circuit-presentation.mjs';
import { createCircuitRequestHandler,INVOKE,HEALTH } from '../src/circuit-presentation/http.mjs';
import { objectsFromRequests } from '../src/circuit-presentation/render.mjs';
const example=JSON.parse(await fs.readFile(new URL('../examples/circuit-presentation/branching-provider.request.json',import.meta.url),'utf8'));
const preset={contractId:provider.inputShape.contractId,preset:'sidefx-announcement'};
const exec=promisify(execFile);
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'sfx-circuit-test-'));
after(async()=>{const target=await fs.realpath(temp);assert.equal(path.dirname(target),await fs.realpath(os.tmpdir()));assert.ok(path.basename(target).startsWith('sfx-circuit-test-'));await fs.rm(target,{recursive:true,force:true});});

test('custom input compiles native branching diagrams, source links and notes deterministically',async()=>{
 const a=await provider.handle(example),b=await provider.handle(example);
 assert.equal(a.disposition,'AUTHORED',JSON.stringify(a.findings));assert.deepEqual(a.candidate,b.candidate);
 const c=a.candidate;assert.equal(c.slides.length,1);assert.equal(c.pageSize.width,960);
 const objects=objectsFromRequests(c.slides[0].requests);
 assert.ok(objects.some(o=>o.shapeType==='DIAMOND'));
 assert.ok(objects.filter(o=>o.kind==='line').length>15);
 assert.ok(objects.some(o=>o.text==='Provider binding'));
 assert.ok(objects.some(o=>o.textStyle?.link?.url==='https://csrc.nist.gov/glossary/term/reference_monitor'));
 assert.match(c.slides[0].notes,/Illustrative mechanism/);assert.match(c.slides[0].svg,/<svg/);
 assert.equal(c.requests.filter(r=>r.createSlide).length,1);assert.ok(!c.requests.some(r=>r.deleteObject));
});

test('retained preset includes every slide, both repair passes and fifteen live source URLs',async()=>{
 const r=await provider.handle(preset);assert.equal(r.disposition,'AUTHORED',JSON.stringify(r.findings));
 assert.equal(r.candidate.slides.length,29);
 const objects=r.candidate.slides.flatMap(s=>objectsFromRequests(s.requests));
 assert.equal(new Set(objects.map(o=>o.objectId)).size,objects.length);
 const urls=new Set(objects.flatMap(o=>o.textStyle?.link?[o.textStyle.link.url]:[]));assert.equal(urls.size,15);
 assert.ok(objects.some(o=>o.text==='CAPABILITY_\nNOT_FOUND'));
 const cover=objectsFromRequests(r.candidate.slides[0].requests);
 assert.ok(cover.some(o=>o.shapeType==='DIAMOND'&&o.elementProperties.transform.translateX===292));
 const resolve=objectsFromRequests(r.candidate.slides[4].requests).find(o=>o.text==='Resolve');
 assert.equal(resolve.elementProperties.transform.translateX,536);assert.equal(resolve.elementProperties.size.width.magnitude,92);
 assert.ok(r.candidate.slides.every(s=>s.notes.length>100));
 assert.ok(!r.candidate.requests.some(r=>r.deleteObject||r.createImage));
});

test('another object namespace remaps every native target without changing narrative text',async()=>{
 const {candidate}=await provider.handle({...preset,objectPrefix:'another_deck'});
 for(const r of candidate.requests){const v=Object.values(r)[0];if(v.objectId)assert.ok(v.objectId.startsWith('another_deck_'));if(v.elementProperties)assert.ok(v.elementProperties.pageObjectId.startsWith('another_deck_'));}
 assert.match(candidate.slides[0].svg,/SideFX/);
});

test('invalid envelopes, script-like operations and unsafe URLs are refused',async()=>{
 const bad=[null,{},[],{...preset,deck:example.deck},{...preset,preset:'unknown'},{...preset,objectPrefix:'p1;delete'},{...preset,outputPath:'C:/anything'},
  {...example,deck:{...example.deck,slides:[{title:'Bad',commands:[{op:'constructor',args:[]}]}]}},
  {...example,deck:{...example.deck,sources:[{id:'x',title:'x',url:'javascript:alert(1)'}]}},
  {...example,deck:{...example.deck,sources:[{id:'x',title:'x',url:'https://secret:password@example.com'}]}}];
 for(const input of bad){const r=await provider.handle(input);assert.equal(r.disposition,'HELD');assert.equal(r.candidate,null);assert.equal(r.findings[0].code,'CIRCUIT_REQUEST_INVALID');}
});

test('invalid geometry, unresolved sources and parameter types are refused',async()=>{
 for(const command of [{op:'chip',args:[900,200,100,60,'Outside']},{op:'source',args:[['absent']]},{op:'route',args:[[[1,2],[3,'bad']]]},{op:'chip',args:[50,50,100,60,'Invalid','#4DE0B0',{pins:500}]},{op:'line',args:[10,10,50,50,'none']}]){
  const r=await provider.handle({contractId:preset.contractId,deck:{title:'Test',slides:[{title:'Test',commands:[command]}]}});assert.equal(r.disposition,'HELD',JSON.stringify(command));
 }
});

test('SVG treats text as data and preserves multiline labels',async()=>{
 const input=structuredClone(example);input.deck.slides[0].title='<script>& "quoted"';
 const r=await provider.handle(input);assert.equal(r.disposition,'AUTHORED');assert.ok(!r.candidate.slides[0].svg.includes('<script>'));assert.match(r.candidate.slides[0].svg,/&lt;script&gt;&amp;/);
});

test('request byte limits apply to direct and transport-provided sizes',async()=>{
 for(const [input,options]of [[{...preset,padding:'x'.repeat(provider.MAX_REQUEST_BYTES)},{}],[preset,{requestBytes:provider.MAX_REQUEST_BYTES+1}]]){
  const r=await provider.handle(input,options);assert.equal(r.findings[0].code,'CIRCUIT_REQUEST_OVERSIZED');assert.equal(r.candidate,null);
 }
});

test('HTTPS adapter contract: health, compilation, bad JSON, wrong content type and size cap',async()=>{
 const handle=createCircuitRequestHandler();
 const server=http.createServer(async(req,res)=>{if(!await handle(req,res,new URL(req.url,'http://localhost').pathname)){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`;
 try{
  const health=await(await fetch(url+HEALTH)).json();assert.equal(health.estateStatus,'not-declared');
  const response=await fetch(url+INVOKE,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(example)});assert.equal(response.status,200);assert.equal((await response.json()).candidate.slides.length,1);
  assert.equal((await fetch(url+INVOKE,{method:'POST',headers:{'content-type':'application/json'},body:'{'})).status,400);
  assert.equal((await fetch(url+INVOKE,{method:'POST',body:'{}'})).status,415);
  assert.equal((await fetch(url+INVOKE)).status,405);
  assert.equal((await fetch(url+INVOKE,{method:'POST',headers:{'content-type':'application/json'},body:' '.repeat(provider.MAX_REQUEST_BYTES+1)})).status,413);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('CLI works outside the repository and refuses to overwrite an existing output',async()=>{
 const cli=fileURLToPath(new URL('../circuit-deck.mjs',import.meta.url)),out=path.join(temp,'cli');
 const {stdout}=await exec(process.execPath,[cli,'--preset','sidefx-announcement','--output',out],{cwd:temp});
 assert.equal(JSON.parse(stdout).slideCount,29);
 const saved=JSON.parse(await fs.readFile(path.join(out,'presentation.json'),'utf8'));assert.equal(saved.slides.length,29);
 assert.equal((await fs.readdir(out)).filter(n=>n.endsWith('.svg')).length,29);
 await assert.rejects(exec(process.execPath,[cli,'--preset','sidefx-announcement','--output',out],{cwd:temp}));
 assert.equal(JSON.parse(await fs.readFile(path.join(out,'presentation.json'),'utf8')).contentDigest,saved.contentDigest);
});
