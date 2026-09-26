import { C } from '../circuit-presentation/design.mjs';
import { ALTITUDES, buildContexts, humanize, structuralChecks } from './model.mjs';
import {appendContextSlides} from './context-slides.mjs';

const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i*n,(i+1)*n));
const short = (value, max=65) => String(value ?? '').length > max ? String(value).slice(0,max-1)+'…' : String(value ?? '');
function wrap(value, width=25, lines=3) {
  const raw=String(value??'').includes('://')?String(value):humanize(value);
  const words=raw.split(' ').flatMap(w=>w.length>width?w.match(new RegExp(`.{1,${width}}`,'g')):[w]), out=[]; let line='';
  for(const word of words){ if((line+' '+word).trim().length>width&&line){out.push(line);line=word;}else line=(line+' '+word).trim(); }
  if(line)out.push(line);
  return out.length>lines ? [...out.slice(0,lines-1),short(out.slice(lines-1).join(' '),width)].join('\n') : out.join('\n');
}
const color = n => n.missing ? C.red : n.used===false?C.muted:({scenario:C.blue,operation:C.amber,transformation:C.violet,mechanic:C.violet,port:C.amber,provider:C.green,endpoint:C.green,physical:C.muted}[n.kind]??C.blue);
const colorEdge = e => e.classification==='failure'?C.red:e.classification==='success'?C.green:e.relation==='invocation' ? C.blue : e.relation==='order' ? C.amber : C.violet;

