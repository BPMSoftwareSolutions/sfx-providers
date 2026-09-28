import {C,Slide} from '../circuit-presentation/design.mjs';
import {validateConnectorRoute} from '../circuit-presentation/contracts.mjs';
import {fitBlueprintText} from '../circuit-presentation/text-fit.mjs';
import {humanize} from './model.mjs';
import {identifierCaption} from './caption.mjs';
import {drawEventSheet} from './event-sheet.mjs';
import {componentGlyph,drawComponentGlyph,glyphFrame,glyphAnchor} from './component-glyphs.mjs';
import {projectBlueprint,projectionOverlays,reachableScenarios,declarationInventory} from './projection.mjs';
import {drawCapabilitySheet} from './capability-sheet.mjs';

const chunks=(a,n)=>Array.from({length:Math.ceil(a.length/n)},(_,i)=>a.slice(i*n,(i+1)*n));
const paint=n=>({input:C.amber,event:C.blue,operation:C.blue,scenario:C.blue,outcome:C.green,terminal:C.green,variant:C.green,port:C.violet,binding:C.violet,platform:C.violet,provider:C.violet,mechanic:C.violet}[n.kind]??C.blue);
const brief=(s,n=80)=>s.length>n?s.slice(0,n-1)+'…':s;
const wrap=(s,width=28,maxLines=5)=>{
 const words=String(s??'').split(/\s+/).flatMap(w=>w.length>width?w.match(new RegExp('.{1,'+width+'}','g')):[w]),lines=[];let line='';
 for(const word of words){if(line&&line.length+word.length+1>width){lines.push(line);line='';}line+=(line?' ':'')+word;}if(line)lines.push(line);
 return lines.length>maxLines?[...lines.slice(0,maxLines-1),brief(lines.slice(maxLines-1).join(' '),width)].join('\n'):lines.join('\n');
};

// A corridor must be clear of other cells and their complete glyph envelopes.
// This is a drafting choice only; edge identities and endpoint ownership stay fixed.
function clearCorridor(points,positions,edge,nodes){
 return Object.entries(positions).every(([id,b])=>{
  if(id===edge.from||id===edge.to)return true;
  const pad=0;
  const left=b.x-pad,right=b.x+b.w+pad,top=b.y-pad,bottom=b.y+b.h+pad;
  return points.slice(1).every(([x,y],i)=>{const [px,py]=points[i];
   return y===py ? !(y>top&&y<bottom&&Math.max(x,px)>left&&Math.min(x,px)<right)
    : !(x>left&&x<right&&Math.max(y,py)>top&&Math.min(y,py)<bottom);
  });
 });
}

