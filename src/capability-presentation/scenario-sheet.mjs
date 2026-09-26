import {C} from '../circuit-presentation/design.mjs';
import {fitBlueprintText} from '../circuit-presentation/text-fit.mjs';
import {projectBlueprint} from './projection.mjs';
import {identifierCaption} from './caption.mjs';
import {blueprintGrid,eventAction,eventComponent} from './event-sheet.mjs';
import {drawComponentGlyph,glyphAnchor,COMPONENT_STYLE} from './component-glyphs.mjs';

// Native drafting symbols describe visual roles only; they never add authority.
function documentIcon(p,x,y,color){
 p.add('shape','RECTANGLE',x,y,10,14,{fill:'none',stroke:color,sw:.9});
 p.add('line',x+2,y+5,x+8,y+5,color,.8);p.add('line',x+2,y+9,x+7,y+9,color,.8);
}
function outcomeIcon(p,x,y,color,classification){
 if(!['success','failure'].includes(classification)){documentIcon(p,x+2,y,color);return;}
 p.add('shape','ELLIPSE',x,y,15,15,{fill:'none',stroke:color,sw:1});
 if(classification==='failure'){p.add('line',x+4,y+4,x+11,y+11,color,1);p.add('line',x+4,y+11,x+11,y+4,color,1);}
 else{p.add('line',x+3,y+8,x+6,y+11,color,1.2);p.add('line',x+6,y+11,x+12,y+4,color,1.2);}
}

