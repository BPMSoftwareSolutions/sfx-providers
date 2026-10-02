#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { handle, inputShape, MAX_REQUEST_BYTES } from './providers/circuit-presentation/circuit-presentation.mjs';
export async function run(args=process.argv.slice(2)){
  const options={};
  for(let i=0;i<args.length;i++){
    if(args[i]==='--pptx'){options.pptx=true;continue;}
    if(args[i]==='--help'){console.log('node circuit-deck.mjs (--preset sidefx-announcement | --input request.json) --output NEW_DIRECTORY [--pptx]');return;}
    if(!['--preset','--input','--output'].includes(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Unknown or incomplete option: ${args[i]}`);
    const key=args[i].slice(2);if(key in options)throw new Error(`Repeated option: ${key}`);options[key]=args[++i];
  }
  if(!options.output||Boolean(options.preset)===Boolean(options.input))throw new Error('Provide --output and exactly one of --preset or --input. Use --help.');
  let input;
  if(options.input){const info=await fs.stat(options.input);if(!info.isFile()||info.size>MAX_REQUEST_BYTES)throw new Error('Request file exceeds the provider limit or is not a regular file.');input=JSON.parse(await fs.readFile(options.input,'utf8'));}
  else input={contractId:inputShape.contractId,preset:options.preset};
  const result=await handle(input);
  if(result.disposition!=='AUTHORED')throw new Error(result.findings.map(f=>`${f.code}: ${f.message}`).join('\n'));
  const output=path.resolve(options.output);
  await fs.mkdir(path.dirname(output),{recursive:true});
  await fs.mkdir(output); // Exclusive creation: never overwrite a prior deck.
  const write=(name,value)=>fs.writeFile(path.join(output,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  const c=result.candidate;
  await write('request.json',input);
  await write('presentation.json',c);
  await write('google-batch.json',{requests:c.requests});
  await write('speaker-notes.json',c.slides.map(s=>({slideId:s.id,notes:s.notes})));
  await write('receipt.json',{providerId:result.providerId,toolId:result.toolId,disposition:result.disposition,contractId:c.contractId,inputDigest:c.inputDigest,contentDigest:c.contentDigest,slideCount:c.slides.length,pageSize:c.pageSize});
  for(const [i,slide]of c.slides.entries())await write(`slide-${String(i+1).padStart(2,'0')}.svg`,slide.svg);
  if(options.pptx){const {exportPptx}=await import('./src/circuit-presentation/pptx.mjs');await exportPptx(c,path.join(output,'presentation.pptx'));}
  console.log(JSON.stringify({output,slideCount:c.slides.length,contentDigest:c.contentDigest,pptx:Boolean(options.pptx)}));
  return result;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)run().catch(error=>{console.error(error.message);process.exitCode=1;});

