import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareJob,loadJob,fileJournal} from './src/google-slides-migration/local.mjs';
import {handle} from './src/google-slides-migration/workflow.mjs';

const [command,...args]=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!args[i]?.startsWith('--')||!args[i+1])throw new Error('Expected --name value pairs.');options[args[i].slice(2)]=args[i+1];}
const required=name=>{if(!options[name])throw new Error(`Missing --${name}`);return options[name];};
try{
 let result;
 if(command==='prepare'){const job=await prepareJob({input:required('input'),output:required('output'),title:options.title,parentFolderId:required('folder-id')});result={jobDirectory:job.jobDirectory,request:job.request,slideCount:job.source.slideCount,byteCount:job.source.byteCount};}
 else if(command==='read-job')result=await loadJob(required('job'));
 else if(command==='run'){
   const directory=required('job'),job=await loadJob(directory),host=await import(pathToFileURL(path.resolve(required('host'))));
   const drive=await host.createDrive();
   result=await handle(job.request,{resolveArtifact:async id=>{if(id!==job.request.artifactId)throw new Error('Unknown artifact');return (await loadJob(directory)).source;},drive,journal:fileJournal(directory),reconcileFileId:options['reconcile-file-id']});
 }else if(command?.startsWith('journal-')){
   const directory=required('job'),journal=fileJournal(directory);
   if(command==='journal-lock')result={token:await journal.acquire()};
   else if(command==='journal-read')result=await journal.read();
   else if(command==='journal-release'){await journal.release(required('token'));result={released:true};}
   else if(command==='journal-write'){
     const file=path.resolve(required('from')),root=await fs.realpath(directory),real=await fs.realpath(file);
     if(path.dirname(real)!==root||!/^state-[a-zA-Z0-9_-]+\.json$/.test(path.basename(real)))throw new Error('State input must be a task-local state-*.json file.');
     await journal.persist(required('token'),JSON.parse(await fs.readFile(real,'utf8')));await fs.unlink(real);result={written:true};
   }else throw new Error('Unknown journal operation.');
 }else throw new Error('Use prepare --input deck.pptx --output job-directory --folder-id ID [--title TITLE], then run --job job-directory --host authenticated-host.mjs.');
 console.log(JSON.stringify(result));if(result?.disposition==='HELD')process.exitCode=1;
}catch(error){console.error(JSON.stringify({error:error.code??'SLIDES_CLI_FAILED',message:error.message}));process.exitCode=1;}
