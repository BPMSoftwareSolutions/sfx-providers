import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {handle,verifyConversion,GOOGLE_SLIDES_MIME} from '../src/google-slides-migration/workflow.mjs';
import {inspectPptx} from '../src/google-slides-migration/pptx.mjs';
import {prepareJob,loadJob,fileJournal} from '../src/google-slides-migration/local.mjs';
import {createConnectorDrive} from '../src/google-slides-migration/codex-host.mjs';
import {createDrive} from '../src/google-slides-migration/rest-host.mjs';
import {createCircuitRequestHandler,HEALTH,MIGRATION_INVOKE} from '../src/circuit-presentation/http.mjs';
const folder='folder_123456789',fileId='presentation_123456789';
const request={contractId:'google-slides-migration-request.v1',artifactId:'approved-deck',sha256:'a'.repeat(64),title:'An engineering circuit',parentFolderId:folder,idempotencyKey:'import-job-123'};
const source={sourceFile:'C:/approved/source.pptx',sha256:request.sha256,slideCount:1,slides:[{text:['Circuit intent'],notes:['Speaker context'],links:['https://example.com/source']}]};
const shape=(text,link)=>({shape:{text:{textElements:[{textRun:{content:text,style:link?{link:{url:link}}:{}}}]}}});
const presentation={presentationId:fileId,slides:[{objectId:'slide1',pageElements:[shape('Circuit intent','https://example.com/source')],slideProperties:{notesPage:{pageElements:[shape('Speaker context')]}}}]};
const metadata={id:fileId,name:request.title,mimeType:GOOGLE_SLIDES_MIME,parents:[folder],webViewLink:`https://docs.google.com/presentation/d/${fileId}/edit`};
function host(overrides={}){
 let state=null,uploads=0;const phases=[];
 return {options:{resolveArtifact:async()=>structuredClone(source),journal:{withLock:async(_k,fn)=>fn(),read:async()=>structuredClone(state),write:async(_k,s)=>{state=structuredClone(s);phases.push(s.phase);}},drive:{getMetadata:async id=>id===folder?{id:folder,mimeType:'application/vnd.google-apps.folder'}:structuredClone(metadata),getPresentation:async()=>structuredClone(presentation),importPresentation:async args=>{uploads++;assert.equal(state.phase,'upload-started');assert.equal(args.upload_mode,'native_google_slides');return {id:fileId};},...overrides}},state:()=>state,uploads:()=>uploads,phases};
}
test('native import records intent before upload and replays without a duplicate',async()=>{
 const h=host();const a=await handle(request,h.options),b=await handle(request,h.options);
 assert.equal(a.disposition,'MIGRATED');assert.equal(b.fileId,a.fileId);assert.equal(h.uploads(),1);
 assert.deepEqual(h.phases,['upload-started','imported','verified','verified']);assert.equal(a.verification.visualReview,'not-performed');
});
test('uncertain create is durably held on retry',async()=>{
 let calls=0;const h=host({importPresentation:async()=>{calls++;throw new Error('connection lost after remote create');}});
 for(let i=0;i<3;i++){const r=await handle(request,h.options);assert.equal(r.disposition,'HELD');assert.equal(r.findings[0].code,'SLIDES_IMPORT_OUTCOME_UNKNOWN');}
 assert.equal(calls,1);assert.equal(h.state().phase,'outcome-unknown');
});
test('an uncertain create can be reconciled only against an observed matching native deck',async()=>{
 let calls=0;const h=host({importPresentation:async()=>{calls++;throw new Error('lost response');}});
 await handle(request,h.options);
 assert.equal((await handle(request,{...h.options,reconcileFileId:'another-file'})).findings[0].code,'SLIDES_RECONCILIATION_MISMATCH');
 assert.equal(h.state().phase,'outcome-unknown');
 const result=await handle(request,{...h.options,reconcileFileId:fileId});assert.equal(result.disposition,'MIGRATED');assert.equal(h.state().reconciled,true);assert.equal(calls,1);
});
test('failed readback resumes with known remote file, and changed requests cannot reuse the receipt',async()=>{
 let reads=0;const h=host({getPresentation:async()=>{if(!reads++)throw new Error('temporary outage');return presentation;}});
 assert.equal((await handle(request,h.options)).disposition,'HELD');assert.equal(h.state().phase,'imported');
 assert.equal((await handle(request,h.options)).disposition,'MIGRATED');assert.equal(h.uploads(),1);
 assert.equal((await handle({...request,title:'Different'},h.options)).findings[0].code,'SLIDES_IDEMPOTENCY_CONFLICT');
});
test('request paths, source changes and invalid folders are refused before creating anything',async()=>{
 const h=host();assert.equal((await handle({...request,sourceFile:'C:/arbitrary'},h.options)).findings[0].code,'SLIDES_REQUEST_INVALID');
 assert.equal((await handle({...request,sha256:'b'.repeat(64)},h.options)).findings[0].code,'SLIDES_SOURCE_MISMATCH');
 const bad=host({getMetadata:async()=>({id:folder,mimeType:GOOGLE_SLIDES_MIME})});assert.equal((await handle(request,bad.options)).findings[0].code,'SLIDES_FOLDER_INVALID');assert.equal(bad.uploads(),0);assert.equal(h.uploads(),0);
 assert.equal((await handle(request)).findings[0].code,'SLIDES_HOST_REQUIRED');
});
test('lost native content produces a review receipt without re-uploading',async()=>{
 const altered=structuredClone(presentation);altered.slides[0].pageElements=[{image:{}}];altered.slides[0].slideProperties.notesPage.pageElements=[];
 const h=host({getPresentation:async()=>altered});const r=await handle(request,h.options);
 assert.equal(r.disposition,'NEEDS_REVIEW');assert.deepEqual(r.verification.findings.map(f=>f.code),['SLIDE_TEXT_NOT_RETAINED','SPEAKER_NOTES_NOT_RETAINED','LINKS_NOT_RETAINED']);
 await handle(request,h.options);assert.equal(h.uploads(),1);
 const v=verifyConversion(source,{...metadata,mimeType:'application/octet-stream',parents:[]},{...presentation,slides:[]},request);
 assert.deepEqual(v.findings.map(f=>f.code),['NATIVE_MIME_MISMATCH','DESTINATION_FOLDER_MISMATCH','SLIDE_COUNT_MISMATCH']);
});
test('connector adapts normalized Drive metadata without inventing a URL',async()=>{
 const drive=createConnectorDrive({mcp__codex_apps__google_drive_get_file_metadata:async()=>({structuredContent:{id:fileId,title:request.title,mime_type:GOOGLE_SLIDES_MIME,parent_ids:[folder],url:metadata.webViewLink}}),mcp__codex_apps__google_drive_import_presentation:async()=>({structuredContent:{fileId,presentationId:fileId}})});
 assert.deepEqual(await drive.getMetadata(fileId),{...metadata,trashed:undefined});assert.deepEqual(await drive.importPresentation({}),{id:fileId});
 const h=host({getMetadata:async id=>id===folder?{id:folder,mimeType:'application/vnd.google-apps.folder'}:{...metadata,webViewLink:'https://docs.google.com/presentation/d/another/edit'}});
 assert.equal((await handle(request,h.options)).findings[0].code,'SLIDES_LINK_NOT_RETURNED');
});
test('readback detects lost pictures and reads linked editable table text',()=>{
 const table={table:{tableRows:[{tableCells:[{text:{textElements:[{textRun:{content:'Circuit intent',style:{link:{url:'https://example.com/source'}}}}]}}]}]}};
 const p=structuredClone(presentation);p.slides[0].pageElements=[{elementGroup:{children:[table]}}];
 const s=structuredClone(source);s.slides[0].imageCount=1;
 const v=verifyConversion(s,metadata,p,request);assert.deepEqual(v.findings.map(f=>f.code),['IMAGES_NOT_RETAINED']);assert.equal(v.slides[0].tables,1);
});
// Minimal ZIP package generated in memory: tests absolute OPC relationships,
// slide order, notes and hyperlinks without a proprietary runtime or fixture.
function zip(files){let offset=0;const chunks=[],central=[];for(const [name,text]of Object.entries(files)){const n=Buffer.from(name),data=Buffer.from(text),header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(n.length,26);chunks.push(header,n,data);const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50);cd.writeUInt32LE(data.length,20);cd.writeUInt32LE(data.length,24);cd.writeUInt16LE(n.length,28);cd.writeUInt32LE(offset,42);central.push(cd,n);offset+=header.length+n.length+data.length;}const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...chunks,directory,end]);}
const bytes=zip({'[Content_Types].xml':'<Types/>','ppt/presentation.xml':'<p:sldId r:id="r1"/>','ppt/_rels/presentation.xml.rels':'<Relationship Id="r1" Type="x/slide" Target="/ppt/slides/slide1.xml"/>','ppt/slides/slide1.xml':'<p:sp><a:t>Circuit &amp; intent</a:t></p:sp>','ppt/slides/_rels/slide1.xml.rels':'<Relationship Id="n1" Type="x/notesSlide" Target="../notesSlides/notesSlide1.xml"/><Relationship Id="h1" Type="x/hyperlink" Target="https://example.com/source" TargetMode="External"/>','ppt/notesSlides/notesSlide1.xml':'<a:t>Speaker context</a:t>'});
test('PPTX evidence follows package relationships and rejects corrupt archives',()=>{
 const s=inspectPptx(bytes);assert.equal(s.slideCount,1);assert.deepEqual(s.slides[0].text,['Circuit & intent']);assert.deepEqual(s.slides[0].notes,['Speaker context']);assert.deepEqual(s.slides[0].links,['https://example.com/source']);
 assert.throws(()=>inspectPptx(Buffer.from('not a pptx')));assert.throws(()=>inspectPptx(bytes.subarray(0,bytes.length-8)));
});
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'sfx-slides-test-'));
after(async()=>{const real=await fs.realpath(temp);assert.equal(path.dirname(real),await fs.realpath(os.tmpdir()));assert.ok(path.basename(real).startsWith('sfx-slides-test-'));await fs.rm(real,{recursive:true,force:true});});
test('job freezes input, refuses overwrites, detects tampering and journals under an exclusive lock',async()=>{
 const input=path.join(temp,'input.pptx'),output=path.join(temp,'job');await fs.writeFile(input,bytes);
 const args={input,output,title:request.title,parentFolderId:folder};await prepareJob(args);await assert.rejects(prepareJob(args),{code:'EEXIST'});
 await fs.writeFile(input,'changed');assert.equal((await loadJob(output)).source.slideCount,1);
 const journal=fileJournal(output),second=fileJournal(output);const token=await journal.acquire();await assert.rejects(second.acquire(),{code:'SLIDES_JOB_LOCKED'});await assert.rejects(journal.persist('wrong',{}),{code:'SLIDES_LOCK_MISMATCH'});
 await journal.persist(token,{phase:'imported',fileId});await journal.release(token);assert.equal((await journal.read()).fileId,fileId);
 await journal.withLock('unused',async()=>{await journal.write('unused',{phase:'verified'});});assert.equal((await second.read()).phase,'verified');
 await fs.writeFile(path.join(output,'source.pptx'),zip({'[Content_Types].xml':'x','ppt/presentation.xml':'<p:sldId r:id="r1"/>','ppt/_rels/presentation.xml.rels':'<Relationship Id="r1" Type="x/slide" Target="slides/s.xml"/>','ppt/slides/s.xml':'<a:t>Changed</a:t>'}));await assert.rejects(loadJob(output),{code:'SLIDES_SOURCE_MISMATCH'});
});
test('standalone host uploads native MIME and original PPTX bytes through a Google upload session',async()=>{
 const file=path.join(temp,'upload.pptx');await fs.writeFile(file,bytes);const calls=[];
 const drive=createDrive({getAccessToken:async()=>'test-token',fetchImpl:async(url,options)=>{calls.push({url,options});if(options.method==='POST')return {ok:true,headers:new Headers({location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=test-session'})};return {ok:true,json:async()=>({id:fileId})};}});
 assert.deepEqual(await drive.importPresentation({source_file:file,title:request.title,parent_folder_id:folder,upload_mode:'native_google_slides'}),{id:fileId});
 assert.equal(calls.length,2);assert.equal(JSON.parse(calls[0].options.body).mimeType,GOOGLE_SLIDES_MIME);assert.deepEqual(JSON.parse(calls[0].options.body).parents,[folder]);assert.deepEqual(calls[1].options.body,bytes);
 const refused=createDrive({getAccessToken:async()=>'test-token',fetchImpl:async()=>({ok:true,headers:new Headers({location:'https://untrusted.example/upload'})})});
 await assert.rejects(refused.importPresentation({source_file:file,upload_mode:'native_google_slides'}),/SLIDES_UPLOAD_SESSION_INVALID/);
});
test('HTTP advertises the migration operation and refuses an unbound upload host',async()=>{
 const handler=createCircuitRequestHandler();const server=http.createServer((req,res)=>handler(req,res,req.url));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const base=`http://127.0.0.1:${server.address().port}`;const health=await(await fetch(base+HEALTH)).json();assert.ok(health.tools.includes('presentation.to-google-slides'));const response=await fetch(base+MIGRATION_INVOKE,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)});assert.equal(response.status,422);assert.equal((await response.json()).findings[0].code,'SLIDES_HOST_REQUIRED');}finally{await new Promise(resolve=>server.close(resolve));}
});