// Coordinates depend only on this projection's known identities and edges.
// Toggling review/runtime overlays never moves a cell or changes the routes.
export function layoutBlueprint(projection){
 const positions={},routes=[],{nodes,edges,altitude}=projection;
 if(altitude==='scenario'){
  for(const n of nodes){const col=n.kind==='input'?0:n.kind==='event'?1:2;positions[n.id]={x:30+col*345,y:105,w:290,h:230};}
 }else if(['provider','physical'].includes(altitude)){
  const kinds=['operation','port','binding','platform','provider',...(altitude==='physical'?['endpoint','physical']:[])];
  for(const kind of kinds){const group=nodes.filter(n=>n.kind===kind);group.forEach((n,i)=>positions[n.id]={x:25+kinds.indexOf(kind)*250,y:20+i*140,w:215,h:110});}
 }else if(altitude==='event'){
  const cols=nodes.length>12?7:Math.min(4,Math.max(1,nodes.length));
  nodes.forEach((n,i)=>positions[n.id]={x:30+(i%cols)*275,y:35+Math.floor(i/cols)*113,w:235,h:88});
 }else if(altitude==='mechanic'){
  const depths=new Map();const depth=n=>{if(depths.has(n.id))return depths.get(n.id);const parent=edges.find(e=>e.to===n.id);const d=parent?depth(nodes.find(n=>n.id===parent.from))+1:0;depths.set(n.id,d);return d;};
  const rows=new Map();for(const n of nodes){const d=depth(n),row=rows.get(d)??0;rows.set(d,row+1);positions[n.id]={x:30+d*270,y:50+row*120,w:210,h:80};}
 }else{
  // A breadth-first order makes the topology readable without assigning a
  // convergence or execution meaning to shared geometry.
  const scenarios=nodes.filter(n=>n.kind==='scenario'),providers=nodes.filter(n=>n.kind==='provider');
  const ordered=[],seen=new Set(),queue=[scenarios.find(n=>n.scenarioId===projection.scenarioId)?.id??scenarios[0]?.id];
  while(ordered.length<scenarios.length){if(!queue.length)queue.push(scenarios.find(n=>!seen.has(n.id)).id);const id=queue.shift();if(seen.has(id))continue;seen.add(id);ordered.push(scenarios.find(n=>n.id===id));for(const e of edges)if(e.from===id&&e.kind!=='scenario-provider'&&!seen.has(e.to))queue.push(e.to);}
  if(providers.length){
   const span=Math.max(740,ordered.length*350+80,providers.length*320+80);
   providers.forEach((n,i)=>positions[n.id]={x:(span-(providers.length*320-70))/2+i*320,y:20,w:250,h:110});
   ordered.forEach((n,i)=>positions[n.id]={x:(span-(ordered.length*350-60))/2+i*350,y:235,w:290,h:130});
  }else ordered.forEach((n,i)=>positions[n.id]={x:50+(i%3)*380,y:95+Math.floor(i/3)*225,w:290,h:130});
 }
 const compact=['provider','physical'].includes(altitude);
 const width=Math.max(compact?300:700,...Object.values(positions).map(b=>b.x+b.w))+(compact?35:80);let height=Math.max(compact?100:320,...Object.values(positions).map(b=>b.y+b.h))+(compact?25:85);
 if(nodes.length===1){const b=positions[nodes[0].id];b.x=(width-b.w)/2;b.y=(height-b.h)/2;}
 for(const [i,e]of edges.entries()){
  const a=positions[e.from],b=positions[e.to];let points,routing='orthogonal';
  const from=nodes.find(n=>n.id===e.from),to=nodes.find(n=>n.id===e.to);
  const start=glyphAnchor(from,a,'right'),end=glyphAnchor(to,b,'left'),middle=(start[0]+end[0])/2;
  const forward=start[1]===end[1]?[start,end]:[start,[middle,start[1]],[middle,end[1]],end];
  if(e.kind==='provider-reference'){
   const y=Math.max(a.y+a.h,b.y+b.h)+32;
   const fromBottom=glyphAnchor(from,a,'bottom'),toBottom=glyphAnchor(to,b,'bottom');
   points=[fromBottom,[fromBottom[0],y],[toBottom[0],y],toBottom];
   height=Math.max(height,y+25);
  }else if(e.kind==='scenario-provider'){
   const fromTop=glyphAnchor(from,a,'top'),toBottom=glyphAnchor(to,b,'bottom');
   points=[fromTop,[fromTop[0],180],[toBottom[0],180],toBottom];
   points=points.filter((p,i)=>!i||p[0]!==points[i-1][0]||p[1]!==points[i-1][1]);
  }else if(e.from===e.to){const y=a.y-30;points=[[a.x+a.w*.7,a.y],[a.x+a.w*.7,y],[a.x+a.w*.3,y],[a.x+a.w*.3,a.y]];}
  else if(end[0]>start[0]&&clearCorridor(forward,positions,e,nodes)){points=forward;routing='forward';}
  else{const y=Math.min(a.y,b.y)-16-(i%3)*8;points=[start,[a.x+a.w+15,start[1]],[a.x+a.w+15,y],[b.x-12,y],[b.x-12,end[1]],end];}
  validateConnectorRoute(points,routing);
  routes.push({...e,points,routing});
 }
 return {width,height,positions,routes};
}

function draftingSurface(p,model,projection){
 for(let x=16;x<949;x+=16)p.add('line',x,118,x,486,C.blue,.45,{alpha:x%64===16?.18:.075});
 for(let y=118;y<487;y+=16)p.add('line',16,y,944,y,C.blue,.45,{alpha:y%64===54?.18:.075});
 p.add('shape','RECTANGLE',28,124,904,313,{fill:'none',stroke:C.blue,sw:1.1});
 p.add('shape','RECTANGLE',28,124,904,30,{fill:'#07223B',stroke:C.blue,sw:.8});
 p.text('Capability boundary',36,128,190,24,13,C.blue,true);
 p.text(brief(model.capabilityId,80),222,130,690,23,11,C.white);
 p.add('shape','RECTANGLE',28,464,904,23,{fill:'#07223B',stroke:C.blue,sw:.8});
 p.text('OBSERVATION / TELEMETRY',36,466,230,20,10,C.blue,true);
 p.text('Unobserved · no invocation selected',310,466,586,20,10,C.muted);
 const keys=[['INPUT',C.amber],['EXECUTION',C.blue],['PROVIDER',C.violet],['OUTCOME',C.green]];
 keys.forEach(([label,color],i)=>{const x=34+i*135;p.add('shape','RECTANGLE',x,445,10,10,{fill:'none',stroke:color,sw:1});p.text(label,x+16,441,112,20,9,color);});
 p.text(projection.edges?.some(e=>e.kind==='scenario-provider')?'Violet: declared provider involvement':'Dashed: declared order / call',626,442,298,20,9,C.muted);
}

