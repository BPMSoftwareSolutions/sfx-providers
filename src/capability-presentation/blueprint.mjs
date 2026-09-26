import {C} from '../circuit-presentation/design.mjs';
import {digest,fail} from './snapshot.mjs';
import {humanize} from './model.mjs';

// A separate projection from the selected semantic view: every declared
// scenario and operation participates, even when the requested view is provider.
// Binding and return wires have their own types; neither invents a transition.
export function buildBlueprint(s){
 const nodes=[],edges=[],scenarios=[],byId=new Map(),bindings=new Map(s.bindings.map(b=>[b.portId,b]));
 const add=(id,kind,label,ref,extra={})=>{if(!byId.has(id)){const n={id,kind,label,ref,...extra};byId.set(id,n);nodes.push(n);}return id;};
 const wire=(from,to,kind,ref,label='',extra={})=>edges.push({id:`B${edges.length+1}`,from,to,kind,ref,label,...extra});
 const entry=id=>'input:'+id,outcome=id=>'outcome:'+id;
 for(const sc of s.scenarios){
  const a=s.authorities.find(a=>a.id===sc.authorityId),operations=a?.operations??[];
  scenarios.push({id:sc.id,name:sc.name,authorityId:sc.authorityId,ref:sc.sourceRef,root:sc.id===s.identity.rootScenarioId,operationIds:operations.map(op=>`operation:${a.id}:${op.ordinal}`)});
  add(entry(sc.id),'input',sc.inputContractId||sc.inputId||sc.id,sc.sourceRef,{scenarioId:sc.id,eventId:sc.eventId});
  add(outcome(sc.id),sc.terminal?'terminal':'outcome',sc.outcomeContractId||sc.outcomeId||sc.id,sc.sourceRef,{scenarioId:sc.id,terminal:sc.terminal});
  let prior=entry(sc.id);
  for(const op of operations){
   const id=add(`operation:${a.id}:${op.ordinal}`,'operation',op.portId||op.scenarioId||op.kind,op.sourceRef,{scenarioId:sc.id,operationKind:op.kind,ordinal:op.ordinal,variants:op.variants??[]});
   wire(prior,id,prior===entry(sc.id)?'entry':'sequence',op.sourceRef,prior===entry(sc.id)?'input':'next declared operation');prior=id;
   if(op.kind==='invoke-port'){
    const b=bindings.get(op.portId),binding=add('binding:'+op.portId,'binding',b?.platformCapabilityId||'Unresolved binding',b?.sourceRef||op.sourceRef,{portId:op.portId,missing:!b,scenarioId:sc.id,used:true,providerIds:b?.providerIds??[],transformationId:b?.transformationId||'',selectors:b?.selectors??{}});
    wire(id,binding,'binding',b?.sourceRef||op.sourceRef,op.portId);
    if(b?.selectors?.capabilityIdPath){
     const target=add('dynamic:'+op.portId,'dynamic','Runtime capability',b.sourceRef,{selector:b.selectors.capabilityIdPath,requestPath:b.selectors.requestPath||'',resultPath:b.selectors.resultPath||'',scenarioId:sc.id});
     wire(binding,target,'dynamic-call',b.sourceRef,b.selectors.capabilityIdPath);
     wire(target,binding,'return',b.sourceRef,b.selectors.resultPath||'nested result');
    }
   }
  }
  wire(prior,outcome(sc.id),'completion',a?.sourceRef||sc.sourceRef,operations.length?'scenario result':'no declared operations');
  for(const variant of sc.variants){
   const id=add(`variant:${sc.id}:${variant.id}`,'variant',variant.id,sc.sourceRef,{scenarioId:sc.id,classification:variant.classification});
   wire(outcome(sc.id),id,'variant',sc.sourceRef,variant.id,{classification:variant.classification});
  }
 }
 // Preserve unattached authority operations and their actual bindings/calls,
 // without manufacturing an entry edge from the capability's selected root.
 for(const a of s.authorities){let prior;for(const op of a.operations){
  const id=`operation:${a.id}:${op.ordinal}`;if(byId.has(id))continue;
  add(id,'unresolved',op.portId||op.scenarioId||op.kind,op.sourceRef,{ordinal:op.ordinal,missing:true,unattachedAuthority:a.id});
  if(prior)wire(prior,id,'sequence',op.sourceRef,'unattached authority order');prior=id;
  if(op.kind==='invoke-port'){const b=bindings.get(op.portId),binding=add('binding:'+op.portId,'binding',b?.platformCapabilityId||'Unresolved binding',b?.sourceRef||op.sourceRef,{portId:op.portId,used:true,missing:!b,providerIds:b?.providerIds??[],transformationId:b?.transformationId||'',selectors:b?.selectors??{}});wire(id,binding,'binding',b?.sourceRef||op.sourceRef,op.portId);}
 }}
 function target(id){if(!byId.has(entry(id)))add(entry(id),'unresolved',id,'',{scenarioId:id,missing:true});return entry(id);}
 for(const a of s.authorities)for(const op of a.operations)if(op.kind==='invoke-scenario'){
  const id=`operation:${a.id}:${op.ordinal}`;if(!byId.has(id))continue;
  wire(id,target(op.scenarioId),'call',op.sourceRef,op.scenarioId);
  if(byId.has(outcome(op.scenarioId)))wire(outcome(op.scenarioId),id,'return',op.sourceRef,'return to caller');
 }
 for(const t of s.transitions){
  const from=t.variant&&byId.has(`variant:${t.from}:${t.variant}`)?`variant:${t.from}:${t.variant}`:outcome(t.from);
  if(!byId.has(from))add(from,'unresolved',t.from,t.sourceRef,{missing:true,scenarioId:t.from});
  wire(from,target(t.to),'transition',t.sourceRef,t.variant||t.topologyKind,{transitionId:t.id,topologyKind:t.topologyKind,classification:byId.get(from).classification});
 }
 for(const b of s.bindings)if(!byId.has('binding:'+b.portId))add('binding:'+b.portId,'binding',b.platformCapabilityId,b.sourceRef,{portId:b.portId,used:false,providerIds:b.providerIds,transformationId:b.transformationId,selectors:b.selectors??{}});
 const coverage={scenarios:s.scenarios.length,operations:s.authorities.reduce((n,a)=>n+a.operations.length,0),transitions:s.transitions.length,bindings:s.bindings.length,nodes:nodes.length,edges:edges.length};
 const body={contractId:'capability-circuit-blueprint.v1',capabilityId:s.identity.capabilityId,snapshotDigest:s.snapshotDigest,rootScenarioId:s.identity.rootScenarioId,scenarios,nodes,edges,coverage,
  scope:'Complete declared scenario/operation circuit, calls, returns, outcome variants and port bindings. Transformation implementations are named subcircuits. Runtime-selected targets are explicit boundaries.',
  policies:s.graphFeatures??{}};
 return {...body,digest:digest(body)};
}

