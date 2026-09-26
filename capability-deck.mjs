#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { handle,inputShape } from './src/capability-presentation/provider.mjs';

export async function run(args=process.argv.slice(2)) {
  const options={};
  for(let i=0;i<args.length;i++){
    const arg=args[i];
    if(arg==='--help'){console.log('node capability-deck.mjs (--capability-id ID | --snapshot FILE) --output NEW_DIRECTORY [--view scenario|mechanic|provider|physical] [--context-altitude all|1..11] [--namespace-id ID] [--pptx]');return;}
    if(arg==='--pptx'){options.pptx=true;continue;}
    if(!['--capability-id','--namespace-id','--snapshot','--output','--view','--context-altitude','--narrator'].includes(arg)||!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Unknown or incomplete option: ${arg}`);
    if(arg in options)throw new Error('Repeated option: '+arg);options[arg]=args[++i];
  }
  if(!options['--output']||(!options['--capability-id']&&!options['--snapshot']))throw new Error('Provide --capability-id or --snapshot, and --output.');
  let readEstate,snapshot;
  if(options['--snapshot']){const stat=await fs.stat(options['--snapshot']);if(!stat.isFile()||stat.size>8*1024*1024)throw new Error('Snapshot must be a regular file of at most 8 MiB.');snapshot=JSON.parse(await fs.readFile(options['--snapshot'],'utf8'));readEstate=async()=>snapshot;}
  const input={contractId:inputShape.contractId,capabilityId:options['--capability-id']??snapshot.identity.capabilityId,view:options['--view']??'scenario',contextAltitude:options['--context-altitude']&&options['--context-altitude']!=='all'?Number(options['--context-altitude']):'all'};
  if(options['--namespace-id'])input.namespaceId=options['--namespace-id'];
  let narrator;
  if(options['--narrator']){narrator=(await import(pathToFileURL(path.resolve(options['--narrator'])).href)).narrate;if(typeof narrator!=='function')throw new Error('Narrator module must export a narrate function.');}
  const result=await handle(input,{readEstate,narrator});
  if(result.disposition!=='AUTHORED')throw new Error(result.findings.map(f=>f.code+': '+f.message).join('\n'));
  const output=path.resolve(options['--output']);await fs.mkdir(path.dirname(output),{recursive:true});await fs.mkdir(output);
  const write=(name,value)=>fs.writeFile(path.join(output,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  const c=result.candidate;
  await write('request.json',input);await write('snapshot.json',c.snapshot);await write('circuit-model.json',c.model);await write('storyboard.json',c.storyboard);
  await write('circuit-blueprint.json',c.storyboard.blueprint);
  await write('context-audit.json',{capabilityId:c.capabilityId,snapshotDigest:c.snapshot.snapshotDigest,altitudes:c.storyboard.contexts,checks:c.storyboard.checks,findings:c.model.findings});
  await write('receipt.json',{providerId:result.providerId,toolId:result.toolId,contentDigest:c.contentDigest,snapshotDigest:c.snapshot.snapshotDigest,view:c.view,contextAltitude:c.contextAltitude,coverage:c.coverage,inference:c.inference,volumes:c.volumes.map(v=>({volume:v.volume,firstSlide:v.firstSlide,lastSlide:v.lastSlide,contentDigest:v.presentation.contentDigest}))});
  for(const v of c.volumes){
    const dir=`volume-${String(v.volume).padStart(2,'0')}`;await fs.mkdir(path.join(output,dir));
    await write(dir+'/presentation.json',v.presentation);await write(dir+'/google-batch.json',{requests:v.presentation.requests});await write(dir+'/speaker-notes.json',v.presentation.slides.map(s=>({id:s.id,notes:s.notes})));
    for(const [i,slide]of v.presentation.slides.entries())await write(`${dir}/slide-${String(v.firstSlide+i).padStart(3,'0')}.svg`,slide.svg);
    if(options.pptx){const {exportPptx}=await import('./src/circuit-presentation/pptx.mjs');await exportPptx(v.presentation,path.join(output,dir,'presentation.pptx'));}
  }
  console.log(JSON.stringify({output,capabilityId:c.capabilityId,view:c.view,contextAltitude:c.contextAltitude,slides:c.storyboard.slides.length,volumes:c.volumes.length,contentDigest:c.contentDigest}));
  return result;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)run().catch(error=>{console.error(error.message);process.exitCode=1;});