function drawProjection(p,model,projection,{x=28,y=161,w=904,h=262,diagnostics=true,links={}}={}){
 const l=layoutBlueprint(projection),scale=Math.min(w/l.width,h/l.height,1),ox=x+(w-l.width*scale)/2,oy=y+(h-l.height*scale)/2;
 const at=(x,y)=>[ox+x*scale,oy+y*scale],overlay=projectionOverlays(model,projection,{diagnostics});
 const text=(value,b,size=20,color=C.white,bold=false,link)=>{
  const width=b.w*scale,height=Math.max(b.h*scale,12.2),fitted=fitBlueprintText(value,{width,height,fontSize:size*scale});
  p.add('t',fitted.text,...at(b.x,b.y),width,height,fitted.fontSize,color,bold,'center',...(link?[link]:[]));
 };
 for(const e of l.routes){
  const color=['port','binding','realization','provider-selection','provider-reference','scenario-provider','operand'].includes(e.kind)?C.violet:e.kind==='semantic-input'?C.amber:e.kind==='semantic-outcome'?C.green:C.blue;
  p.add('route',e.points.map(pt=>at(...pt)),color,{width:Math.max(.7,1.6*scale),arrow:!['scenario-provider','provider-reference'].includes(e.kind),dash:['call','sequence','provider-reference'].includes(e.kind),glow:false,routing:e.routing});
  if(projection.altitude==='capability'&&e.kind!=='scenario-provider')text(e.kind==='call'?'CALL · '+(e.sourceEdgeIds?.[0]||e.id):brief(e.label||e.kind,35),{x:e.points[0][0]-5,y:Math.min(...e.points.map(pt=>pt[1]))-25,w:140,h:23},14,color);
 }
 for(const n of projection.nodes){
  const b=l.positions[n.id],color=paint(n),issues=overlay.issues.filter(i=>i.visibleNodeIds.includes(n.id)),marker=issues.some(i=>i.severity==='error')?C.red:C.amber;
  const [gx,gy]=at(b.x,b.y),glyph=componentGlyph(n);
  drawComponentGlyph(p,n,{x:gx,y:gy,w:b.w*scale,h:b.h*scale},color,{scale});
  const heading=projection.altitude==='scenario'?({input:'GIVEN / INPUT',event:'WHEN / EVENT',outcome:'THEN / OUTCOME',terminal:'THEN / OUTCOME'}[n.kind]):n.kind==='operation'?String(n.ordinal).padStart(2,'0')+' · '+n.operationKind.toUpperCase():n.kind.toUpperCase();
  if(n.kind==='operation'&&scale>=.6){
   p.add('shape','ELLIPSE',...at(b.x+12,b.y+8),26*scale,26*scale,{fill:'#072D49',stroke:C.blue,sw:Math.max(.6,scale)});
   // The text frame includes native side insets; its visible digits remain
   // centered inside the smaller circle rather than wrapping into two lines.
   text(String(n.ordinal).padStart(2,'0'),{x:b.x+4,y:b.y+10,w:42,h:22},11,C.blue,true);
   text(n.operationKind,{x:b.x+45,y:b.y+10,w:b.w-52,h:25},12,C.blue);
  }else text(n.kind==='operation'?String(n.ordinal).padStart(2,'0'):heading,glyphFrame(b,glyph.heading),14,color,true);
  const label=n.kind==='provider'?n.label:projection.altitude==='scenario'?humanize(n.label):n.kind==='scenario'?(/\s/.test(n.label)?n.label:humanize(n.label)):identifierCaption(n.kind==='binding'?(n.transformationId||n.label):n.label,model.capabilityId);
  const providerView=['provider','physical'].includes(projection.altitude);
  text(label,glyphFrame(b,glyph.label),projection.altitude==='scenario'?23:n.kind==='scenario'?20:providerView?14:16,C.white,true,links[n.id]);
  for(const edge of l.routes){if(edge.from===n.id){const pt=edge.points[0];p.add('port',...at(...pt),color,Math.max(1.5,3*scale));}if(edge.to===n.id){const pt=edge.points.at(-1);p.add('port',...at(...pt),color,Math.max(1.5,3*scale));}}
  if(issues.length){const markerWidth=Math.max(98,issues.length*36);text(issues.map(i=>i.id).join(' '),{x:b.x+b.w-markerWidth,y:b.y-25,w:markerWidth,h:23},14,marker,true);}
 }
 if(!projection.nodes.length)p.text('No matching declaration is retained for this selection.',60,240,825,85,23,C.muted,false,'center');
 return l;
}