const clip=(s,n)=>String(s??'').length>n?String(s).slice(0,n-1)+'…':String(s??'');
function wrap(s,n=23,rows=3){const words=humanize(s).split(' ').flatMap(w=>w.length>n?w.match(new RegExp(`.{1,${n}}`,'g')):[w]),out=[];let line='';for(const word of words){if((line+' '+word).trim().length>n&&line){out.push(line);line=word;}else line=(line+' '+word).trim();}if(line)out.push(line);return out.length>rows?[...out.slice(0,rows-1),clip(out.slice(rows-1).join(' '),n)].join('\n'):out.join('\n');}
const paint=n=>n.missing?C.red:n.used===false?C.muted:n.kind==='input'?C.amber:n.kind==='terminal'?C.green:n.kind==='variant'?(n.classification==='failure'?C.red:n.classification==='success'?C.green:C.violet):n.kind==='binding'?C.violet:n.kind==='dynamic'?C.green:C.blue;
const wirePaint=e=>e.classification==='failure'?C.red:e.classification==='success'?C.green:['completion','return'].includes(e.kind)?C.green:e.kind==='binding'?C.violet:['call','dynamic-call'].includes(e.kind)?C.blue:e.kind==='variant'?C.muted:C.amber;

// A circuit sheet uses rows of operation sockets inside scenario regions. Rows
// wrap with explicit continuation wires; all topology stays on the same sheet.
// Large sheets use stable component IDs, plus a complete readable register.
export function layoutBlueprint(model){
 const positions=new Map(),regions=[],nodeById=new Map(model.nodes.map(n=>[n.id,n]));
 const scenarioOrder=[],seen=new Set(),queue=[model.rootScenarioId];
 while(scenarioOrder.length<model.scenarios.length){if(!queue.length)queue.push(model.scenarios.find(s=>!seen.has(s.id)).id);const id=queue.shift();if(seen.has(id))continue;seen.add(id);const sc=model.scenarios.find(s=>s.id===id);if(!sc)continue;scenarioOrder.push(sc);for(const e of model.edges.filter(e=>['transition','call'].includes(e.kind))){if(nodeById.get(e.from)?.scenarioId===id){const target=nodeById.get(e.to)?.scenarioId;if(target&&!seen.has(target))queue.push(target);}}}
 const maxOps=Math.max(1,...model.scenarios.map(s=>s.operationIds.length)),cols=Math.min(18,Math.max(3,Math.ceil(Math.sqrt(maxOps*4)))),cellW=180;
 const width=cols*cellW+260;let top=0;
 for(const sc of scenarioOrder){
  const rows=Math.max(1,Math.ceil(sc.operationIds.length/cols)),variants=model.nodes.filter(n=>n.kind==='variant'&&n.scenarioId===sc.id),hasDynamic=model.nodes.some(n=>n.kind==='dynamic'&&n.scenarioId===sc.id);
  const height=100+rows*175+(hasDynamic&&sc.operationIds.length>1?110:0)+(variants.length?70:0);
  regions.push({id:sc.id,label:sc.name,authorityId:sc.authorityId,root:sc.root,x:0,y:top,w:width,h:height});
  positions.set('input:'+sc.id,{x:18,y:top+60,w:106,h:72});
  const outputY=top+60+(rows-1)*175;
  positions.set('outcome:'+sc.id,{x:width-112,y:outputY,w:98,h:72});
  for(const [i,id] of sc.operationIds.entries()){
   const col=i%cols,row=Math.floor(i/cols),x=145+col*cellW,y=top+62+row*175;
   positions.set(id,{x,y,w:142,h:65});
   for(const e of model.edges.filter(e=>e.from===id&&e.kind==='binding'))if(!positions.has(e.to))positions.set(e.to,{x,y:y+99,w:142,h:56});
  }
  let dyn=0;
  for(const n of model.nodes.filter(n=>n.kind==='dynamic'&&n.scenarioId===sc.id))positions.set(n.id,{x:sc.operationIds.length===1?360:145+dyn++*cellW,y:sc.operationIds.length===1?top+161:top+rows*175+85,w:175,h:68});
  for(const [i,n]of variants.entries())positions.set(n.id,{x:35+i*(width-70)/Math.max(1,variants.length),y:top+height-64,w:Math.min(245,(width-85)/Math.max(1,variants.length)-10),h:46});
  top+=height+55;
 }
 const remaining=model.nodes.filter(n=>!positions.has(n.id));
 if(remaining.length){const y=top;for(const [i,n]of remaining.entries())positions.set(n.id,{x:22+(i%cols)*cellW,y:y+45+Math.floor(i/cols)*90,w:142,h:65});const h=70+Math.ceil(remaining.length/cols)*90;regions.push({id:'unattached',label:'Retained declarations outside the selected paths',x:0,y,w:width,h});top+=h;}
 const height=Math.max(1,top- (remaining.length?0:55)),routes=[];
 for(const [i,e]of model.edges.entries()){
  const a=positions.get(e.from),b=positions.get(e.to);if(!a||!b)fail('Blueprint has an unplaced endpoint.','CAPABILITY_BLUEPRINT_INCOMPLETE');
  let points;
  if(e.kind==='binding')points=[[a.x+a.w/2,a.y+a.h],[a.x+a.w/2,b.y-10],[b.x+b.w/2,b.y-10],[b.x+b.w/2,b.y]];
  else if(e.kind==='dynamic-call')points=Math.abs(a.y-b.y)<20?[[a.x+a.w,a.y+20],[b.x,a.y+20]]:[[a.x+a.w/2,a.y+a.h],[a.x+a.w/2,b.y-12],[b.x+b.w/2,b.y-12],[b.x+b.w/2,b.y]];
  else if(e.kind==='return'&&nodeById.get(e.from).kind==='dynamic'){const y=Math.max(a.y+a.h,b.y+b.h)+13;points=[[a.x+a.w/2,a.y+a.h],[a.x+a.w/2,y],[b.x+b.w/2,y],[b.x+b.w/2,b.y+b.h]];}
  else if(['entry','sequence','completion'].includes(e.kind)&&Math.abs(a.y-b.y)<30)points=[[a.x+a.w,a.y+a.h/2],[b.x-10,a.y+a.h/2],[b.x-10,b.y+b.h/2],[b.x,b.y+b.h/2]];
  else if(e.kind==='sequence'){const lane=a.y+a.h+92;points=[[a.x+a.w,a.y+a.h/2],[a.x+a.w+12,a.y+a.h/2],[a.x+a.w+12,lane],[b.x-14,lane],[b.x-14,b.y+b.h/2],[b.x,b.y+b.h/2]];}
  else if(e.kind==='variant'){const y=b.y-9;points=[[a.x+a.w/2,a.y+a.h],[a.x+a.w/2,y],[b.x+b.w/2,y],[b.x+b.w/2,b.y]];}
  else {const rail=width+18+(i%12)*9;points=[[a.x+a.w,a.y+a.h/2],[rail,a.y+a.h/2],[rail,b.y+b.h/2],[b.x+b.w,b.y+b.h/2]];}
  routes.push({...e,points:points.filter((p,j,arr)=>!j||p[0]!==arr[j-1][0]||p[1]!==arr[j-1][1])});
 }
 const maxX=Math.max(width,...routes.flatMap(e=>e.points.map(p=>p[0])));
 return {width:maxX+10,height,positions:Object.fromEntries(positions),regions,routes};
}

