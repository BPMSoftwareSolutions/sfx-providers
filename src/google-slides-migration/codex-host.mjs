// Runtime-neutral adapter for Codex functions.exec. No credential or token access.
// tools is the current authenticated tool collection, never request-supplied.
function unwrap(result){if(result.isError)throw new Error('SLIDES_CONNECTOR_FAILED');if(!result.structuredContent)throw new Error('SLIDES_CONNECTOR_RESPONSE_INVALID');return result.structuredContent;}
export function createConnectorDrive(tools){
 return {
  async getMetadata(id){const m=unwrap(await tools.mcp__codex_apps__google_drive_get_file_metadata({fileId:id,fields:'id,name,mimeType,parents,webViewLink,trashed'}));return {id:m.id,name:m.name??m.title,mimeType:m.mimeType??m.mime_type,parents:m.parents??m.parent_ids,webViewLink:m.webViewLink??m.url,trashed:m.trashed};},
  async getPresentation(id){return unwrap(await tools.mcp__codex_apps__google_drive_get_presentation({presentation_id:id}));},
  async importPresentation(args){const result=unwrap(await tools.mcp__codex_apps__google_drive_import_presentation(args));return {id:result.id??result.fileId??result.presentationId??result.presentation_id??result.file_id};}
 };
}
export async function createCodexHost(tools,{jobDirectory,cliPath,nodeExecutable='node'}){
 // Single-quoted PowerShell arguments protect apostrophes, $, backticks and spaces.
 const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
 const local=async(command,extra=[])=>{const result=await tools.exec_command({cmd:'& '+[nodeExecutable,cliPath,command,'--job',jobDirectory,...extra].map(quote).join(' '),max_output_tokens:60000});if(result.exit_code!==0)throw new Error('SLIDES_LOCAL_HOST_FAILED: '+result.output.slice(0,500));return JSON.parse(result.output);};
 const job=await local('read-job',['--metadata-only','true']);let token,sequence=0;
 const readSource=async()=>{
   const header=await local('read-job',['--metadata-only','true']);let text='';
   if(header.request.sha256!==job.request.sha256||!Number.isSafeInteger(header.sourceJsonLength)||header.sourceJsonLength<1||header.sourceJsonLength>64*1024*1024)throw new Error('SLIDES_SOURCE_MISMATCH');
   while(text.length<header.sourceJsonLength){const chunk=await local('read-source-chunk',['--offset',String(text.length),'--length','24000']);if(chunk.offset!==text.length||chunk.totalLength!==header.sourceJsonLength||!chunk.text)throw new Error('SLIDES_SOURCE_CHUNK_INVALID');text+=chunk.text;}
   if(text.length!==header.sourceJsonLength)throw new Error('SLIDES_SOURCE_CHUNK_INVALID');return JSON.parse(text);
 };
 const journal={
   async withLock(key,fn){token=(await local('journal-lock')).token;try{return await fn();}finally{await local('journal-release',['--token',token]);token=undefined;}},
   async read(){return local('journal-read');},
   async write(key,state){if(!token)throw new Error('SLIDES_LOCK_REQUIRED');const file=jobDirectory.replaceAll('\\','/')+`/state-${token}-${++sequence}.json`;const content=JSON.stringify(state,null,2).split('\n').map(line=>'+'+line).join('\n');const result=await tools.apply_patch(`*** Begin Patch\n*** Add File: ${file}\n${content}\n*** End Patch`);if(result?.isError)throw new Error('SLIDES_JOURNAL_WRITE_FAILED');await local('journal-write',['--token',token,'--from',file]);}
 };
 return {request:job.request,options:{journal,drive:createConnectorDrive(tools),resolveArtifact:async id=>{if(id!==job.request.artifactId)throw new Error('SLIDES_ARTIFACT_UNKNOWN');return readSource();}}};
}
