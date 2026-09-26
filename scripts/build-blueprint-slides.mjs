import fs from 'node:fs/promises';
import path from 'node:path';
import {validateSnapshot} from '../src/capability-presentation/snapshot.mjs';
import {buildCircuitModel} from '../src/capability-presentation/model.mjs';
import {buildStoryboard} from '../src/capability-presentation/storyboard.mjs';
import {compilePresentation} from '../src/circuit-presentation/compile.mjs';

// Assemble only the reusable blueprint sheets for insertion into an existing
// presentation. Pure local generation; the host performs any Google write.
const args=process.argv.slice(2),snapshots=[];let output;
for(let i=0;i<args.length;i+=2){if(args[i]==='--snapshot'&&args[i+1])snapshots.push(args[i+1]);else if(args[i]==='--output'&&args[i+1])output=args[i+1];else throw new Error('Use --snapshot FILE (repeatable) and --output NEW_DIRECTORY.');}
if(!output||!snapshots.length)throw new Error('Provide at least one --snapshot and --output.');
const slides=[],models=[];
for(const file of snapshots){const s=validateSnapshot(JSON.parse(await fs.readFile(file,'utf8'))),story=buildStoryboard(s,buildCircuitModel(s,'capability'),{contextAltitude:7});const selected=story.slides.filter(s=>s.blueprint),offset=slides.length,map=new Map(selected.map((p,i)=>[p.id,offset+i]));for(const p of selected)for(const c of p.commands)if(c.op==='t'&&typeof c.args[9]==='object'){const id=story.slides[c.args[9].slideIndex]?.id;if(!map.has(id))throw Error('Blueprint navigation target omitted');c.args[9]={slideIndex:map.get(id)};}slides.push(...selected);models.push(story.blueprint);}
const presentation=await compilePresentation({contractId:'circuit-presentation-request.v1',objectPrefix:'cap_blueprint_20260926',deck:{title:'Capability circuit blueprints',slides:slides.map(({title,subtitle,notes,commands})=>({title,subtitle,notes,commands}))}});
const root=path.resolve(output);await fs.mkdir(path.dirname(root),{recursive:true});await fs.mkdir(root);
await fs.writeFile(path.join(root,'presentation.json'),JSON.stringify(presentation));await fs.writeFile(path.join(root,'blueprints.json'),JSON.stringify(models,null,2));
for(const [i,s]of presentation.slides.entries())await fs.writeFile(path.join(root,`slide-${String(i+1).padStart(2,'0')}.svg`),s.svg);
console.log(JSON.stringify({output:root,slides:presentation.slides.length,capabilities:models.map(m=>({id:m.capabilityId,...m.coverage}))}));