export function appendBlueprintSlides({snapshot,model,page}){
 const layout=layoutBlueprint(model),scale=Math.min(868/layout.width,315/layout.height,1.9),origin={x:(960-layout.width*scale)/2,y:131};
 const ids=new Map(model.nodes.map((n,i)=>[n.id,'C'+String(i+1).padStart(2,'0')]));
 const compact=scale<.55;
 const p=page('Complete capability circuit',`${model.capabilityId} / ${model.coverage.operations} operation${model.coverage.operations===1?'':'s'} / ${model.coverage.transitions} scenario transitions`,model.nodes.map(n=>n.ref),JSON.stringify(model,null,2));
 p.blueprint={role:'overview',digest:model.digest,nodes:model.nodes.map(n=>n.id),edges:model.edges.map(e=>e.id),compactLabels:compact};
 const pt=(x,y)=>[origin.x+x*scale,origin.y+y*scale];
 const text=(value,x,y,w,h,size,color=C.white,bold=false,align='left')=>p.text(value,...pt(x,y),w*scale,h*scale,Math.max(6,size*scale),color,bold,align);
 for(const r of layout.regions){p.add('shape','RECTANGLE',...pt(r.x,r.y),r.w*scale,r.h*scale,{fill:C.panel,alpha:.22,stroke:r.root?C.blue:C.grid,sw:.6});text(clip((r.root?'ROOT  ':'')+r.label,100),r.x+12,r.y+5,r.w-24,27,16,C.muted,true);}
 for(const e of layout.routes){const color=wirePaint(e);p.add('route',e.points.map(([x,y])=>pt(x,y)),color,{width:Math.max(.65,1.6*scale),arrow:true,dash:['binding','call','dynamic-call','return','variant'].includes(e.kind),glow:false});}
 for(const n of model.nodes){
  const b=layout.positions[n.id],color=paint(n),font=n.kind==='binding'?13:14,label=compact?ids.get(n.id):wrap(n.kind==='operation'?`${n.ordinal}. ${n.label}`:n.kind==='dynamic'?`Target: ${n.selector}`:n.kind==='binding'&&n.transformationId?n.transformationId:n.label,Math.floor((b.w-(n.kind==='dynamic'?38:14))/(font*.61)),3);
  const selection=n.kind==='outcome'&&model.edges.some(e=>e.from===n.id&&e.kind==='variant');
  p.add('shape',selection?'DIAMOND':n.kind==='input'||n.kind==='terminal'?'ROUND_RECTANGLE':n.kind==='dynamic'?'HEXAGON':n.kind==='variant'?'ROUND_RECTANGLE':'RECTANGLE',...pt(b.x,b.y),b.w*scale,b.h*scale,{fill:C.bg,stroke:color,sw:Math.max(.8,1.4*scale)});
  text(label,b.x+3,b.y+(selection?Math.max(2,(b.h-font*1.08*label.split('\n').length)/2-3):compact?2:7),b.w-6,b.h-7,compact?12:font,color,true,'center');
  if(n.kind==='operation')p.add('port',...pt(b.x,b.y+b.h/2),C.amber,Math.max(1.8,3*scale));
  if(n.kind==='binding'&&n.used!==false){const x=b.x+b.w/2,y=b.y-16;p.add('shape','RECTANGLE',...pt(x-6,y-9),12*scale,18*scale,{fill:C.panel,stroke:C.violet,sw:.7});if(!compact)for(const d of [-5,5])p.add('line',...pt(x-12,y+d),...pt(x+12,y+d),C.violet,1);}
  if(model.edges.filter(e=>e.from===n.id&&['transition','call','variant'].includes(e.kind)).length>1)p.add('junction',...pt(n.kind==='outcome'||n.kind==='terminal'?b.x+b.w/2:b.x+b.w,n.kind==='outcome'||n.kind==='terminal'?b.y+b.h:b.y+b.h/2),color,Math.max(1.8,3*scale));
  if(model.edges.filter(e=>e.to===n.id&&['transition','call'].includes(e.kind)).length>1)p.add('junction',...pt(b.x+b.w,b.y+b.h/2),C.green,Math.max(1.8,3*scale));
 }
 const terminals=model.nodes.filter(n=>n.kind==='terminal').length;
 p.text(`${model.coverage.scenarios} scenario${model.coverage.scenarios===1?'':'s'}   ${model.coverage.bindings} binding${model.coverage.bindings===1?'':'s'}   ${terminals} terminal outcome${terminals===1?'':'s'}`,38,448,862,21,11,C.muted);
 p.interpretation='Solid amber: declared entry and operation sequence. Green: result/return or successful variant. Red: failed variant. Dashed violet: provider binding. Blue dashed: nested invocation. Dashed variant membership does not invent a route. Transition wires preserve declared selection and topology. Transformation names denote subcircuits, not claims that their internal predicates were expanded. Dynamic targets require a separately selected capability snapshot.';
 // This footer is visible, so the overview cannot silently pose as a runtime trace.
 p.text('AMBER sequence   VIOLET binding   BLUE call   GREEN result/success   RED failure',38,485,860,20,10,C.muted);
 if(compact){
  for(let start=0;start<model.nodes.length;start+=12){const batch=model.nodes.slice(start,start+12),detail=page('Circuit component register',`${model.capabilityId} / component IDs on the complete blueprint`,batch.map(n=>n.ref),JSON.stringify(batch,null,2));detail.blueprint={role:'register',digest:model.digest};for(const [i,n]of batch.entries()){const y=132+i*26;detail.text(ids.get(n.id),38,y,50,23,12,paint(n),true);detail.text(clip(n.kind==='binding'?`${n.portId} : ${n.transformationId||n.label}`:n.label,94),104,y,794,24,12,C.white);}}
 }
 return model;
}
