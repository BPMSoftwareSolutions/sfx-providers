import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {inspectPptx,MAX_PPTX_BYTES} from './pptx.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const json=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const write=async(file,value)=>{const temp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(value,null,2));await fs.rename(temp,file);};
export async function prepareJob({input,output,title,parentFolderId}){
  const source=path.resolve(input),directory=path.resolve(output);
  if((await fs.stat(source)).size>MAX_PPTX_BYTES)fail('SLIDES_SOURCE_OVERSIZED');
  const bytes=await fs.readFile(source),manifest=inspectPptx(bytes);
  const request={contractId:'google-slides-migration-request.v1',artifactId:'pptx-'+manifest.sha256.slice(0,24),sha256:manifest.sha256,title:title||path.basename(source,path.extname(source)),parentFolderId,idempotencyKey:randomUUID()};
  // Exclusive directory creation prevents overwriting a job or its receipt.
  await fs.mkdir(path.dirname(directory),{recursive:true});await fs.mkdir(directory);
  await fs.writeFile(path.join(directory,'source.pptx'),bytes,{flag:'wx'});
  await write(path.join(directory,'job.json'),{contractId:'google-slides-migration-job.v1',request,manifest});
  return {jobDirectory:directory,...await loadJob(directory)};
}
export async function loadJob(directory){
  const job=await json(path.join(directory,'job.json'));
  if(job.contractId!=='google-slides-migration-job.v1')fail('SLIDES_JOB_INVALID');
  const file=path.resolve(directory,'source.pptx');
  if((await fs.stat(file)).size>MAX_PPTX_BYTES)fail('SLIDES_SOURCE_OVERSIZED');
  const manifest=inspectPptx(await fs.readFile(file));
  if(manifest.sha256!==job.request.sha256)fail('SLIDES_SOURCE_MISMATCH');
  return {request:job.request,source:{...manifest,sourceFile:file}};
}
export function fileJournal(directory){
  const receipt=path.resolve(directory,'receipt.json'),lock=path.resolve(directory,'migration.lock');
  const assertToken=async token=>{if((await json(lock)).token!==token)fail('SLIDES_LOCK_MISMATCH');};
  const api={
    async acquire(){const token=randomUUID();try{await fs.writeFile(lock,JSON.stringify({token,createdAt:new Date().toISOString()}),{flag:'wx'});}catch(e){if(e.code==='EEXIST')fail('SLIDES_JOB_LOCKED');throw e;}return token;},
    async release(token){await assertToken(token);await fs.unlink(lock);},
    async read(){try{return await json(receipt);}catch(e){if(e.code==='ENOENT')return null;throw e;}},
    async persist(token,value){await assertToken(token);await write(receipt,{...value,updatedAt:new Date().toISOString()});},
    async withLock(key,fn){const token=await api.acquire();const prior=api.write;api.write=(_key,value)=>api.persist(token,value);try{return await fn();}finally{api.write=prior;await api.release(token);}},
    async write(){fail('SLIDES_LOCK_REQUIRED');}
  };return api;
}
