import {C} from '../circuit-presentation/design.mjs';
import {validateConnectorRoute} from '../circuit-presentation/contracts.mjs';
import {fitBlueprintText} from '../circuit-presentation/text-fit.mjs';
import {identifierCaption} from './caption.mjs';
import {projectionOverlays} from './projection.mjs';

const reject=message=>{throw Object.assign(new Error(message),{code:'CAPABILITY_EVENT_RENDER_INVALID'});};
export const ACTION_COLORS={build:'#22BEFF',bind:'#BE83FF',observe:'#00D9CD',select:'#F3CC55',other:C.blue};
export function eventAction(node){
 const verb=node.label.split(/[-_.\s]/)[0].toLowerCase();
 const category=verb==='normalize'?'select':Object.hasOwn(ACTION_COLORS,verb)?verb:'other';
 return {category,color:ACTION_COLORS[category],basis:'identifier-prefix',sourceLabel:node.label};
}

// Rows are pagination of declared order, never additional semantic stages.
export function layoutEventCircuit(projection){
 if(projection.altitude!=='event')reject('Event rendering requires an Event projection.');
 const {nodes,edges}=projection,cols=Math.min(7,Math.max(1,nodes.length)),rowCount=Math.max(1,Math.ceil(nodes.length/cols));
 const band=Math.min(74,(394-(rowCount-1)*6)/rowCount),gap=16,w=Math.min(240,(928-gap*(cols-1))/cols);
 const offset=(960-(cols*w+(cols-1)*gap))/2,positions={},rows=[];
 for(let r=0;r<rowCount;r++){
  const members=nodes.slice(r*cols,(r+1)*cols),y=68+r*(band+6);
  rows.push({index:r+1,y,height:band,nodeIds:members.map(n=>n.id),first:members[0]?.ordinal,last:members.at(-1)?.ordinal,basis:'layout-only'});
  members.forEach((n,c)=>positions[n.id]={x:offset+c*(w+gap),y:y+23,w,h:band-29,row:r});
 }
 const routes=edges.map(e=>{
  const a=positions[e.from],b=positions[e.to];if(!a||!b)reject('Unknown edge endpoint.');
  if(e.kind!=='sequence')reject('This sheet does not support the selected edge kind.');
  const start=[a.x+a.w,a.y+a.h/2],end=[b.x,b.y+b.h/2];let points,routing;
  if(a.row===b.row&&b.x>start[0]){points=[start,end];routing='forward';}
  else if(b.row===a.row+1){const y=rows[a.row].y+band+3;points=[start,[955,start[1]],[955,y],[5,y],[5,end[1]],end];routing='orthogonal';}
  else reject('A declared edge cannot be routed by the ordered row grammar.');
  return {...e,points,routing};
 });
 const layout={positions,rows,routes};validateEventLayout(projection,layout);return layout;
}

export function validateEventLayout(projection,layout){
 const nodes=new Set(projection.nodes.map(n=>n.id)),edges=new Set(projection.edges.map(e=>e.id));
 if(nodes.size!==projection.nodes.length||Object.keys(layout.positions).length!==nodes.size||Object.keys(layout.positions).some(id=>!nodes.has(id)))reject('Cell coverage changed.');
 if(layout.routes.length!==edges.size||new Set(layout.routes.map(e=>e.id)).size!==edges.size||layout.routes.some(e=>!edges.has(e.id)))reject('Edge coverage changed.');
 for(const b of Object.values(layout.positions))if(![b.x,b.y,b.w,b.h].every(Number.isFinite)||b.w<=0||b.h<=0||b.x<0||b.y<68||b.x+b.w>960||b.y+b.h>462)reject('Cell leaves the execution surface.');
 for(const e of layout.routes){
  const declared=projection.edges.find(v=>v.id===e.id);if(declared.from!==e.from||declared.to!==e.to)reject('Edge ownership changed.');
  validateConnectorRoute(e.points,e.routing);
  const a=layout.positions[e.from],b=layout.positions[e.to],start=e.points[0],end=e.points.at(-1);
  if(start[0]!==a.x+a.w||start[1]!==a.y+a.h/2||end[0]!==b.x||end[1]!==b.y+b.h/2)reject('Edge misses its owned anchors.');
  for(const [id,cell] of Object.entries(layout.positions))if(id!==e.from&&id!==e.to)for(let i=1;i<e.points.length;i++){
   const [x,y]=e.points[i],[px,py]=e.points[i-1];
   if(y===py?(y>cell.y&&y<cell.y+cell.h&&Math.max(x,px)>cell.x&&Math.min(x,px)<cell.x+cell.w):(x>cell.x&&x<cell.x+cell.w&&Math.max(y,py)>cell.y&&Math.min(y,py)<cell.y+cell.h))reject('Connector crosses another execution cell.');
  }
 }
 return true;
}

