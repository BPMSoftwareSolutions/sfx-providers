// Runtime-neutral orchestration. A host supplies approved artifact resolution,
// authenticated Drive operations and an exclusive, durable receipt journal.
export const providerId='sfx-circuit-presentation';
export const toolId='presentation.to-google-slides';
export const GOOGLE_SLIDES_MIME='application/vnd.google-apps.presentation';
export const MAX_REQUEST_BYTES=16384;
export const inputShape={contractId:'google-slides-migration-request.v1',status:'PROPOSED',schema:{type:'object',additionalProperties:false,required:['contractId','artifactId','sha256','title','parentFolderId','idempotencyKey'],properties:{
 contractId:{const:'google-slides-migration-request.v1'},artifactId:{type:'string',pattern:'^[A-Za-z0-9._-]{1,128}$'},sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},title:{type:'string',minLength:1,maxLength:200},parentFolderId:{type:'string',pattern:'^[A-Za-z0-9_-]{10,200}$'},idempotencyKey:{type:'string',pattern:'^[A-Za-z0-9_-]{8,128}$'}
}}};
export const outputShape={
 contractId:'google-slides-migration-output.v1',status:'PROPOSED',
 schema:{
  type:'object',additionalProperties:false,required:['contractId','providerId','toolId','disposition'],
  properties:{
   contractId:{const:'google-slides-migration-output.v1'},providerId:{const:providerId},toolId:{const:toolId},
   disposition:{enum:['MIGRATED','NEEDS_REVIEW','HELD']},fileId:{type:'string'},url:{type:'string'},
   sourceSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},verification:{type:'object'},findings:{type:'array',items:{type:'object'}}
  }
 }
};
function requireValue(ok,code){if(!ok)throw Object.assign(new Error(code),{code});}
function validateInput(v){
 const schema=inputShape.schema;requireValue(v&&typeof v==='object'&&!Array.isArray(v),'SLIDES_REQUEST_INVALID');
 requireValue(schema.required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>Object.hasOwn(schema.properties,k)),'SLIDES_REQUEST_INVALID');
 for(const [k,s]of Object.entries(schema.properties)){const value=v[k];requireValue(typeof value==='string'&&value.length>0&&!/[\x00-\x1f]/.test(value),'SLIDES_REQUEST_INVALID');if(s.const)requireValue(value===s.const,'SLIDES_REQUEST_INVALID');if(s.maxLength)requireValue(value.length<=s.maxLength,'SLIDES_REQUEST_INVALID');if(s.pattern)requireValue(new RegExp(s.pattern).test(value),'SLIDES_REQUEST_INVALID');}
}
const normal=v=>String(v??'').replace(/\s+/g,' ').trim();
function pageEvidence(page){
 const texts=[],links=[],counts={shapes:0,images:0,lines:0,tables:0};
 const walk=elements=>{for(const e of elements??[]){
   if(e.shape){counts.shapes++;for(const t of e.shape.text?.textElements??[]){if(t.textRun?.content)texts.push(t.textRun.content);if(t.textRun?.style?.link?.url)links.push(t.textRun.style.link.url);}}
   if(e.image){counts.images++;if(e.image.imageProperties?.link?.url)links.push(e.image.imageProperties.link.url);}
   if(e.line)counts.lines++;
   if(e.table){counts.tables++;for(const row of e.table.tableRows??[])for(const cell of row.tableCells??[])for(const t of cell.text?.textElements??[]){if(t.textRun?.content)texts.push(t.textRun.content);if(t.textRun?.style?.link?.url)links.push(t.textRun.style.link.url);}}
   if(e.elementGroup)walk(e.elementGroup.children);
 }};walk(page.pageElements);return {text:normal(texts.join(' ')),links,counts};
}
export function verifyConversion(source,metadata,presentation,request){
 const findings=[];const check=(ok,code,detail)=>{if(!ok)findings.push({code,detail});};
 check(metadata.mimeType===GOOGLE_SLIDES_MIME,'NATIVE_MIME_MISMATCH',metadata.mimeType);
 check(metadata.id===presentation.presentationId,'PRESENTATION_ID_MISMATCH','Readback identifies a different file.');
 check(metadata.parents?.includes(request.parentFolderId),'DESTINATION_FOLDER_MISMATCH','The converted deck is not in the requested folder.');
 check(presentation.slides?.length===source.slideCount,'SLIDE_COUNT_MISMATCH',`Expected ${source.slideCount}; read ${presentation.slides?.length??0}.`);
 const slides=(presentation.slides??[]).map((s,i)=>{
   const expected=source.slides[i],actual=pageEvidence(s),notes=pageEvidence(s.slideProperties?.notesPage??{});
   if(expected){
     const missingText=expected.text.filter(t=>normal(t)&&!actual.text.includes(normal(t)));
     const missingNotes=expected.notes.filter(t=>normal(t)&&!/^\d+$/.test(normal(t))&&!notes.text.includes(normal(t)));
     const missingLinks=expected.links.filter(url=>!actual.links.includes(url));
     check(!missingText.length,'SLIDE_TEXT_NOT_RETAINED',`Slide ${i+1}: ${missingText.length} source text runs missing from editable text.`);
     check(!missingNotes.length,'SPEAKER_NOTES_NOT_RETAINED',`Slide ${i+1}: ${missingNotes.length} source note runs missing.`);
     check(!missingLinks.length,'LINKS_NOT_RETAINED',`Slide ${i+1}: ${missingLinks.length} source links missing.`);
     check(actual.counts.images>=(expected.imageCount??0),'IMAGES_NOT_RETAINED',`Slide ${i+1}: expected at least ${expected.imageCount} pictures; read ${actual.counts.images}.`);
   }
   return {number:i+1,objectId:s.objectId,...actual.counts};
 });
 return {passed:findings.length===0,sourceSlideCount:source.slideCount,slideCount:slides.length,slides,findings,visualReview:'not-performed',scope:'Native MIME, destination, slide count, editable text, speaker notes, hyperlinks and minimum picture counts. Visual fidelity and all object behaviors require visual review.'};
}
export async function migratePresentation(input,{resolveArtifact,drive,journal,reconcileFileId}={}){
 validateInput(input);requireValue(resolveArtifact&&drive&&journal,'SLIDES_HOST_REQUIRED');
 return journal.withLock(input.idempotencyKey,async()=>{
   let state=await journal.read(input.idempotencyKey);
   const identity=JSON.stringify(Object.fromEntries(Object.keys(input).sort().map(k=>[k,input[k]])));
   requireValue(!state||state.requestIdentity===identity,'SLIDES_IDEMPOTENCY_CONFLICT');
   const uncertain=state&&['upload-started','outcome-unknown'].includes(state.phase);
   requireValue(!uncertain||reconcileFileId,'SLIDES_IMPORT_OUTCOME_UNKNOWN');
   const source=await resolveArtifact(input.artifactId);
   requireValue(source?.sha256===input.sha256&&source.slideCount>=1&&source.slideCount<=256&&source.sourceFile,'SLIDES_SOURCE_MISMATCH');
   if(uncertain){
     // An operator supplies an observed remote ID after checking the create
     // response or Drive. Never guess an ID or automatically select by title.
     requireValue(typeof reconcileFileId==='string'&&/^[A-Za-z0-9_-]+$/.test(reconcileFileId),'SLIDES_RECONCILIATION_INVALID');
     const m=await drive.getMetadata(reconcileFileId),p=await drive.getPresentation(reconcileFileId);
     requireValue(m.id===reconcileFileId&&p.presentationId===reconcileFileId&&m.mimeType===GOOGLE_SLIDES_MIME&&!m.trashed&&m.name===input.title&&m.parents?.includes(input.parentFolderId)&&p.slides?.length===source.slideCount,'SLIDES_RECONCILIATION_MISMATCH');
     state={...state,phase:'imported',fileId:reconcileFileId,reconciled:true};await journal.write(input.idempotencyKey,state);
   }
   if(!state?.fileId){
     const folder=await drive.getMetadata(input.parentFolderId);
     requireValue(folder.id===input.parentFolderId&&folder.mimeType==='application/vnd.google-apps.folder'&&!folder.trashed,'SLIDES_FOLDER_INVALID');
     state={requestIdentity:identity,phase:'upload-started',sourceSha256:source.sha256,sourceSlideCount:source.slideCount};
     await journal.write(input.idempotencyKey,state);
     try{
       const created=await drive.importPresentation({source_file:source.sourceFile,title:input.title,parent_folder_id:input.parentFolderId,upload_mode:'native_google_slides'});
       requireValue(typeof created.id==='string'&&/^[A-Za-z0-9_-]+$/.test(created.id),'SLIDES_IMPORT_ID_NOT_RETURNED');
       state={...state,phase:'imported',fileId:created.id};await journal.write(input.idempotencyKey,state);
     }catch{
       // The remote create may have succeeded. A repeated call must not upload
       // again until its outcome is reconciled with an observed Drive file ID.
       await journal.write(input.idempotencyKey,{...state,phase:'outcome-unknown'});
       throw Object.assign(new Error('SLIDES_IMPORT_OUTCOME_UNKNOWN'),{code:'SLIDES_IMPORT_OUTCOME_UNKNOWN'});
     }
   }
   const metadata=await drive.getMetadata(state.fileId),presentation=await drive.getPresentation(state.fileId);
   requireValue(metadata.id===state.fileId,'SLIDES_READBACK_ID_MISMATCH');
   requireValue(typeof metadata.webViewLink==='string'&&metadata.webViewLink.startsWith(`https://docs.google.com/presentation/d/${state.fileId}/`),'SLIDES_LINK_NOT_RETURNED');
   const verification=verifyConversion(source,metadata,presentation,input);
   state={...state,phase:verification.passed?'verified':'needs-review',url:metadata.webViewLink,mimeType:metadata.mimeType,verification};
   await journal.write(input.idempotencyKey,state);
   return {contractId:outputShape.contractId,providerId,toolId,disposition:verification.passed?'MIGRATED':'NEEDS_REVIEW',fileId:state.fileId,url:state.url,sourceSha256:source.sha256,verification};
 });
}
export async function handle(input,options={}){
 try{return await migratePresentation(input,options);}catch(error){return {contractId:outputShape.contractId,providerId,toolId,disposition:'HELD',findings:[{code:error.code?.startsWith('SLIDES_')?error.code:'SLIDES_MIGRATION_FAILED',message:'Migration did not complete. Retained journal state controls safe recovery.'}]};}
}