export function buildStoryboard(snapshot, model, { contextAltitude='all' } = {}) {
  const s=snapshot, slides=[], contexts=buildContexts(s), checks=structuralChecks(s);
  const identityRef='model:capability_version/'+s.identity.capabilityVersionPk;
  function page(title, subtitle, refs=[], detail='') {
    const p={id:'slide-'+(slides.length+1),title,subtitle,commands:[],evidenceRefs:[...new Set(refs.filter(Boolean))],detail,interpretation:'',coverage:{nodes:[],edges:[]}};
    p.add=(op,...args)=>p.commands.push({op,args});
    p.text=(text,x,y,w,h=40,size=16,paint=C.white,bold=false,align='left')=>p.add('t',text,x,y,w,h,size,paint,bold,align);
    p.chip=(x,y,w,h,text,paint=C.blue,size=16)=>p.add('chip',x,y,w,h,wrap(text,Math.floor((w-18)/(size*.61)),h<65?2:3),paint,{size,pins:1});
    p.wire=(points,paint=C.green,dash=false)=>p.add('route',points,paint,{arrow:true,dash,glow:true});
    slides.push(p);return p;
  }
  function fan(p, center, leaves, caption='declared relationship') {
    p.chip(68,245,220,85,center,C.blue,18);
    const take=leaves.slice(0,4), ys=take.map((_,i)=>150+i*78);
    for(const [i,l]of take.entries()){
      const paint=l.color??C.green;
      p.wire([[295,287],[370,287],[370,ys[i]+25],[558,ys[i]+25]],paint);
      p.add('junction',370,287,paint,4);
      p.chip(565,ys[i],300,53,l.label,paint,13);
    }
    if(!take.length){p.add('stop',490,287,C.red);p.wire([[295,287],[470,287]],C.red);p.text('No linked evidence returned',535,260,335,70,20,C.muted);}
    p.text(caption,332,118,540,27,12,C.muted);
    if(leaves.length>4)p.text(`+ ${leaves.length-4} additional entries retained in the snapshot and notes`,565,465,330,32,11,C.muted);
  }

  let p=page(short(humanize(s.identity.name),48),`${model.view.toUpperCase()} CIRCUIT  ·  CONTEXT ACROSS 11 AUTHORING ALTITUDES`,[identityRef],JSON.stringify(s.identity,null,2));
  p.chip(285,210,385,105,s.identity.capabilityId,C.blue,25);
  p.wire([[80,262],[275,262]],C.amber);p.add('terminal',62,262,'IN',C.amber,{r:24,size:12});
  p.wire([[677,262],[880,262]],C.green);p.add('terminal',903,262,'OUT',C.green,{r:24,size:12});
  p.text(`Estate ${s.identity.estateModelId}  /  version ${s.identity.capabilityVersionPk}`,280,349,425,32,17,C.muted,false,'center');
  p.text(s.features[0]?.sourceTitle?short('Feature: '+s.features[0].sourceTitle,130):s.identity.intent?short('Declared intent: '+s.identity.intent,130):'Declared structure, selected versions, and traceable context',150,406,665,50,18,C.white,false,'center');

  for(const group of chunks(contexts,6)){
    p=page('The capability’s authoring context',`ALTITUDES ${group[0].altitude}–${group.at(-1).altitude}  ·  EACH LAYER ANSWERS A DIFFERENT QUESTION`,group.flatMap(c=>[c.catalogRef,...c.evidenceRefs]),group.map(c=>`${c.altitude}. ${c.name}\n${c.question}\n${c.summary}`).join('\n\n'));
    for(const [i,c]of group.entries()){
      const y=137+i*53,paint=c.status==='not-read'?C.muted:C.amber;
      if(i)p.add('line',60,y-26,60,y+10,C.amber,2);
      p.add('gate',60,y+10,String(c.altitude),paint,17);
      p.text(c.name,100,y-7,355,28,17,C.white,true);
      p.text(short(c.summary,85),462,y-7,436,39,12,C.muted);
    }
    p.interpretation='The numbered rail organizes explanatory context. It is not an execution path or evidence that authoring stages were completed.';
  }

  const focus=contextAltitude==='all'?contexts:contexts.filter(c=>c.altitude===contextAltitude);
  for(const c of focus){
    p=page(`${String(c.altitude).padStart(2,'0')} · ${c.name}`,c.question,[c.catalogRef,...c.evidenceRefs],c.summary);
    switch(c.altitude){
      case 1:
        fan(p,s.identity.capabilityId,s.features.map(f=>({label:f.sourceTitle||f.title||f.name||f.id})), 'linked feature writeup; version selection retained in notes');
        if(s.features[0]?.description)p.text(short(s.features[0].description,170),68,357,425,91,16,C.white);
        p.detail+='\n'+JSON.stringify(s.features,null,2);break;
      case 2:
        fan(p,s.identity.capabilityId,[{label:s.identity.actor||'Actor prose not retained',color:s.identity.actor?C.amber:C.muted},{label:s.identity.intent||'Intent prose not retained',color:s.identity.intent?C.blue:C.muted},{label:s.identity.outcome||'Outcome prose not retained',color:s.identity.outcome?C.green:C.muted}], 'retained meaning fields');
        p.interpretation=`The identity “${humanize(s.identity.capabilityId)}” suggests the subject. This wording is an interpretation when intent prose is absent.`;break;
      case 3:{
        const root=s.scenarios.find(sc=>sc.id===s.identity.rootScenarioId);
        p.chip(70,230,235,90,root.inputId,C.amber,19);p.chip(370,230,225,90,root.eventId,C.blue,19);p.chip(665,230,225,90,root.outcomeId,C.green,19);
        p.wire([[312,275],[363,275]],C.amber);p.wire([[602,275],[658,275]],C.green);
        p.text('GIVEN / INPUT',70,183,230,25,13,C.amber);p.text('WHEN / EVENT',370,183,230,25,13,C.blue);p.text('THEN / OUTCOME',665,183,230,25,13,C.green);
        p.text(wrap(root.inputContractId,32,2),65,349,270,58,13,C.muted);p.text(wrap(root.outcomeContractId,32,2),652,349,260,58,13,C.muted);
        p.detail+='\n'+JSON.stringify(root,null,2);break;
      }
      case 4: fan(p,'Scenario contracts',s.contracts.map(v=>({label:v.id,color:C.violet})), 'schema identities; required fields and digests in notes');p.detail+='\n'+JSON.stringify(s.contracts,null,2);break;
      case 5:
        fan(p,`Estate ${s.identity.estateModelId}`, [{label:`Capability version ${s.identity.capabilityVersionPk}`,color:C.amber},{label:`Definition ${s.identity.definitionPk}`,color:C.violet},{label:`Graph ${s.provenance.graphDigest.slice(0,16)}`,color:C.green}], 'selection and evidence lineage');
        p.detail+='\n'+JSON.stringify(s.provenance,null,2);break;
      case 6: {
        const usedPorts=new Set(s.authorities.flatMap(a=>a.operations.map(o=>o.portId).filter(Boolean)));
        const usedTransforms=new Set(s.bindings.filter(b=>usedPorts.has(b.portId)).map(b=>b.transformationId));
        // Authoring context retains declared expressions even when the selected
        // execution has no port binding that references them.
        const t=[...s.transformations].sort((a,b)=>Number(usedTransforms.has(b.id))-Number(usedTransforms.has(a.id))||b.branchCount-a.branchCount||(a.id<b.id?-1:a.id>b.id?1:0))[0];
        if(!t){fan(p,'Transformation expressions',[]);break;}
        const referenced=usedTransforms.has(t.id);
        const root=t.preview[0];
        const children=t.preview.filter(n=>n.parent===root?.path);
        const caption=referenced?'expression containment; referenced by an invoked port binding':'retained expression; no binding from invoked ports';
        if(children.length)fan(p,root?.op??'Expression',children.map(n=>({label:`${n.op}\n${n.path.split('/').at(-1)}`,color:['if','switch','case'].includes(n.op)?C.amber:C.violet})),caption);
        else {p.chip(68,245,220,85,root?.op??'Expression',C.violet,18);p.text(caption,332,118,540,27,12,C.muted);p.text(root?'No child operators in this preview':'Operator preview unavailable',380,258,470,70,20,C.muted);}
        p.text(short(t.id,95),50,438,850,27,13,C.white);
        if(t.inputPaths?.length)p.text('Input paths:\n'+short([...new Set(t.inputPaths.map(v=>v.inputPath))].join(', '),62),68,359,285,59,13,C.muted);
        p.detail+='\nExpression preview: '+JSON.stringify(t,null,2);
        p.interpretation=`This expression contains ${t.nodeCount} mechanic nodes and ${t.branchCount} conditional operator nodes. ${referenced?'An invoked port binding references this expression.':'The snapshot retains this expression, but no invoked port binding references it.'} This is declaration evidence, not an observed execution trace. Larger subexpressions are collapsed; operator counts and the digest remain in the snapshot.`;break;
      }
      case 7: {
        const a=s.authorities.find(a=>a.scenarioId===s.identity.rootScenarioId)??s.authorities[0];
        fan(p,a?.id??'Execution authority',a?.operations.map(o=>({label:`${o.ordinal}. ${o.portId||o.scenarioId||o.kind}`,color:o.kind==='invoke-scenario'?C.blue:C.amber}))??[], 'authority membership; declared ordinal retained');
        if(a?.operations.length===1)p.text('Operation: '+a.operations[0].kind,68,360,500,35,17,C.white);
        p.detail+='\n'+JSON.stringify(a,null,2);break;
      }
      case 8: {
        const b=s.bindings.find(b=>b.providerIds.length||b.endpoints.length)??s.bindings[0];
        if(!b){fan(p,'Provider binding',[]);break;}
        p.chip(62,239,265,90,b.portId,C.amber,18);p.add('socket',449,284,{color:C.violet,height:72});
        p.wire([[334,284],[432,284]],C.amber);p.wire([[466,284],[590,284]],C.green);p.chip(598,239,305,90,b.platformCapabilityId,C.green,18);
        p.text('DECLARED PORT',66,190,270,30,13,C.amber);p.text('BINDING',399,345,125,27,13,C.violet,false,'center');p.text('PLATFORM / PROVIDER',600,190,295,30,13,C.green);
        p.detail+='\n'+JSON.stringify(s.bindings,null,2);break;
      }
      case 9: fan(p,'Caller interface',s.interfaces.map(i=>({label:i.id||i.profile,color:C.blue})), 'declared interface configuration, identified by digest');p.detail+='\n'+JSON.stringify(s.interfaces,null,2);break;
      case 10: fan(p,'Declared expectations',[...s.fixtures.map(f=>({label:f.caseId||f.id,color:C.violet})),...s.obligations.map(o=>({label:o.statement||o.id,color:C.amber}))], 'fixture and proof declarations; execution results are not queried');p.detail+='\n'+JSON.stringify({fixtures:s.fixtures,obligations:s.obligations},null,2);break;
      case 11: {
        const orderedChecks=[...checks.filter(c=>c.status==='gap'),...checks.filter(c=>c.status==='resolved'),...checks.filter(c=>c.status==='not-read')];
        for(const [i,group]of chunks(orderedChecks,4).entries()){
          if(i)p=page('11 · Alignment evaluation',`REFERENCE CHECKS / ${i+1}`,group.map(c=>c.sourceRef),JSON.stringify(group,null,2));
          fan(p,'Cross-layer consistency',group.map(c=>({label:`${c.label}\n${c.status}`,color:c.status==='resolved'?C.green:c.status==='gap'?C.red:C.muted})), 'computed reference checks; not an estate admission decision');
          p.detail+='\n'+JSON.stringify(group,null,2);
        }break;
      }
    }
    appendContextSlides({snapshot:s,altitude:c.altitude,page});
  }

  // Deterministic breadth-first page order. No topology is synthesized by layout.
  const ordered=[],seen=new Set(),queue=[model.nodes.find(n=>n.id==='scenario:'+s.identity.rootScenarioId)?.id??model.nodes[0]?.id];
  const byId=new Map(model.nodes.map(n=>[n.id,n]));
  while(ordered.length<model.nodes.length){
    if(!queue.length)queue.push(model.nodes.find(n=>!seen.has(n.id)).id);
    const id=queue.shift();if(!byId.has(id)||seen.has(id))continue;seen.add(id);ordered.push(byId.get(id));
    for(const e of model.edges)if(e.from===id&&!seen.has(e.to))queue.push(e.to);
  }
  const batches=chunks(ordered,6),index=new Map(ordered.map((n,i)=>[n.id,{number:i+1,page:Math.floor(i/6)+1}]));
  for(const [batchIndex,batch]of batches.entries()){
    const ids=new Set(batch.map(n=>n.id)), edges=model.edges.filter(e=>ids.has(e.from)||ids.has(e.to));
    p=page(`${model.view[0].toUpperCase()+model.view.slice(1)} circuit · ${batchIndex+1}/${batches.length}`,
      'SOLID: DECLARED RELATIONSHIP  ·  DASHED: CALL / ORDER / PAGE CONTINUATION', [...batch.map(n=>n.ref),...edges.map(e=>e.ref)],JSON.stringify({nodes:batch,edges},null,2));
    const pos=new Map(batch.map((n,i)=>[n.id,{x:90+(i%3)*290,y:175+Math.floor(i/3)*164,w:205,h:72}]));
    const internal=edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
    for(const [i,e]of internal.entries()){
      const a=pos.get(e.from),b=pos.get(e.to),paint=colorEdge(e);
      const ax=a.x+a.w+7,ay=a.y+a.h/2,bx=b.x-7,by=b.y+b.h/2;
      const sx=ax+12+(i%3)*4,tx=bx-12-(i%3)*4;
      const lane=(a.y===b.y?a.y-36:292)+(i%3)*9;
      p.wire([[ax,ay],[sx,ay],[sx,lane],[tx,lane],[tx,by],[bx,by]],paint,['order','invocation'].includes(e.relation));
      // Compact edge IDs prevent adjacent wire labels from merging; the exact
      // relationship is retained in the notes and the following relation sheet.
      const outgoingIndex=internal.filter(w=>w.from===e.from).indexOf(e);
      p.text(`E${model.edges.indexOf(e)+1}`,ax+13,ay-19-outgoingIndex*17,37,19,9,paint);
    }
    for(const n of batch){
      const b=pos.get(n.id),paint=color(n),related=edges.filter(e=>e.from===n.id),fanout=related.length>1;
      p.chip(b.x,b.y,b.w,b.h,n.label,paint,14);
      p.text(`N${String(index.get(n.id).number).padStart(2,'0')} · ${n.kind}${n.missing?' · unresolved':n.used===false?' · retained':''}`,b.x,b.y-27,b.w+20,24,11,paint);
      if(fanout)p.add('junction',b.x+b.w+7,b.y+b.h/2,paint,4);
      const outside=edges.filter(e=>(e.from===n.id&&!ids.has(e.to))||(e.to===n.id&&!ids.has(e.from)));
      if(outside.length){
        if(outside.some(e=>e.from===n.id))p.wire([[b.x+b.w+7,b.y+36],[b.x+b.w+27,b.y+36]],C.muted,true);
        if(outside.some(e=>e.to===n.id))p.wire([[b.x-27,b.y+36],[b.x-7,b.y+36]],C.muted,true);
        const refs=[...new Set(outside.map(e=>{const r=index.get(e.from===n.id?e.to:e.from);return r?`${e.to===n.id?'in':'out'}: N${String(r.number).padStart(2,'0')} / circuit ${r.page}`:'';}))];
        p.text(short(refs.join('; '),66),b.x-4,b.y+b.h+11,b.w+20,43,10,C.muted);
      }
      if(n.reachable===false)p.text('No declared path from root',b.x,b.y+b.h+49,b.w+20,23,10,C.red);
    }
    p.coverage={nodes:batch.map(n=>n.id),edges:edges.map(e=>e.id)};
    p.interpretation=model.view==='mechanic'?'Operation-order wires show the retained authority sequence; they do not assert unconditional execution. Transformation subcircuits are collapsed and identified by digest.'
      :model.view==='physical'?'Destinations and host fields describe declarations. Actual processes, devices, network calls and timings require separate execution testimony.'
      :'Page continuations retain their exact peer and relation in the notes and circuit-model.json.';
  }

  for(const group of chunks(model.edges,7)){
    p=page('Circuit relationship register',`${model.view.toUpperCase()} VIEW  ·  EDGE IDS MATCH THE CIRCUIT DIAGRAMS`,group.map(e=>e.ref),JSON.stringify(group,null,2));
    for(const [i,e]of group.entries()){
      const y=137+i*44,paint=colorEdge(e),a=index.get(e.from),b=index.get(e.to);
      p.text(`E${model.edges.indexOf(e)+1}`,42,y,45,26,13,paint,true);
      p.text(`N${String(a.number).padStart(2,'0')}`,102,y,70,26,13,C.white,true);
      p.wire([[173,y+12],[232,y+12]],paint,['order','invocation'].includes(e.relation));
      p.text(`N${String(b.number).padStart(2,'0')}`,249,y,70,26,13,C.white,true);
      p.text(short(e.label||e.relation,52),346,y,400,27,14,paint);
      p.text(e.relation,765,y,150,27,11,C.muted);
    }
  }

  // Outcome branches are drawn only for declared variants, without guessing a
  // route from a name such as "success" or converting an unused outcome to STOP.
  for(const sc of s.scenarios.filter(sc=>sc.variants.length))for(const group of chunks(sc.variants,4)){
    p=page('Declared outcome branches',short(sc.id,105),[sc.sourceRef],JSON.stringify({scenarioId:sc.id,variants:group},null,2));
    fan(p,sc.outcomeId,group.map(v=>({label:v.id,color:v.classification==='failure'?C.red:v.classification==='success'?C.green:C.violet})), 'variant membership; routing requires a declared transition');
  }
  if(model.findings.length){
    for(const group of chunks(model.findings,4)){
      p=page('Evidence gaps and circuit boundaries','DECLARED STRUCTURE AND OBSERVED EXECUTION ARE DIFFERENT EVIDENCE',[],JSON.stringify(group,null,2));
      for(const [i,f]of group.entries()){p.add('stop',67,160+i*70,C.red);p.text(wrap(f.label||f.code,32,2),93,136+i*70,320,55,15,C.white,true);p.text(short(f.message,105),525,139+i*70,378,52,13,C.muted);}
    }
  }
  p=page('Evidence and replay','ONE SELECTED SNAPSHOT  ·  IDENTITIES AND DIGESTS RETAINED',[identityRef],JSON.stringify({identity:s.identity,provenance:s.provenance,snapshotDigest:s.snapshotDigest,checks},null,2));
  fan(p,'Selected estate snapshot',[{label:`Snapshot ${s.snapshotDigest.slice(0,16)}`,color:C.amber},{label:`Graph ${s.provenance.graphDigest.slice(0,16)}`,color:C.blue},{label:`Circuit ${model.digest.slice(0,16)}`,color:C.green}], 'snapshot → semantic projection → editable presentation');
  p.interpretation='Hashes identify retained evidence; they do not certify the capability’s behavior or the truth of an inferred explanation.';

  // Details live in the machine-readable sidecars; bounded notes keep the deck
  // usable even when bindings or transformation declarations are very large.
  return { contexts,checks,slides:slides.map(p=>{
    const notes=[p.detail, p.interpretation?'Interpretation / scope: '+p.interpretation:'', 'Evidence references:\n'+p.evidenceRefs.join('\n'),
      'Snapshot: '+s.snapshotDigest,'Full identities, relationships, and detail: snapshot.json, circuit-model.json, storyboard.json.'].filter(Boolean).join('\n\n');
    p.commands.push({op:'foot',args:[`Estate ${s.identity.estateModelId} · ${model.view} view · snapshot ${s.snapshotDigest.slice(0,12)}`]});
    return {id:p.id,title:p.title,subtitle:p.subtitle,commands:p.commands,notes:notes.length>19000?notes.slice(0,18500)+'\n\nNotes abbreviated. Full detail is retained in storyboard.json.':notes,
      evidenceRefs:p.evidenceRefs,detail:p.detail,interpretation:p.interpretation,coverage:p.coverage};
  }) };
}