export function blueprintGrid(p){
 for(let x=0;x<=960;x+=12)p.add('line',x,0,x,540,C.blue,.35,{alpha:x%60===0?.15:.06});
 for(let y=0;y<=540;y+=12)p.add('line',0,y,960,y,C.blue,.35,{alpha:y%60===0?.15:.06});
}
export function drawEventSheet(p,model,projection,{links={},diagnostics=true}={}){
 const layout=layoutEventCircuit(projection),overlay=projectionOverlays(model,projection,{diagnostics});
 blueprintGrid(p);
 p.text('Complete execution circuit',12,3,928,38,29,C.white,true);
 p.text(model.capabilityId+'  ·  '+projection.nodes.length+' operations',14,40,930,25,17,C.blue,true);
 for(const row of layout.rows){
  p.add('shape','ROUND_RECTANGLE',8,row.y,944,row.height,{fill:'none',stroke:'#29B9ED',sw:1});
  p.add('shape','RECTANGLE',9,row.y+1,942,19,{fill:'#05243B'});
  p.text('Execution row '+row.index,14,row.y-1,400,22,12,C.blue,true);
  p.text('Operations '+String(row.first??0).padStart(2,'0')+' – '+String(row.last??0).padStart(2,'0'),700,row.y,244,21,10,C.blue,false,'right');
 }
 for(const e of layout.routes)p.add('route',e.points,'#78D8F5',{arrow:true,width:1.4,glow:false,routing:e.routing});
 const rendered=[];
 for(const n of projection.nodes){
  const b=layout.positions[n.id],action=eventAction(n),issues=overlay.issues.filter(i=>i.visibleNodeIds.includes(n.id));
  p.add('shape','ROUND_RECTANGLE',b.x,b.y,b.w,b.h,{fill:action.category==='bind'?'#17132F':action.category==='select'?'#20251B':'#04263A',stroke:action.color,sw:1.5});
  p.add('line',b.x+23,b.y+2,b.x+23,b.y+b.h-2,action.color,.6,{alpha:.5});
  p.add('t',String(n.ordinal).padStart(2,'0'),b.x-7,b.y+(b.h-25)/2,37,25,12,action.color,true,'center');
  const caption=identifierCaption(n.label,model.capabilityId).replace(/(\d)([a-z])/g,'$1 $2');
  const frame={x:b.x+24,y:b.y+1,w:b.w-23,h:b.h-2};
  const fitted=fitBlueprintText(caption,{width:frame.w,height:frame.h,fontSize:10.25,minFontSize:8});
  p.add('t',fitted.text,frame.x,frame.y,frame.w,frame.h,fitted.fontSize,C.white,false,'left',...(links[n.id]?[links[n.id]]:[]));
  if(issues.length)p.add('shape','ELLIPSE',b.x+b.w-5,b.y-3,6,6,{fill:issues.some(i=>i.severity==='error')?C.red:C.amber,stroke:C.bg,sw:.6});
  rendered.push({nodeId:n.id,sourceRef:n.ref,caption:caption,fontSize:fitted.fontSize,bounds:frame,action,issues:issues.map(i=>i.id)});
 }
 if(!projection.nodes.length)p.text('No execution operations retained',220,240,550,50,22,C.muted);
 const legends=[['Build / request',ACTION_COLORS.build],['Bind / credential',ACTION_COLORS.bind],['Observe / exchange',ACTION_COLORS.observe],['Select / normalize',ACTION_COLORS.select]];
 legends.forEach(([label,color],i)=>{const x=17+i*174;p.add('shape','RECTANGLE',x,471,12,12,{fill:'none',stroke:color,sw:1.2});p.text(label,x+15,466,163,24,10,color);});
 p.text('Arrows: declared order',720,466,230,24,10,C.blue,false,'right');
 p.text('Rows group declarations for readability. Canonical routing and monotonic proof remain unverified.',14,485,790,18,8.5,C.muted);
 p.text('Unobserved',835,485,112,18,8.5,C.muted,false,'right');
 p.blueprint.render={contractId:'event-sheet-layout.v1',rows:layout.rows,cells:rendered,routes:layout.routes.map(({id,from,to,points,routing})=>({id,from,to,points,routing}))};
 p.interpretation+=' Rows are layout groups, not declared stages. Action colors classify identifier prefixes only. All operation IDs and source edges are preserved.';
 return layout;
}
