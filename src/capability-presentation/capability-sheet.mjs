import {C} from '../circuit-presentation/design.mjs';
import {validateConnectorRoute,validateConnectorAttachment} from '../circuit-presentation/contracts.mjs';
import {fitBlueprintText} from '../circuit-presentation/text-fit.mjs';
import {projectBlueprint,projectionOverlays} from './projection.mjs';
import {blueprintGrid} from './event-sheet.mjs';
import {drawComponentGlyph} from './component-glyphs.mjs';

const reject=message=>{throw Object.assign(new Error(message),{code:'CAPABILITY_PORTFOLIO_INVALID'});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const LEAD=24,CLEARANCE=12;
const compact=points=>points.filter((p,i,a)=>!i||i===a.length-1||!((a[i-1][0]===p[0]&&p[0]===a[i+1][0])||(a[i-1][1]===p[1]&&p[1]===a[i+1][1])));
const attachmentFor=e=>({sourceNormal:e.from===e.to?[0,-1]:[1,0],targetNormal:e.from===e.to?[0,-1]:[-1,0],minimumLead:LEAD});

// Visibility-grid routing keeps call and transition wires outside every card.
// The cost favors short orthogonal paths with few bends; it adds no graph edges.
function clearSegment(a,b,boxes){return boxes.every(c=>a[1]===b[1]
 ? !(a[1]>c.y&&a[1]<c.y+c.h&&Math.max(a[0],b[0])>c.x&&Math.min(a[0],b[0])<c.x+c.w)
 : !(a[0]>c.x&&a[0]<c.x+c.w&&Math.max(a[1],b[1])>c.y&&Math.min(a[1],b[1])<c.y+c.h));}
function routeCards(start,end,positions,width,height){
 // Route between exterior escape points, then attach perpendicular leads.
 // Inflated obstacles prevent the search from using a card border as a lane.
 const source=start,target=end;start=[source[0]+LEAD,source[1]];end=[target[0]-LEAD,target[1]];
 const boxes=Object.values(positions).map(b=>({x:b.x-CLEARANCE,y:b.y-CLEARANCE,w:b.w+2*CLEARANCE,h:b.h+2*CLEARANCE}));
 const xs=[...new Set([start[0],end[0],4,width-4,...boxes.flatMap(b=>[b.x,b.x+b.w])])].sort((a,b)=>a-b),ys=[...new Set([start[1],end[1],4,height-4,...boxes.flatMap(b=>[b.y,b.y+b.h])])].sort((a,b)=>a-b);
 const startIndex=[xs.indexOf(start[0]),ys.indexOf(start[1])],goal=[xs.indexOf(end[0]),ys.indexOf(end[1])];
 const key=(x,y,d)=>x+':'+y+':'+d,open=[{x:startIndex[0],y:startIndex[1],d:'',cost:0,path:[start]}],best=new Map();
 while(open.length){open.sort((a,b)=>a.cost-b.cost);const s=open.shift(),k=key(s.x,s.y,s.d);if((best.get(k)??Infinity)<s.cost)continue;
  if(s.x===goal[0]&&s.y===goal[1])return compact([source,...s.path,target]);
  for(const [dx,dy,d]of [[-1,0,'h'],[1,0,'h'],[0,-1,'v'],[0,1,'v']]){const x=s.x+dx,y=s.y+dy;if(x<0||y<0||x>=xs.length||y>=ys.length)continue;
   if(dx<0&&(s.path.length===1||(x===goal[0]&&y===goal[1])))continue; // No reversal into an attachment lead.
   const a=[xs[s.x],ys[s.y]],b=[xs[x],ys[y]];if(!clearSegment(a,b,boxes))continue;
   const cost=s.cost+Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+(s.d&&s.d!==d?16:0),next=key(x,y,d);
   if(cost>=(best.get(next)??Infinity))continue;best.set(next,cost);open.push({x,y,d,cost,path:[...s.path,b]});
  }
 }
 reject('No clear orthogonal corridor remains for a declared scenario edge.');
}

// The portfolio collapses provider involvement into badges on its owning
// scenario. Every badge keeps the actual collapsed edge and its source path.
export function layoutCapabilityPortfolio(projection){
 if(projection.altitude!=='capability')reject('A capability projection is required.');
 const nodes=projection.nodes.filter(n=>n.kind==='scenario'),edges=projection.edges.filter(e=>e.kind!=='scenario-provider');
 const involvement=projection.edges.filter(e=>e.kind==='scenario-provider'),positions={},levels=new Map(),queue=[];
 const root=nodes.find(n=>n.scenarioId===projection.scenarioId)??nodes[0];
 if(root){levels.set(root.id,0);queue.push(root.id);}
 while(queue.length){const id=queue.shift();for(const e of edges)if(e.from===id&&!levels.has(e.to)){levels.set(e.to,levels.get(id)+1);queue.push(e.to);}}
 for(const n of nodes)if(!levels.has(n.id))reject('Portfolio contains a scenario outside the selected topology.');
 const columns=Math.max(1,...levels.values())+Number(nodes.length>1),top=edges.some(e=>e.from===e.to)?36+edges.length*7:24;
 const cardW=nodes.length===1?560:280;
 const cardH=n=>128+Math.ceil(involvement.filter(e=>e.from===n.id).length/(nodes.length===1?2:1))*44;
 const groups=Array.from({length:columns},(_,level)=>nodes.filter(n=>levels.get(n.id)===level));
 const packed=groups.map(group=>{const cols=Math.min(3,Math.max(1,Math.ceil(Math.sqrt(group.length)))),rows=Array.from({length:Math.ceil(group.length/cols)},(_,i)=>group.slice(i*cols,(i+1)*cols));return {group,cols,rows,heights:rows.map(r=>Math.max(...r.map(cardH)))};});
 const height=Math.max(220,...packed.map(g=>g.heights.reduce((a,h)=>a+h+30,0)-30))+top+20;
 let columnX=28;
 for(const group of packed){let y=top+(height-top-20-(group.heights.reduce((a,h)=>a+h+30,0)-30))/2;
  for(const [r,row]of group.rows.entries()){for(const [c,n]of row.entries())positions[n.id]={x:columnX+c*(cardW+64),y,w:cardW,h:cardH(n)};y+=group.heights[r]+30;}
  columnX+=group.cols*(cardW+64);
 }
 const width=nodes.length===1?616:columnX-36;
 const routes=edges.map((e,i)=>{
  const a=positions[e.from],b=positions[e.to];if(!a||!b)reject('Unknown scenario endpoint.');
  let points,routing='orthogonal';
  const peers=edges.filter(v=>v.from===e.from&&v.to===e.to),laneIndex=peers.findIndex(v=>v.id===e.id),spread=(laneIndex-(peers.length-1)/2)*Math.min(12,60/peers.length);
  const start=[a.x+a.w,a.y+a.h/2+spread],end=[b.x,b.y+b.h/2+spread];
  if(e.from===e.to)points=[[a.x+a.w*.72,a.y],[a.x+a.w*.72,12+i*7],[a.x+a.w*.28,12+i*7],[a.x+a.w*.28,a.y]];
  else points=routeCards(start,end,positions,width,height);
  if(e.from!==e.to){try{validateConnectorRoute(points,'forward');routing='forward';}catch{}}
  return {...e,points,routing};
 });
 const layout={width,height,positions,routes,badges:involvement.map(e=>({...e}))};
 validateCapabilityPortfolio(projection,layout);return layout;
}

export function validateCapabilityPortfolio(projection,layout){
 const scenarios=projection.nodes.filter(n=>n.kind==='scenario'),edges=projection.edges.filter(e=>e.kind!=='scenario-provider');
 if(!same(Object.keys(layout.positions).sort(),scenarios.map(n=>n.id).sort()))reject('Scenario coverage changed.');
 if(!same(layout.routes.map(({id,from,to})=>[id,from,to]),edges.map(e=>[e.id,e.from,e.to])))reject('Scenario edge ownership changed.');
 if(!same(layout.badges,projection.edges.filter(e=>e.kind==='scenario-provider')))reject('Provider involvement lost its source path.');
 if(![layout.width,layout.height].every(v=>Number.isFinite(v)&&v>0))reject('Invalid portfolio surface.');
 for(const b of Object.values(layout.positions))if(![b.x,b.y,b.w,b.h].every(Number.isFinite)||b.x<0||b.y<0||b.w<=0||b.h<=0||b.x+b.w>layout.width||b.y+b.h>layout.height)reject('A scenario leaves the portfolio surface.');
 for(const e of layout.routes){validateConnectorRoute(e.points,e.routing);
  validateConnectorAttachment(e.points,attachmentFor(e));
  if(e.points.some(([x,y])=>x<0||y<0||x>layout.width||y>layout.height))reject('A scenario wire leaves the portfolio surface.');
  const a=layout.positions[e.from],b=layout.positions[e.to],first=e.points[0],last=e.points.at(-1);
  const onSide=(pt,box,side)=>side==='top'?pt[1]===box.y&&pt[0]>box.x&&pt[0]<box.x+box.w:pt[0]===(side==='left'?box.x:box.x+box.w)&&pt[1]>box.y&&pt[1]<box.y+box.h;
  if(!onSide(first,a,e.from===e.to?'top':'right')||!onSide(last,b,e.from===e.to?'top':'left'))reject('A scenario wire misses its owned attachment side or lands on an ambiguous corner.');
  for(const [id,c]of Object.entries(layout.positions))if(id!==e.from&&id!==e.to)for(let i=1;i<e.points.length;i++){
   const [x,y]=e.points[i],[px,py]=e.points[i-1];
   if(y===py?(y>c.y&&y<c.y+c.h&&Math.max(x,px)>c.x&&Math.min(x,px)<c.x+c.w):(x>c.x&&x<c.x+c.w&&Math.max(y,py)>c.y&&Math.min(y,py)<c.y+c.h))reject('A scenario wire crosses an unrelated card.');
  }
 }
 return true;
}

export function drawCapabilitySheet(p,snapshot,model,{slides=[],selectedScenarioId=model.rootScenarioId}={}){
 const projection=projectBlueprint(model),layout=layoutCapabilityPortfolio(projection),overlay=projectionOverlays(model,projection),root=model.scenarios.find(s=>s.id===model.rootScenarioId);
 const selected=model.scenarios.find(s=>s.id===selectedScenarioId&&Object.hasOwn(layout.positions,'scenario:'+s.id))??root;
 const scenarioPage=id=>slides.find(s=>s.blueprint?.role==='scenario-blueprint'&&s.blueprint.scenarioId===id)??slides.find(s=>s.blueprint?.altitude==='scenario'&&s.blueprint.scenarioId===id);
 const link=target=>target?{slideIndex:Number(target.id.slice(6))-1}:undefined;
 p.commands=[];p.headerLayout='custom';p.title='Capability circuit blueprint';p.subtitle='Scenario portfolio and drill-down map';
 p.blueprint={...p.blueprint,altitude:'capability',scenarioId:root.id,topologyDigest:projection.topologyDigest,nodes:projection.nodes.map(n=>n.id),edges:projection.edges.map(e=>e.id),portfolio:{scenarioIds:Object.keys(layout.positions),routes:layout.routes,badges:layout.badges},glyphs:[],textFrames:[]};
 p.detail=JSON.stringify({projection,scenarioContext:model.scenarios.filter(s=>Object.hasOwn(layout.positions,'scenario:'+s.id)),inputContract:snapshot.contracts.find(c=>c.id===root.inputContractId)},null,2);
 p.interpretation='Only root-connected declared scenarios become scenario cards. Provider badges retain exact operation and binding paths, including testimony references. Input and outcome frames summarize the root scenario semantic contract; they do not prove execution routing or observed success. Selection denotes the drill-down target, not runtime state. Unconnected declarations remain in the inventory. No stages are promoted to scenarios.';
 const text=(value,b,size=12,color=C.white,bold=false,target,align='left',floor=8)=>{
  b={...b,h:Math.max(b.h,12.2)};
  const f=fitBlueprintText(String(value),{width:b.w,height:b.h,fontSize:size,minFontSize:Math.min(floor,size)});
  p.add('t',f.text,b.x,b.y,b.w,b.h,f.fontSize,color,bold,align,...(target?[link(target)]:[]));p.blueprint.textFrames.push(b);
 };
 blueprintGrid(p);
 p.text(p.title,12,2,932,37,29,C.white,true);p.text(model.capabilityId,14,39,932,26,17,C.blue,true);
 p.text(p.subtitle,14,65,932,22,12,C.muted);
 p.add('shape','RECTANGLE',8,93,944,356,{fill:'none',stroke:C.blue,sw:1.1});p.add('shape','RECTANGLE',9,94,942,25,{fill:'#05243B'});
 p.text('Capability boundary',16,94,370,25,13,C.blue,true);
 [['Input',C.amber],['Scenario',C.blue],['Provider',C.violet],['Outcome',C.green],['Observation','#72D7EE']].forEach(([label,color],i)=>{const x=440+i*100;p.add('shape','RECTANGLE',x,102,8,8,{fill:'none',stroke:color,sw:.8});p.text(label,x+9,96,89,21,8.5,color);});
 for(const [title,x,w,color]of [['GIVEN / INPUT',14,146,C.amber],['Scenario portfolio',172,616,C.blue],['THEN / OUTCOME',800,146,C.green]]){
  p.add('shape','RECTANGLE',x,126,w,313,{fill:'#031B2F',stroke:color,sw:1});p.text(title,x+4,129,w-8,25,12,color,true);
 }
 const scenarioCount=projection.nodes.filter(n=>n.kind==='scenario').length;
 p.text(scenarioCount+' declared scenario'+(scenarioCount===1?'':'s')+' · '+layout.routes.filter(e=>e.kind==='call').length+' calls · '+layout.routes.filter(e=>e.kind!=='call').length+' transitions',179,153,600,22,10,C.blue);
 text((root.inputId||root.inputContractId||'Input not retained').replaceAll('-',' '),{x:19,y:177,w:136,h:64},13,C.amber,true);
 const fields=(snapshot.contracts.find(c=>c.id===root.inputContractId)?.fields??[]).filter(f=>/^\$\/payload\/[^/]+$/.test(f.path));
 const inputs=fields.length?fields.map(f=>f.path.replace('$/','').replaceAll('/','.')):[root.inputContractId||'No input contract retained'];
 const ih=Math.min(53,176/inputs.length);
 inputs.forEach((label,i)=>{const y=246+i*ih;p.add('shape','ROUND_RECTANGLE',23,y,128,ih-7,{fill:'#18291E',stroke:C.amber,sw:1.1});p.add('shape','RECTANGLE',31,y+13,10,14,{fill:'none',stroke:C.amber,sw:.8});p.add('line',33,y+18,39,y+18,C.amber,.8);text(label,{x:44,y:y+3,w:103,h:ih-12},10.5,C.amber,false,undefined,'left',4);});
 p.text('Root scenario variants',805,156,135,30,9,C.green);
 const outcomes=root.variants.length?root.variants:[{id:root.outcomeId||'No outcome retained',classification:''}],oh=Math.min(77,246/outcomes.length);
 outcomes.forEach((v,i)=>{const y=190+i*oh,color=v.classification==='failure'?C.red:C.green;
  p.add('shape','ROUND_RECTANGLE',808,y,130,oh-8,{fill:'#04252B',stroke:color,sw:1});p.add('shape','ELLIPSE',816,y+17,15,15,{fill:'none',stroke:color,sw:1});
  if(v.classification==='failure'){p.add('line',820,y+21,827,y+28,color,1);p.add('line',820,y+28,827,y+21,color,1);}else if(v.classification==='success'){p.add('line',819,y+25,822,y+28,color,1);p.add('line',822,y+28,828,y+21,color,1);}
  text(v.id.replaceAll('_',' ').replaceAll('-',' ').toLowerCase(),{x:834,y:y+7,w:100,h:oh-19},10,color);
 });
 const scale=Math.min(584/layout.width,210/layout.height,1),ox=188+(584-layout.width*scale)/2,oy=176+(210-layout.height*scale)/2;
 const box=b=>({x:ox+b.x*scale,y:oy+b.y*scale,w:b.w*scale,h:b.h*scale}),point=pt=>[ox+pt[0]*scale,oy+pt[1]*scale];
 const rendered=[];
 for(const e of layout.routes){p.add('route',e.points.map(point),C.blue,{arrow:true,dash:e.kind==='call',glow:false,width:Math.max(.7,1.4*scale),routing:e.routing,attachment:{...attachmentFor(e),minimumLead:8}});}
 const cardNodes=projection.nodes.filter(n=>n.kind==='scenario').sort((a,b)=>Number(b.scenarioId===root.id)-Number(a.scenarioId===root.id));
 for(const [i,n]of cardNodes.entries()){
  const sc=model.scenarios.find(s=>s.id===n.scenarioId),b=box(layout.positions[n.id]),isSelected=sc.id===selected.id,paint=isSelected?'#49DDF7':C.blue;
  const issues=overlay.issues.filter(f=>f.visibleNodeIds.includes(n.id));
  if(issues.length)text(issues.map(f=>f.id).join(' '),{x:b.x,y:b.y-17,w:b.w,h:17},8,issues.some(f=>f.severity==='error')?C.red:C.amber,true,slides.find(s=>s.blueprint?.role==='review'),'right',4);
  if(isSelected)p.add('shape','ROUND_RECTANGLE',b.x-2,b.y-2,b.w+4,b.h+4,{fill:'none',stroke:paint,sw:2,sa:.25});
  drawComponentGlyph(p,n,b,paint,{scale,fill:'#08283F'});
  const sb=(x,y,w,h)=>({x:b.x+x*scale,y:b.y+y*scale,w:w*scale,h:h*scale}),cw=layout.positions[n.id].w;
  text('S'+String(i+1).padStart(2,'0')+(isSelected?' · SELECTED':''),sb(9,8,cw-18,25),13*scale,paint,true,undefined,'left',4);
  text((scenarioCount===1?sc.name:sc.id).replaceAll('-',' '),sb(9,34,cw-18,scenarioCount===1?52:86),19*scale,C.white,true,isSelected?undefined:scenarioPage(sc.id),'left',4);
  if(scenarioCount===1)text(sc.operationIds.length+' operations · '+(sc.terminal?'terminal scenario':'declared scenario'),sb(9,86,cw-18,24),11*scale,C.muted,false,undefined,'left',4);
  const badges=layout.badges.filter(e=>e.from===n.id),cols=projection.nodes.filter(v=>v.kind==='scenario').length===1?2:1,bw=(cw-24)/cols;
  badges.forEach((e,j)=>{
   const provider=model.nodes.find(v=>v.id===e.to),pb=sb(12+(j%cols)*bw,119+Math.floor(j/cols)*44,bw-6,34);
   const target=slides.find(s=>s.blueprint?.role==='provider-inspection'&&s.blueprint.providerId===provider.id);
   p.add('shape','ROUND_RECTANGLE',pb.x,pb.y,pb.w,pb.h,{fill:'#141E37',stroke:C.violet,sw:Math.max(.6,scale)});
   text(provider.label,pb,12*scale,C.violet,true,target,'center',4);
  });
  rendered.push({scenarioId:sc.id,nodeId:n.id,sourceRef:n.ref,bounds:b,providerEdgeIds:badges.map(e=>e.id)});
 }
 const rootBox=box(layout.positions['scenario:'+root.id]),mid=rootBox.y+rootBox.h/2;
 // Boundary wires express the retained semantic positions only. They are kept
 // outside the scenario topology and never recorded as execution edges.
 p.add('route',[[160,mid],[rootBox.x,mid]],C.amber,{arrow:true,glow:false,width:1.2,routing:'forward'});
 if(layout.routes.length===0)p.add('route',[[rootBox.x+rootBox.w,mid],[800,mid]],C.green,{arrow:true,glow:false,width:1.2,routing:'forward'});
 p.add('shape','ROUND_RECTANGLE',184,391,592,38,{fill:'#05243B',stroke:C.blue,sw:1});
 const target=scenarioPage(selected.id);text('Open scenario circuit blueprint',{x:194,y:393,w:570,h:31},15,C.white,true,target);
 p.add('shape','RECTANGLE',8,456,944,39,{fill:'#05243B',stroke:'#72D7EE',sw:.9});
 p.text('Observation / Telemetry',14,459,230,22,12,'#72D7EE',true);p.text('State overlays preserve the circuit',14,478,230,16,8,C.muted);
 p.text('Invocation: none selected',271,464,263,25,11,C.muted);p.text('Circuit state: unobserved',559,464,330,25,11,C.muted);
 const review=slides.find(s=>s.blueprint?.role==='review'),inventory=slides.find(s=>s.blueprint?.role==='inventory');
 if(inventory)text('Declaration inventory',{x:14,y:498,w:272,h:24},12,C.blue,true,inventory);
 text('Input / outcome: semantic contract',{x:303,y:500,w:319,h:20},9,C.muted);
 if(review)text('Review · '+model.review.errors+' errors / '+model.review.warnings+' warnings',{x:631,y:498,w:310,h:24},12,C.amber,true,review);
 p.blueprint.portfolio.rendered=rendered;p.blueprint.inputFieldPaths=fields.map(f=>f.path);p.blueprint.outcomeVariantIds=outcomes.map(v=>v.id);
 return projection;
}
