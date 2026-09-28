import {C} from '../circuit-presentation/design.mjs';
import {fitBlueprintText} from '../circuit-presentation/text-fit.mjs';
const groups=(a,n)=>Array.from({length:Math.ceil(a.length/n)},(_,i)=>a.slice(i*n,(i+1)*n));

export function appendInspectionSlides({model,page}){
 const report=model.review.inspection;
 if(!report)return;
 const text=(p,value,x,y,w,h,size=13,color=C.white,bold=false)=>{
  const t=fitBlueprintText(String(value),{width:w,height:h,fontSize:size,minFontSize:9});
  p.text(t.text,x,y,w,h,t.fontSize,color,bold);
 };
 const p=page('Inspection coverage',report.status+' · DECLARATIONS AND BOUNDED CHECKS',[report.sourceRef],JSON.stringify(report,null,2));
 p.blueprint={role:'inspection-coverage',issueIds:[],checkIds:report.checks.map(c=>c.id)};
 const sum=report.summary;
 text(p,`${sum.read} / ${sum.readings} readings returned`,38,139,875,43,25,C.blue,true);
 text(p,`${sum.proved} PROVED rows · ${sum.counterexamples} counterexamples · ${sum.other} other / coverage rows`,38,194,875,42,19,C.amber,true);
 text(p,'PROVED retains the property and basis returned by the reading. Counts include overlapping checks; they are not independent guarantees.',38,249,875,69,18);
 text(p,`${sum.unlocated} findings lack a resolved component address. ${sum.receipts} retained receipts. Repair mappings do not establish successful execution or closure.`,38,335,875,70,18);
 text(p,report.executionBasis,38,430,875,48,13,C.muted);
 const entries=[...report.checks.map(c=>({id:c.id,title:(c.property??c.reading)+(c.subject?' · '+c.subject:''),state:c.disposition,basis:c.basis,refs:[c.sourceRef],raw:c})),
  ...model.review.issues.map(f=>({id:f.id,title:f.code,state:f.severity.toUpperCase()+' · '+f.addressStatus,basis:f.message,
   tail:'Repair: '+f.repair.status+(f.repair.requiredParameters?.length?' · required: '+f.repair.requiredParameters.join(', '):''),refs:f.sourceRefs,raw:f}))];
 for(const group of groups(entries,3)){
  const detail=page('Inspection evidence','SOURCE RESULTS · PROPERTY SCOPE · REPAIR READINESS',group.flatMap(r=>r.refs),JSON.stringify(group.map(g=>g.raw),null,2));
  detail.blueprint={role:'inspection-evidence',issueIds:group.filter(g=>g.id.startsWith('R')).map(g=>g.id),checkIds:group.filter(g=>g.id.startsWith('V')).map(g=>g.id),
   operationIds:[...new Set(group.flatMap(g=>g.raw.resolvedNodeIds??g.raw.nodeIds??[]).filter(id=>model.nodes.some(n=>n.id===id&&n.kind==='operation')))]};
  group.forEach((g,i)=>{const y=132+i*114,ink=/ERROR|COUNTEREXAMPLE/.test(g.state)?C.red:C.amber;
   text(detail,g.id+' · '+g.title,36,y,886,27,15,C.blue,true);
   text(detail,g.state,36,y+28,886,23,12,ink,true);
   text(detail,g.basis,36,y+51,886,39,13);
   if(g.tail)text(detail,g.tail,36,y+90,886,22,10,C.muted);
  });
  detail.add('t','Inspection coverage',36,493,300,25,12,C.blue,true,'left',{slideIndex:Number(p.id.slice(6))-1});
 }
}