const nav=(p,label,target,x,y=495,w=250)=>p.add('t',label,x,y,w,25,12,C.blue,true,'left',{slideIndex:Number(target.id.slice(6))-1});
function mark(p,model,projection,role='projection'){
 p.blueprint={role,altitude:projection.altitude,scenarioId:projection.scenarioId,operationId:projection.operationId,topologyDigest:projection.topologyDigest,nodes:projection.nodes.map(n=>n.id),edges:projection.edges.map(e=>e.id)};
 p.detail=JSON.stringify(projection,null,2);
 p.interpretation=projection.scope;
}
export function appendBlueprintSlides({snapshot,model,page,view='capability',scenarioId=model.rootScenarioId,operationId,transformationId}){
 const primary=projectBlueprint(model,{altitude:view,scenarioId,operationId,transformationId}),pages=new Map(),projections=[];
 const projectionPage=(projection,role='projection')=>{
  const key=[projection.altitude,projection.scenarioId,projection.operationId??'',projection.transformationId??''].join('|');
  if(pages.has(key))return pages.get(key);
  const title={capability:'Capability blueprint',scenario:'Scenario meaning',event:'Complete execution circuit',provider:'Provider port ownership',physical:'Physical realization',mechanic:'Mechanic operand circuit'}[projection.altitude];
  const p=page(title,projection.altitude.toUpperCase()+' ALTITUDE · '+brief(projection.altitude==='capability'?model.capabilityId:projection.scenarioId,95),projection.nodes.map(n=>n.ref));
  mark(p,model,projection,role);pages.set(key,p);projections.push({projection,page:p});
  return p;
 };
 const first=projectionPage(primary,'overview');
 const capability=projectionPage(projectBlueprint(model));
 const active=reachableScenarios(model),selected=model.scenarios.filter(s=>active.has(s.id)||s.id===scenarioId);
 const scenarioPages=new Map(),eventPages=new Map(),providerPages=new Map(),providerInspectionPages=new Map();
 for(const sc of selected){
  scenarioPages.set(sc.id,projectionPage(projectBlueprint(model,{altitude:'scenario',scenarioId:sc.id})));
  eventPages.set(sc.id,projectionPage(projectBlueprint(model,{altitude:'event',scenarioId:sc.id})));
 }
 // The primary stays complete at its own altitude. Readable indexes are an
 // appendix, not additional geometry forced onto that projection.
 for(const sc of selected){
  const ops=sc.operationIds.map(id=>model.nodes.find(n=>n.id===id));
  for(const group of chunks(ops,5)){
   const p=page('Execution cell identities',sc.id+' · source declarations',group.map(n=>n.ref),JSON.stringify(group,null,2));p.blueprint={role:'identity-register',altitude:'event',scenarioId:sc.id};
   group.forEach((n,i)=>{const y=139+i*61;p.text(String(n.ordinal).padStart(2,'0'),35,y,45,26,16,C.blue,true);p.text(wrap(n.label,83,2),87,y,823,42,14,C.white,true);p.text(n.operationKind+' · '+(n.portId?'port: '+n.portId:'scenario: '+(n.targetScenarioId||'')),87,y+39,820,19,10,C.muted);});
   nav(p,'Back to complete Event circuit',eventPages.get(sc.id),35);
  }
  const ports=ops.filter(n=>n.portId);
  const portGroups=[];let pending=[];
  for(const op of ports){const external=model.nodes.find(n=>n.id==='binding:'+op.portId)?.providerIds?.length;
   if(external){if(pending.length)portGroups.push(pending);pending=[];portGroups.push([op]);}
   else{pending.push(op);if(pending.length===2){portGroups.push(pending);pending=[];}}
  }if(pending.length)portGroups.push(pending);
  for(const group of portGroups){
   const p=page('Provider port ownership',sc.id+' · OPERATION → PORT → BINDING → PLATFORM / PROVIDER',group.map(n=>n.ref));p.blueprint={role:'provider-detail',altitude:'provider',scenarioId:sc.id,operationIds:group.map(n=>n.id)};
   draftingSurface(p,model,{altitude:'provider'});
   group.forEach((n,i)=>{
    providerPages.set(n.id,p);const projection=projectBlueprint(model,{altitude:'provider',scenarioId:sc.id,operationId:n.id});
    drawProjection(p,model,projection,{y:164+i*130,h:group.length===1?252:122});p.detail+='\n'+JSON.stringify(projection);p.evidenceRefs.push(...projection.nodes.map(n=>n.ref));
   });nav(p,'Back to complete Event circuit',eventPages.get(sc.id),35);
  }
  for(const op of ports){
   const b=snapshot.bindings.find(b=>b.portId===op.portId),guard=b?.invocationCondition;if(!guard)continue;
   const issues=model.review.issues.filter(i=>i.code.startsWith('INVOCATION_')&&i.nodeIds.includes(op.id));
   const p=page('Invocation gate inspection',sc.id+' · OPERATION '+String(op.ordinal).padStart(2,'0'),[op.ref,b.sourceRef,...issues.flatMap(i=>i.sourceRefs)],JSON.stringify({operation:op,binding:b,issues},null,2));
   p.blueprint={role:'invocation-inspection',altitude:'provider',scenarioId:sc.id,operationIds:[op.id],issueIds:issues.map(i=>i.id)};
   const rows=[['Port',b.portId],['Invoke only when',guard.path+' = '+guard.equalsLabel],['When false',guard.whenFalse],['Request / result',b.selectors.requestPath+' / '+(b.selectors.resultPath??b.selectors.resultMode??'not retained')]];
   rows.forEach(([title,value],i)=>{const y=137+i*51;p.text(title,38,y,177,26,13,C.blue,true);p.text(wrap(value,75,2),221,y,690,48,14,C.white);});
   issues.slice(0,2).forEach((f,i)=>{p.text(f.id+' · '+wrap(f.message,110,3),38,352+i*57,874,56,12,f.severity==='error'?C.red:C.amber);});
   if(!issues.length)p.text('Declared gate; its runtime result is unobserved.',38,362,874,40,14,C.muted);
   nav(p,'Port and provider binding',providerPages.get(op.id),35);nav(p,'Complete Event circuit',eventPages.get(sc.id),490);
   nav(providerPages.get(op.id),'Invocation gate inspection',p,490);
  }
  for(const f of model.review.issues.filter(i=>['NESTED_INVOCATION_REQUEST_PATH_ABSENT','NESTED_INVOCATION_INPUT_UNVERIFIED','CLI_DISPLAY_SELECTOR_NOT_TOTAL'].includes(i.code)&&i.nodeIds.some(id=>sc.operationIds.includes(id)||id==='outcome:'+sc.id))){
   const e=f.evidence,proof=e.proof,display=f.code==='CLI_DISPLAY_SELECTOR_NOT_TOTAL';
   const p=page(display?'CLI display coverage':'Nested invocation inspection',sc.id+' · '+f.id+' · '+(proof?'PROPERTY DISPROVED':'UNVERIFIED'),f.sourceRefs,JSON.stringify(f,null,2));
   p.blueprint={role:'boundary-inspection',altitude:display?'scenario':'provider',scenarioId:sc.id,operationIds:f.nodeIds.filter(id=>sc.operationIds.includes(id)),issueIds:[f.id]};
   const rows=display?[
    ['Declared selector',e.path],['Outcome contract',e.contractId],['Counterexample','{} is admitted by the outcome schema; the selected value is null.'],
    ['Property disproved','The display selector is defined for every allowed outcome.'],['Effect','Failure details outside the selected path can be hidden.']
   ]:[['Parent request',e.outerRequestPath??'Not statically established'],['Pinned application',e.nestedCapabilityId??'Entry compatibility unverified'],
    ['Nested operation',e.nestedOperationId??'See retained source references'],['Required request',e.path??'Unknown'],['Supplied fields',(e.suppliedFields??[]).join(', ')||'Unknown']];
   rows.forEach(([title,value],i)=>{const y=133+i*48;p.text(title,38,y,175,27,13,C.blue,true);p.text(wrap(value,83,2),215,y,700,44,14,C.white);});
   p.text(wrap(f.message,108,3),38,380,877,65,13,f.severity==='error'?C.red:C.amber);
   p.text(display?'Bounded schema counterexample; runtime display and exit status require separate observation.':'Entry handoff proof only. Remaining nested operations are unverified; provider dispatch is not testimony.',38,448,877,42,12,C.muted);
   nav(p,'Complete Event circuit',eventPages.get(sc.id),35);
   for(const opId of p.blueprint.operationIds)if(providerPages.get(opId))nav(providerPages.get(opId),'Nested invocation inspection',p,490);
  }
  for(const variants of chunks(sc.variants,4)){
   const p=page('Declared outcome variants',sc.id+' · MEMBERSHIP, NOT INFERRED ROUTING',[sc.ref],JSON.stringify(variants,null,2));p.blueprint={role:'outcomes',altitude:'scenario',scenarioId:sc.id};
   p.add('shape','RECTANGLE',40,260,254,85,{fill:'#041C32',stroke:C.green,sw:1});p.text(wrap(sc.outcomeId,25,3),52,277,230,64,17,C.green,true);
   variants.forEach((v,i)=>{const y=170+i*66,color=v.classification==='failure'?C.red:C.green;p.add('route',[[294,302],[326,302],[326,y+25],[372,y+25]],color,{arrow:false,dash:true,glow:false,width:1});p.add('shape','RECTANGLE',372,y,534,53,{fill:'#041C32',stroke:color,sw:1});p.text(wrap(v.id,53,2),384,y+7,510,45,15,color,true);});
   nav(p,'Back to scenario meaning',scenarioPages.get(sc.id),35);
  }
 }
 const involvement=projectBlueprint(model).edges.filter(e=>e.kind==='scenario-provider');
 for(const providerId of [...new Set(involvement.map(e=>e.to))]){
  const provider=model.nodes.find(n=>n.id===providerId),links=involvement.filter(e=>e.to===providerId);
  const uses=links.flatMap(e=>e.via.map(v=>({...v,scenarioId:e.from.slice(9),sourceRefs:e.sourceRefs})));
  for(const group of chunks(uses,3)){
   const p=page('Provider involvement',provider.label,group.flatMap(v=>v.sourceRefs),JSON.stringify({provider,uses:group},null,2));
   p.blueprint={role:'provider-inspection',providerId};providerInspectionPages.set(providerId,providerInspectionPages.get(providerId)??p);
   group.forEach((use,i)=>{const y=139+i*105,op=model.nodes.find(n=>n.id===use.operationId),target=providerPages.get(op.id);
    p.add('t',wrap(op.label,76,2),38,y,870,44,17,C.white,true,'left',...(target?[{slideIndex:Number(target.id.slice(6))-1}]:[]));
    p.text(use.basis+' · '+use.scenarioId,38,y+46,870,25,12,C.violet);
    p.text(wrap('Port binding: '+use.bindingId.slice(8),97,2),38,y+72,870,36,11,C.muted);
   });
   p.text('Declared references; execution and successful testimony are separate evidence.',38,468,874,22,11,C.muted);
   nav(p,'Back to capability blueprint',capability,35);
  }
 }
 let review;
 for(const group of chunks(model.review.issues,4)){
  const p=page('Blueprint review',model.review.signal.replaceAll('_',' ')+' · SOURCE-BOUND FINDINGS',group.flatMap(i=>i.sourceRefs),JSON.stringify(group,null,2));review??=p;p.blueprint={role:'review',issueIds:group.map(i=>i.id)};
  group.forEach((f,i)=>{const y=135+i*82,color=f.severity==='error'?C.red:C.amber;p.text(f.id+' · '+f.severity.toUpperCase()+' · '+humanize(f.code),36,y,882,27,15,color,true);p.text(wrap(f.message,103,3),37,y+29,878,52,13,C.white);});
  nav(p,'Return to selected blueprint',first,35);
 }
 const inventory=declarationInventory(model);let inventoryPage;
 for(const group of chunks(inventory,5)){
  const p=page('Declaration inventory','OUTSIDE THE ROOT-CONNECTED CIRCUIT',group.map(n=>n.ref),JSON.stringify(group,null,2));inventoryPage??=p;p.blueprint={role:'inventory'};
  group.forEach((n,i)=>{const y=137+i*62;p.text(n.kind.toUpperCase(),36,y,172,25,12,C.muted,true);p.text(wrap(n.portId||n.id,77,2),208,y,701,50,15,C.white);});
  nav(p,'Return to capability blueprint',capability,35);
 }
 for(const {projection,page:p}of projections){
  if(projection.altitude==='capability'){
   // Render directly with the portfolio grammar. The legacy layered projection
   // can overflow on deep call graphs before the final navigation pass runs.
   drawCapabilitySheet(p,snapshot,model,{slides:[...pages.values(),...providerInspectionPages.values(),...[review,inventoryPage].filter(Boolean)],selectedScenarioId:scenarioId});
   continue;
  }
  const links={};
  if(projection.altitude==='scenario')links['event:'+projection.scenarioId]={slideIndex:Number(eventPages.get(projection.scenarioId).id.slice(6))-1};
  if(projection.altitude==='event')for(const n of projection.nodes)if(providerPages.has(n.id))links[n.id]={slideIndex:Number(providerPages.get(n.id).id.slice(6))-1};
  const fullEvent=projection.altitude==='event';
  if(fullEvent){p.headerLayout='custom';drawEventSheet(p,model,projection,{links});}
  else {draftingSurface(p,model,projection);drawProjection(p,model,projection,{links});}
  const navY=fullEvent?500:495;
  nav(p,'Capability',capability,fullEvent?14:35,navY,115);
  if(projection.altitude!=='capability')nav(p,'Scenario',scenarioPages.get(projection.scenarioId),160,navY,fullEvent?140:112);
  if(review)nav(p,'Review · '+model.review.errors+' errors / '+model.review.warnings+' warnings',review,fullEvent?385:300,navY,315);
  if(inventoryPage)nav(p,'Inventory · '+inventory.length,inventoryPage,fullEvent?780:680,navY,fullEvent?150:200);
 }
 return {primary,projections:projections.map(v=>v.projection),inventory};
}