// Scenario semantics stay primary. Only provider-related operation declarations
// are disclosed inside When; the complete Event remains one linked sheet.
export function appendScenarioSheet({snapshot,model,page,slides,scenarioId=model.rootScenarioId}){
 const sc=model.scenarios.find(s=>s.id===scenarioId),semantic=projectBlueprint(model,{altitude:'scenario',scenarioId});
 const involvement=projectBlueprint(model).edges.filter(e=>e.kind==='scenario-provider'&&e.from==='scenario:'+scenarioId);
 const eventPage=slides.find(s=>s.blueprint?.altitude==='event'&&s.blueprint.scenarioId===scenarioId&&['projection','overview'].includes(s.blueprint.role));
 const meaningPage=slides.find(s=>s.blueprint?.altitude==='scenario'&&s.blueprint.scenarioId===scenarioId&&['projection','overview'].includes(s.blueprint.role));
 const p=page('Scenario circuit blueprint',model.capabilityId,[sc.ref,...involvement.flatMap(e=>e.sourceRefs)],JSON.stringify({scenario:sc,semantics:semantic,involvement},null,2));
 p.headerLayout='custom';
 p.blueprint={role:'scenario-blueprint',altitude:'scenario',scenarioId,nodes:semantic.nodes.map(n=>n.id),edges:semantic.edges.map(e=>e.id),providerReferences:involvement,disclosedOperationIds:[...new Set(involvement.flatMap(e=>e.via.map(v=>v.operationId)))]};
 p.interpretation='Input/Event/Outcome are scenario semantics. Provider wires retain exact binding or testimony references. Disclosed operations are a subset; the complete Event is linked. Their component shapes follow the same declared-binding rules as the complete execution circuit, with identifier-prefix action colors. Decorative contacts add no declared ports. No execution or monotonic proof is asserted.';
 const link=target=>({slideIndex:Number(target.id.slice(6))-1});
 const textFrames=[];
 const label=(value,x,y,w,h,size=12,color=C.white,bold=false,target)=>{
  const fitted=fitBlueprintText(value,{width:w,height:h,fontSize:size,minFontSize:8});
  p.add('t',fitted.text,x,y,w,h,fitted.fontSize,color,bold,'center',...(target?[link(target)]:[]));
  textFrames.push({x,y,w,h});
 };
 blueprintGrid(p);
 p.text(p.title,12,3,936,39,29,C.white,true);p.text(model.capabilityId,14,40,930,27,17,C.blue,true);
 p.add('shape','RECTANGLE',8,77,944,380,{fill:'none',stroke:C.blue,sw:1.2});
 p.add('shape','RECTANGLE',9,78,942,25,{fill:'#05243B'});p.text('Capability boundary',16,77,550,26,13,C.blue,true);
 [['Input',C.amber],['Execution',C.blue],['Provider',C.violet],['Outcome',C.green],['Observation','#72D7EE']].forEach(([name,color],i)=>{
  const x=440+i*100;p.add('shape','RECTANGLE',x,86,8,8,{fill:'none',stroke:color,sw:.8});p.text(name,x+9,79,89,23,8.5,color);
 });
 const sections=[['GIVEN / INPUT',14,146,C.amber],['WHEN / EVENT',172,616,C.blue],['THEN / OUTCOME',800,146,C.green]];
 for(const [title,x,w,color]of sections){p.add('shape','RECTANGLE',x,198,w,249,{fill:'#031B2F',stroke:color,sw:1});p.text(title,x+3,199,w-6,25,12,color,true);}
 const event={x:347,y:330,w:266,h:62};
 p.add('route',[[160,361],[event.x,361]],C.amber,{arrow:true,glow:false,width:1.5,routing:'forward'});
 p.add('route',[[event.x+event.w,361],[800,361]],C.green,{arrow:true,glow:false,width:1.5,routing:'forward'});
 label(sc.inputId.replaceAll('-',' '),18,228,138,50,13,C.amber,true);
 const input=snapshot.contracts.find(c=>c.id===sc.inputContractId);
 const fields=(input?.fields??[]).filter(f=>/^\$\/payload\/[^/]+$/.test(f.path));
 const inputLabels=fields.length?fields.map(f=>f.path.replace('$/','').replaceAll('/','.')):[sc.inputContractId||'No input contract retained'];
 const itemH=Math.min(49,148/Math.max(1,inputLabels.length));
 inputLabels.forEach((value,i)=>{const y=284+i*itemH;p.add('shape','ROUND_RECTANGLE',23,y,128,itemH-6,{fill:'#18291E',stroke:C.amber,sw:1.1});documentIcon(p,31,y+(itemH-20)/2,C.amber);label(value,44,y+2,106,itemH-9,10.5,C.amber);});
 label(sc.outcomeId.replaceAll('-',' '),804,228,138,49,12,C.green,true);
 const outcomes=sc.variants.length?sc.variants:[{id:sc.outcomeContractId||sc.outcomeId,classification:''}];
 const outcomeH=Math.min(51,160/outcomes.length);
 outcomes.forEach((v,i)=>{const y=280+i*outcomeH,color=v.classification==='failure'?C.red:C.green;
  p.add('shape','ROUND_RECTANGLE',808,y,130,outcomeH-5,{fill:'#04252B',stroke:color,sw:.9});
  outcomeIcon(p,815,y+(outcomeH-20)/2,color,v.classification);
  label(v.id.replaceAll('_',' ').toLowerCase(),830,y+1,107,outcomeH-7,9.5,color);
 });
 const count=involvement.length,colW=600/Math.max(1,count),providerWidth=colW-14;
 const ports=[];
 for(const [i,edge]of involvement.entries()){
  const x=180+i*colW,provider=model.nodes.find(n=>n.id===edge.to),inspection=slides.find(s=>s.blueprint?.role==='provider-inspection'&&s.blueprint.providerId===provider.id);
  const box={x,y:115,w:providerWidth,h:66};
  drawComponentGlyph(p,provider,box,C.violet,{fill:'#101A35'});
  p.text('PROVIDER',x,117,providerWidth,21,10,C.violet,true,'center');label(provider.label,x,138,providerWidth,40,10,C.white,true,inspection);
  const uses=edge.via,portH=Math.min(27,90/Math.max(1,uses.length));
  uses.forEach((use,j)=>{
   const op=model.nodes.find(n=>n.id===use.operationId),y=227+j*(portH+3),w=providerWidth-20;
   const target=slides.find(s=>s.blueprint?.role==='provider-detail'&&s.blueprint.operationIds.includes(op.id));
   const opBox={x,y,w,h:portH},isTestimony=use.basis!=='declared provider';
   const component=eventComponent(model,op),action=eventAction(op),anchor=glyphAnchor(op,opBox,'right',COMPONENT_STYLE,component.glyph);
   // Lanes outside the operation boxes prevent a later port's wire crossing an
   // earlier operation. Each edge retains its exact source operation and binding.
   const lane=x+w+3+(j+1)*14/(uses.length+1);
   p.add('route',[anchor,[lane,anchor[1]],[lane,181]],C.violet,{arrow:false,dash:isTestimony,glow:false,width:1,routing:'orthogonal'});
   p.add('port',lane,181,C.violet,2);p.add('port',...anchor,C.violet,2);
   const frames=drawComponentGlyph(p,op,opBox,action.color,{glyphName:component.glyph,scale:.75,fill:action.category==='bind'?'#17132F':action.category==='select'?'#20251B':'#04263A'});
   const words=identifierCaption(op.label,model.capabilityId).split(' ');
   const caption=[...new Set([words[0],words.at(-1)])].join(' ');
   p.text(String(op.ordinal).padStart(2,'0'),frames.heading.x-8,y+(portH-21)/2,frames.heading.w+16,21,8,action.color,true,'center');
   label(caption,frames.label.x,frames.label.y,frames.label.w,frames.label.h,9,C.white,false,target);
   ports.push({operationId:op.id,portId:use.portId,bindingId:use.bindingId,providerId:provider.id,basis:use.basis,sourceEdgeIds:use.sourceEdgeIds,bounds:opBox,anchor,component,action});
  });
 }
 if(!count)p.text('No declared external provider references',215,250,530,45,16,C.muted,false,'center');
 drawComponentGlyph(p,semantic.nodes.find(n=>n.kind==='event'),event,C.blue,{fill:'#082C47'});
 label(sc.eventId?sc.eventId.replaceAll('-',' '):sc.authorityId,event.x,event.y+2,event.w,38,13,C.white,true,eventPage);
 label(sc.operationIds.length+' declared operations · open complete circuit',event.x,event.y+36,event.w,25,10,C.blue,false,eventPage);
 p.text('Provider operation references',180,314,602,16,8,C.muted,false,'center');
 const unassigned=model.review.issues.filter(i=>i.code==='ENDPOINT_BINDING_WITHOUT_PROVIDER_ID').flatMap(i=>i.nodeIds).filter(id=>sc.operationIds.includes(id));
 const ordinals=[...new Set(unassigned)].map(id=>model.nodes.find(n=>n.id===id).ordinal);
 const inspectionText=ordinals.length?'Provider identity missing on exchange operations '+ordinals.map(v=>String(v).padStart(2,'0')).join(', '):'Provider references preserve operation and binding ownership';
 label(inspectionText,177,398,606,30,10,ordinals.length?C.amber:C.muted);
 p.text('Solid violet: binding identity. Dashed violet: testimony declaration.',180,428,605,18,8,C.muted,false,'center');
 p.add('shape','RECTANGLE',8,464,944,35,{fill:'#05243B',stroke:'#72D7EE',sw:.9});
 p.text('Observation / Telemetry',14,463,208,23,11,'#72D7EE',true);
 p.text('State overlays preserve the circuit',14,481,208,17,8,C.muted);
 for(const [title,value,x]of [['Invocation','None selected',235],['Circuit state','Unobserved',480]]){
  p.add('shape','ROUND_RECTANGLE',x,469,230,25,{fill:'#031B2F',stroke:'#72D7EE',sw:.8});
  documentIcon(p,x+9,475,'#72D7EE');p.text(title,x+23,469,97,23,9,'#72D7EE',true);p.text(value,x+116,469,111,23,9,C.muted);
 }
 p.text('No live execution testimony attached',723,465,225,32,9,C.muted);
 if(eventPage)p.add('t','Complete execution circuit',14,501,310,22,12,C.blue,true,'left',link(eventPage));
 if(meaningPage)p.add('t','Scenario meaning',370,501,210,22,12,C.blue,true,'left',link(meaningPage));
 const review=slides.find(s=>s.blueprint?.role==='review');if(review)p.add('t','Review · '+model.review.errors+' errors / '+model.review.warnings+' warnings',630,501,310,22,12,C.amber,true,'left',link(review));
 p.blueprint.providerPorts=ports;p.blueprint.inputFieldPaths=fields.map(f=>f.path);p.blueprint.textFrames=textFrames;
 if(eventPage){const nav=eventPage.commands.find(c=>c.op==='t'&&c.args[0]==='Scenario');if(nav){nav.args[0]='Scenario blueprint';nav.args[4]=24;nav.args[3]=200;nav.args[9]=link(p);}}
 return p;
}
