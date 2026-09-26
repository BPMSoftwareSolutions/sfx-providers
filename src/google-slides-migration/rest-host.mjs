import fs from 'node:fs/promises';
import {PPTX_MIME,MAX_PPTX_BYTES} from './pptx.mjs';
import {GOOGLE_SLIDES_MIME} from './workflow.mjs';

// Optional standalone host. The application owns OAuth consent and refreshing;
// supply getAccessToken, or explicitly set SFX_GOOGLE_ACCESS_TOKEN for the CLI.
export function createDrive({getAccessToken=async()=>process.env.SFX_GOOGLE_ACCESS_TOKEN,fetchImpl=fetch}={}){
 const token=async()=>{const value=await getAccessToken();if(!value)throw new Error('SLIDES_AUTH_REQUIRED');return value;};
 const read=async url=>{const response=await fetchImpl(url,{headers:{Authorization:`Bearer ${await token()}`}});if(!response.ok)throw new Error(`SLIDES_GOOGLE_READ_${response.status}`);return response.json();};
 return {
  getMetadata:id=>read(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink,trashed`),
  getPresentation:id=>read(`https://slides.googleapis.com/v1/presentations/${encodeURIComponent(id)}`),
  async importPresentation({source_file,title,parent_folder_id,upload_mode}){
   if(upload_mode!=='native_google_slides')throw new Error('SLIDES_NATIVE_IMPORT_REQUIRED');
   if((await fs.stat(source_file)).size>MAX_PPTX_BYTES)throw new Error('SLIDES_SOURCE_OVERSIZED');
   const bytes=await fs.readFile(source_file),access=await token();
   const start=await fetchImpl('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id',{
    method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':PPTX_MIME,'X-Upload-Content-Length':String(bytes.length)},
    body:JSON.stringify({name:title,mimeType:GOOGLE_SLIDES_MIME,parents:[parent_folder_id]})
   });
   if(!start.ok)throw new Error(`SLIDES_GOOGLE_CREATE_${start.status}`);
   const session=start.headers.get('location'),url=new URL(session);
   if(url.protocol!=='https:'||url.hostname!=='www.googleapis.com'||!url.pathname.startsWith('/upload/drive/'))throw new Error('SLIDES_UPLOAD_SESSION_INVALID');
   const uploaded=await fetchImpl(session,{method:'PUT',headers:{Authorization:`Bearer ${access}`,'Content-Type':PPTX_MIME},body:bytes});
   if(!uploaded.ok)throw new Error(`SLIDES_GOOGLE_UPLOAD_${uploaded.status}`);
   return uploaded.json();
  }
 };
}