export function renderBlueprintSvg(model,selection={},snapshot){
 const projection=projectBlueprint(model,selection),native=new Slide(1,'');native.svg=[];
 const p={add:(op,...args)=>Slide.prototype[op].apply(native,args),text:(...args)=>native.t(...args)};
 if(projection.altitude==='capability'&&snapshot){
  // Match the deck's zoomed-out semantic surface when contract context is available.
  const sheet={commands:[],blueprint:{},add:(op,...args)=>Slide.prototype[op].apply(native,args),text:(...args)=>native.t(...args)};
  drawCapabilitySheet(sheet,snapshot,model,{selectedScenarioId:selection.scenarioId??model.rootScenarioId});
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 960 540"><rect width="960" height="540" fill="'+C.bg+'"/>'+native.svg.join('')+'</svg>';
 }
 if(projection.altitude==='event'){
  p.blueprint={};p.interpretation='';drawEventSheet(p,model,projection);
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 960 540"><rect width="960" height="540" fill="'+C.bg+'"/>'+native.svg.join('')+'</svg>';
 }
 const layout=layoutBlueprint(projection);
 p.text(model.capabilityId,24,12,layout.width,40,25,C.white,true);
 p.text(projection.altitude.toUpperCase()+' ALTITUDE',24,56,layout.width,30,17,C.blue,true);
 drawProjection(p,model,projection,{x:20,y:110,w:layout.width,h:layout.height});
 p.text(projection.scope,24,layout.height+126,layout.width,40,14,C.muted);
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+(layout.width+40)+'" height="'+(layout.height+180)+'" viewBox="0 0 '+(layout.width+40)+' '+(layout.height+180)+'"><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#1673A7" stroke-width="0.5" opacity="0.35"/></pattern></defs><rect width="100%" height="100%" fill="#001629"/><rect width="100%" height="100%" fill="url(#grid)"/><rect x="16" y="100" width="'+(layout.width+8)+'" height="'+(layout.height+12)+'" fill="none" stroke="'+C.blue+'" stroke-width="1.5"/>'+native.svg.join('')+'</svg>';
}
