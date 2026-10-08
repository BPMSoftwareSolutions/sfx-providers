import {C} from '../circuit-presentation/design.mjs';
import {fitBlueprintText} from '../circuit-presentation/text-fit.mjs';
import {projectBlueprint} from './projection.mjs';
import {identifierCaption} from './caption.mjs';
import {blueprintGrid,eventAction,eventComponent} from './event-sheet.mjs';
import {drawComponentGlyph,glyphAnchor,COMPONENT_STYLE} from './component-glyphs.mjs';
import {scenarioInspection} from './inspection-evidence.mjs';

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

// Scenario semantics stay primary. Provider-related and flagged operation
// declarations are disclosed inside When; the complete Event is linked.
export function appendScenarioSheet(options){
 const scenarioId=options.scenarioId??options.model.rootScenarioId;
 const operations=options.model.scenarios.find(s=>s.id===scenarioId).operationIds;
 const pages=Math.max(1,Math.ceil(operations.length/7));
 let first;
 for(let index=0;index<pages;index++){
  const result=appendScenarioPage({...options,scenarioId,operationIds:operations.slice(index*7,index*7+7),pageIndex:index,pageCount:pages,totalOperations:operations.length});
  first??=result;
 }
 return first;
}
function appendScenarioPage({snapshot,model,page,slides,scenarioId,operationIds,pageIndex,pageCount,totalOperations}){
 const sc={...model.scenarios.find(s=>s.id===scenarioId),operationIds},semantic=projectBlueprint(model,{altitude:'scenario',scenarioId});
 const involvement=projectBlueprint(model).edges.filter(e=>e.kind==='scenario-provider'&&e.from==='scenario:'+scenarioId)
  .map(e=>({...e,via:e.via.filter(use=>operationIds.includes(use.operationId))})).filter(e=>e.via.length);
 const inspectionScope=scenarioInspection(model,sc.id);
 const scopeIssues=inspectionScope.issues;
 // Bug classification and wording are declared inspection evidence. This is a
 // historical report overlay, never a synthetic execution state or detector.
 const bugIssues=scopeIssues.filter(i=>i.evidence?.classification==='bug');
 // Address resolution already carries each binding's exact owning operations.
 // Walking incoming edges of a resolved operation would incorrectly flag its
 // predecessor in the sequence instead of the operation named by the report.
 const bindingIssues=scopeIssues.filter(i=>i.resolvedNodeIds.some(id=>sc.operationIds.includes(id)||id.startsWith('binding:'))).map(i=>({...i,nodeIds:[...new Set([...i.nodeIds,...i.resolvedNodeIds])]}));
 const outcomeIssues=scopeIssues.filter(i=>i.resolvedNodeIds.includes('outcome:'+sc.id));
 const inputIssues=scopeIssues.filter(i=>i.resolvedNodeIds.includes('input:'+sc.id));
 // Only selector findings support gate/request-path captions. A declared bug
 // may mention invocation while proving a different property entirely.
 const invocationIssues=bindingIssues.filter(i=>['INVOCATION_CONDITION_PATH_ABSENT','INVOCATION_REQUEST_PATH_ABSENT','NESTED_INVOCATION_REQUEST_PATH_ABSENT','NESTED_INVOCATION_INPUT_UNVERIFIED'].includes(i.code));
 const inspectionColor=scopeIssues.some(i=>i.severity==='error')?C.red:C.amber;
 const affected=[...new Set(bindingIssues.flatMap(i=>i.nodeIds).filter(id=>sc.operationIds.includes(id)))];
 const providerOperations=[...new Set(involvement.flatMap(e=>e.via.map(v=>v.operationId)))];
 const unassigned=affected.filter(id=>!providerOperations.includes(id));
 const eventPage=slides.find(s=>s.blueprint?.altitude==='event'&&s.blueprint.scenarioId===scenarioId&&['projection','overview'].includes(s.blueprint.role));
 const meaningPage=slides.find(s=>s.blueprint?.altitude==='scenario'&&s.blueprint.scenarioId===scenarioId&&['projection','overview'].includes(s.blueprint.role));
 const p=page('Scenario circuit blueprint',model.capabilityId+(pageCount>1?' · page '+(pageIndex+1)+'/'+pageCount:''),[sc.ref,...involvement.flatMap(e=>e.sourceRefs),...scopeIssues.flatMap(i=>i.sourceRefs)],JSON.stringify({scenario:sc,semantics:semantic,involvement,issues:scopeIssues},null,2));
 p.headerLayout='custom';
 p.blueprint={role:'scenario-blueprint',altitude:'scenario',scenarioId,nodes:semantic.nodes.map(n=>n.id),edges:semantic.edges.map(e=>e.id),providerReferences:involvement,disclosedOperationIds:[...new Set([...providerOperations,...unassigned.slice(0,3)])],diagnosticOperationReferences:[]};
 p.blueprint.scenarioIssueIds=scopeIssues.map(i=>i.id);p.blueprint.outcomeIssueIds=outcomeIssues.map(i=>i.id);
 p.blueprint.pageIndex=pageIndex;p.blueprint.pageCount=pageCount;p.blueprint.totalOperations=totalOperations;
 p.blueprint.inputIssueIds=inputIssues.map(i=>i.id);p.blueprint.globalIssueIds=inspectionScope.globalIssues.map(i=>i.id);
 p.blueprint.bugIssueIds=bugIssues.map(i=>i.id);
 p.blueprint.inspection={status:model.review.inspection.status,checkIds:inspectionScope.checks.map(c=>c.id),unlocatedIssueIds:model.review.inspection.unlocatedIssueIds};
 p.interpretation='Input/Event/Outcome are scenario semantics. Provider wires retain exact binding or testimony references. Disclosed operations are a subset; the complete Event is linked. Binding findings expose affected declared operations with amber inspection overlays, without adding provider nodes or edges. Their component shapes follow the same declared-binding rules as the complete execution circuit. Decorative contacts add no declared ports. No installation, execution or monotonic proof is asserted.';
 const link=target=>({slideIndex:Number(target.id.slice(6))-1});
 const textFrames=[];
 const label=(value,x,y,w,h,size=12,color=C.white,bold=false,target,minFontSize=8,shorten=false)=>{
  let fitted;
  try{fitted=fitBlueprintText(value,{width:w,height:h,fontSize:size,minFontSize});}
  catch(error){if(error.code!=='CAPABILITY_BLUEPRINT_TEXT_OVERFLOW'||!shorten)throw error;
   // A bounded semantic list may shorten an oversized identity with a visible
   // ellipsis; the exact identity remains in the sidecars and outcome slides.
   const full=String(value);let done=false;
   for(let i=1;i<full.length&&!done;i++){try{fitted=fitBlueprintText('…'+full.slice(i),{width:w,height:h,fontSize:size,minFontSize});done=true;}catch(next){if(next.code!=='CAPABILITY_BLUEPRINT_TEXT_OVERFLOW')throw next;}}
   if(!done)throw error;
  }
  p.add('t',fitted.text,x,y,w,h,fitted.fontSize,color,bold,'center',...(target?[link(target)]:[]));
  textFrames.push({x,y,w,h});
 };
 blueprintGrid(p);
 p.text(p.title,12,3,936,39,29,C.white,true);p.text(p.subtitle,14,40,930,27,17,C.blue,true);
 p.add('shape','RECTANGLE',8,77,944,387,{fill:'none',stroke:C.blue,sw:1.2});
 p.add('shape','RECTANGLE',9,78,942,25,{fill:'#05243B'});p.text('Capability boundary',16,77,550,26,13,C.blue,true);
 [['Input',C.amber],['Execution',C.blue],['Provider',C.violet],['Outcome',C.green],['Observation','#72D7EE']].forEach(([name,color],i)=>{
  const x=440+i*100;p.add('shape','RECTANGLE',x,86,8,8,{fill:'none',stroke:color,sw:.8});p.text(name,x+9,79,89,23,8.5,color);
 });
 const sections=[['GIVEN / INPUT',14,146,C.amber],['WHEN / EVENT',172,616,C.blue],['THEN / OUTCOME',800,146,C.green]];
 for(const [title,x,w,color]of sections){p.add('shape','RECTANGLE',x,198,w,249,{fill:'#031B2F',stroke:color,sw:1});p.text(title,x+3,199,w-6,25,12,color,true);}
 if(inputIssues.length){
  p.add('shape','RECTANGLE',14,198,146,249,{fill:'none',stroke:inputIssues.some(i=>i.severity==='error')?C.red:C.amber,sw:1.7});
  label(inputIssues.map(i=>i.id).join(', ')+' · input inspection',14,177,146,19,9,C.amber,true,slides.find(s=>s.blueprint?.role==='inspection-evidence'&&s.blueprint.issueIds.some(id=>inputIssues.some(i=>i.id===id))));
 }
 if(outcomeIssues.length){
  p.add('shape','RECTANGLE',800,198,146,249,{fill:'none',stroke:outcomeIssues.some(i=>i.severity==='error')?C.red:C.amber,sw:1.7});
  const target=slides.find(s=>['boundary-inspection','inspection-evidence'].includes(s.blueprint?.role)&&s.blueprint.issueIds.some(id=>outcomeIssues.some(i=>i.id===id)));
  label(outcomeIssues.map(i=>i.id).join(', ')+' · display inspection',800,177,146,19,9,C.red,true,target);
 }
 // Every page retains up to seven actual operations. The complete-event
 // drill-down remains available across all pages of the same scenario.
 const inline=sc.operationIds.length>0&&sc.operationIds.length<=7;
 const inlineCells=new Map();
 if(inline){const gap=10,w=(580-gap*(sc.operationIds.length-1))/sc.operationIds.length;
  sc.operationIds.forEach((id,i)=>inlineCells.set(id,{x:190+i*(w+gap),y:352,w,h:34}));}
 const event=inline?{x:180,y:330,w:600,h:63}:{x:347,y:330,w:266,h:62};
 const firstCell=inlineCells.get(sc.operationIds[0]),lastCell=inlineCells.get(sc.operationIds.at(-1));
 const flowY=inline?firstCell.y+firstCell.h/2:361;
 p.add('route',[[160,flowY],[inline?firstCell.x:event.x,flowY]],C.amber,{arrow:true,glow:false,width:1.5,routing:'forward'});
 p.add('route',[[inline?lastCell.x+lastCell.w:event.x+event.w,flowY],[800,flowY]],C.green,{arrow:true,glow:false,width:1.5,routing:'forward'});
 label(sc.inputId.replaceAll('-',' '),18,228,138,50,13,C.amber,true);
 const input=snapshot.contracts.find(c=>c.id===sc.inputContractId);
 const inputProvider=input?.inputProvider;
 if(inputProvider){
  label('INPUT PROVIDER · '+(snapshot.providerLabels?.[inputProvider.providerId]??inputProvider.providerId),23,273,128,34,9,C.violet,true);
  label(inputProvider.location,23,305,128,20,7,C.muted,false,undefined,6);
  p.blueprint.inputProvider={...inputProvider,sourceRef:input.sourceRef};
 }
 const fields=(input?.fields??[]).filter(f=>/^\$\/payload\/[^/]+$/.test(f.path));
 const inputLabels=fields.length?fields.map(f=>f.path.replace('$/','').replaceAll('/','.')):[sc.inputContractId||'No input contract retained'];
 const inputTop=inputProvider?326:284,availableInputHeight=432-inputTop;
 const itemH=Math.min(49,(availableInputHeight-20)/Math.max(1,inputLabels.length));
 p.add('shape','ROUND_RECTANGLE',23,inputTop,128,availableInputHeight,{fill:'#18291E',stroke:C.amber,sw:1.1});
 label('One payload',27,inputTop+2,120,20,8,C.amber,true,undefined,6);
 inputLabels.forEach((value,i)=>{const y=inputTop+20+i*itemH;documentIcon(p,31,y+(itemH-20)/2,C.amber);label(value,44,y+2,102,itemH-9,10.5,C.amber,false,undefined,4,true);});
 label(sc.outcomeId.replaceAll('-',' '),804,228,138,49,12,C.green,true);
 const outcomes=sc.variants.length?sc.variants:[{id:sc.outcomeContractId||sc.outcomeId,classification:''}];
 // The outcome panel is bounded. It keeps as many exact declared variants as
 // fit (shortened only when a single line is impossible) and names the retained
 // remainder; every ID stays in the detail, notes and outcome slides.
 const outcomeRows=Math.min(outcomes.length,Math.max(1,Math.floor(160/24.2))),outcomeSummary=outcomes.length-outcomeRows,outcomeSlots=outcomeSummary>0?outcomeRows-1:outcomeRows,outcomeH=Math.min(51,160/outcomeRows);
 outcomes.slice(0,outcomeSlots).forEach((v,i)=>{const y=280+i*outcomeH,color=v.classification==='failure'?C.red:C.green;
  p.add('shape','ROUND_RECTANGLE',808,y,130,outcomeH-5,{fill:'#04252B',stroke:color,sw:.9});
  outcomeIcon(p,815,y+(outcomeH-20)/2,color,v.classification);
  label(v.id.replaceAll('_',' ').toLowerCase(),830,y+1,107,outcomeH-7,9.5,color,false,undefined,8,true);
 });
 if(outcomeSummary){const y=280+outcomeSlots*outcomeH;
  p.add('shape','ROUND_RECTANGLE',808,y,130,outcomeH-5,{fill:'#04252B',stroke:C.muted,sw:.9});
  label('+ '+outcomeSummary+' more variants',830,y+1,107,outcomeH-7,9,C.muted,false,undefined,8,true);
 }
 const count=involvement.length,colW=600/Math.max(1,count+(unassigned.length?1:0)),providerWidth=colW-14;
 const ports=[],eventNode=semantic.nodes.find(n=>n.kind==='event');
 const callStyle=COMPONENT_STYLE.scenario.providerCalls;
 // Each provider is centered above its calls, ordered within that group by
 // scenario operation. The execution row retains the scenario's full order.
 const allCalls=involvement.flatMap(edge=>edge.via.map(use=>({edge,use})))
  .sort((a,b)=>sc.operationIds.indexOf(a.use.operationId)-sc.operationIds.indexOf(b.use.operationId)||a.edge.to.localeCompare(b.edge.to));
 const shownCalls=allCalls.slice(0,callStyle.maxVisible);
 const availableWidth=600-(unassigned.length?colW:0);
 const callGap=Math.min(callStyle.gap,availableWidth/(Math.max(1,shownCalls.length)*6));
 const callWidth=Math.min(callStyle.width,(availableWidth-callGap*(shownCalls.length-1))/Math.max(1,shownCalls.length));
 const callSpan=shownCalls.length*callWidth+Math.max(0,shownCalls.length-1)*callGap;
 const callLeft=180+(availableWidth-callSpan)/2;
 p.blueprint.disclosedOperationIds=[...new Set([...shownCalls.map(c=>c.use.operationId),...unassigned.slice(0,3)])];
 p.blueprint.providerCallLayout={order:'provider-group-then-scenario-operation-order',total:allCalls.length,shown:shownCalls.length};
 for(const [i,edge]of involvement.entries()){
  const x=180+i*colW,provider=model.nodes.find(n=>n.id===edge.to),inspection=slides.find(s=>s.blueprint?.role==='provider-inspection'&&s.blueprint.providerId===provider.id);
  const box={x,y:115,w:providerWidth,h:66};
  drawComponentGlyph(p,provider,box,C.violet,{fill:'#101A35'});
  p.text('PROVIDER',x,117,providerWidth,21,10,C.violet,true,'center');label(provider.label,x,138,providerWidth,40,10,C.white,true,inspection);
  const uses=edge.via.filter(use=>shownCalls.some(call=>call.edge===edge&&call.use===use)),portH=callStyle.height;
  uses.forEach((use,j)=>{
   const callIndex=shownCalls.findIndex(call=>call.edge===edge&&call.use===use);
   const op=model.nodes.find(n=>n.id===use.operationId),y=callStyle.top;
   const w=Math.min(callStyle.width,(providerWidth-callGap*(uses.length-1))/uses.length);
   const callX=x+(j+.5)*providerWidth/uses.length-w/2;
   const issues=bindingIssues.filter(i=>i.nodeIds.includes(op.id)),ink=issues.some(i=>i.severity==='error')?C.red:undefined;
   const target=slides.find(s=>s.blueprint?.role==='boundary-inspection'&&s.blueprint.operationIds.includes(op.id))??slides.find(s=>s.blueprint?.role==='invocation-inspection'&&s.blueprint.operationIds.includes(op.id))??slides.find(s=>s.blueprint?.role==='inspection-evidence'&&s.blueprint.issueIds.some(id=>issues.some(i=>i.id===id)))??slides.find(s=>s.blueprint?.role==='provider-detail'&&s.blueprint.operationIds.includes(op.id));
   const opBox={x:callX,y,w,h:portH},isTestimony=use.basis!=='declared provider';
   const component=eventComponent(model,op),action=eventAction(op),anchor=glyphAnchor(op,opBox,'top',COMPONENT_STYLE,component.glyph);
   const providerX=anchor[0];
   const providerRoute=[anchor,[providerX,box.y+box.h]];
   p.add('route',providerRoute,C.violet,{arrow:false,dash:isTestimony,glow:false,width:1,routing:'orthogonal'});
   p.add('port',providerX,181,C.violet,2);p.add('port',...anchor,C.violet,2);
   const callAnchor=glyphAnchor(op,opBox,'bottom',COMPONENT_STYLE,component.glyph);
   const centersFit=callLeft+callWidth/2>=event.x+12&&callLeft+callSpan-callWidth/2<=event.x+event.w-12;
   const ownedCell=inlineCells.get(op.id);
   const eventAnchor=ownedCell?[Math.round((ownedCell.x+ownedCell.w/2)*1000)/1000,ownedCell.y]:[centersFit?callAnchor[0]:event.x+(callIndex+1)*event.w/(shownCalls.length+1),event.y];
   const eventRoute=eventAnchor[0]===callAnchor[0]?[eventAnchor,callAnchor]:
    [eventAnchor,[eventAnchor[0],290+callIndex*4],[callAnchor[0],290+callIndex*4],callAnchor];
   p.add('route',eventRoute,C.violet,{arrow:false,glow:false,width:1,routing:'orthogonal'});
   p.add('port',...eventAnchor,C.violet,2);p.add('port',...callAnchor,C.violet,2);
   const frames=drawComponentGlyph(p,op,opBox,ink??action.color,{glyphName:component.glyph,scale:.75,fill:action.category==='bind'?'#17132F':action.category==='select'?'#20251B':'#04263A'});
   const words=identifierCaption(op.label,model.capabilityId).split(' ');
   const caption=[...new Set([words[0],words.at(-1)])].join(' ');
   p.text(String(op.ordinal).padStart(2,'0'),frames.heading.x-8,y+(portH-21)/2,frames.heading.w+16,21,8,action.color,true,'center');
   label(caption,frames.label.x,frames.label.y,frames.label.w,frames.label.h,9,C.white,false,target,6);
   if(issues.length){p.add('port',callX+w-3,y+3,ink??C.amber,3);p.blueprint.diagnosticOperationReferences.push({operationId:op.id,issueIds:issues.map(i=>i.id),bounds:opBox});}
   ports.push({operationId:op.id,portId:use.portId,bindingId:use.bindingId,providerId:provider.id,basis:use.basis,sourceEdgeIds:use.sourceEdgeIds,bounds:opBox,anchor,component,action,
    eventId:eventNode.id,eventAnchor,callAnchor,eventRoute,providerRoute});
  });
 }
 if(unassigned.length){
  const x=180+count*colW,w=providerWidth;
  // This is an inspection overlay above real operation references, not a
  // provider node. No connection is invented for the missing association.
  const missingAssociation=bindingIssues.some(i=>['PLATFORM_BINDING_WITHOUT_PROVIDER','ENDPOINT_BINDING_WITHOUT_PROVIDER_ID'].includes(i.code)&&i.nodeIds.some(id=>unassigned.includes(id)));
  label(missingAssociation?'BINDING INSPECTION':'OPERATION INSPECTION',x,115,w,22,11,inspectionColor,true);
  label(missingAssociation?'No provider association retained':'Declared operation has findings',x,137,w,25,11,inspectionColor,true);
  label(missingAssociation?'Installation and compatibility unverified':'Open inspection for source evidence',x,164,w,28,9,C.muted);
  unassigned.slice(0,3).forEach((id,j)=>{
   const op=model.nodes.find(n=>n.id===id),issues=bindingIssues.filter(i=>i.nodeIds.includes(id));
   const target=slides.find(s=>s.blueprint?.role==='boundary-inspection'&&s.blueprint.operationIds.includes(id))??slides.find(s=>s.blueprint?.role==='inspection-evidence'&&s.blueprint.issueIds.some(at=>issues.some(i=>i.id===at)))??slides.find(s=>s.blueprint?.role==='provider-detail'&&s.blueprint.operationIds.includes(id));
   const box={x,y:227+j*30,w:w-20,h:27},component=eventComponent(model,op);
   const frames=drawComponentGlyph(p,op,box,issues.some(i=>i.severity==='error')?C.red:C.amber,{glyphName:component.glyph,scale:.75,fill:'#282315'});
   p.text(String(op.ordinal).padStart(2,'0'),frames.heading.x-8,box.y+3,frames.heading.w+16,21,8,C.amber,true,'center');
   label(op.portId||op.label,frames.label.x,frames.label.y,frames.label.w,frames.label.h,9,C.white,false,target,6);
   p.add('port',box.x+box.w-3,box.y+3,C.amber,3);
   p.blueprint.diagnosticOperationReferences.push({operationId:id,issueIds:issues.map(i=>i.id),bounds:box});
  });
  if(unassigned.length>3)label('+'+(unassigned.length-3)+' more · review',x,314,w,16,7,C.amber,false,slides.find(s=>s.blueprint?.role==='review'),6);
 }
 if(!count&&!unassigned.length)p.text('No declared external provider references',215,250,530,45,16,C.muted,false,'center');
 if(inline){
  label(sc.eventId?sc.eventId.replaceAll('-',' '):sc.authorityId,180,304,600,25,13,C.blue,true,eventPage);
  p.add('shape','ROUND_RECTANGLE',event.x,event.y,event.w,event.h,{fill:'none',stroke:C.blue,sw:1});
  (p.blueprint.glyphs??=[]).push({nodeId:eventNode.id,kind:'event',glyph:'device',bounds:{...event},anchors:Object.fromEntries(['left','right','top','bottom'].map(side=>[side,glyphAnchor(eventNode,event,side)]))});
  label('Execution · operations '+(pageIndex*7+1)+'–'+(pageIndex*7+sc.operationIds.length)+' / '+totalOperations,184,331,590,20,8,C.blue,false,undefined,6);
  for(const id of sc.operationIds){const op=model.nodes.find(n=>n.id===id),box=inlineCells.get(id),component=eventComponent(model,op),action=eventAction(op);
   const frames=drawComponentGlyph(p,op,box,action.color,{glyphName:component.glyph,fill:'#04263A'});
   label(String(op.ordinal).padStart(2,'0'),frames.heading.x-8,frames.heading.y,frames.heading.w+16,frames.heading.h,8,C.blue,true,undefined,6);
   label(identifierCaption(op.label,model.capabilityId),frames.label.x,frames.label.y,frames.label.w,frames.label.h,9,C.white,false,eventPage,4);
  }
  for(const edge of model.edges.filter(e=>e.kind==='sequence'&&inlineCells.has(e.from)&&inlineCells.has(e.to))){
   const a=inlineCells.get(edge.from),b=inlineCells.get(edge.to);
   p.add('route',[[a.x+a.w,a.y+a.h/2],[b.x,b.y+b.h/2]],C.blue,{arrow:true,glow:false,width:1,routing:'forward'});
  }
  p.blueprint.inlineOperationIds=[...inlineCells.keys()];
 }else{
  drawComponentGlyph(p,eventNode,event,scopeIssues.length?inspectionColor:C.blue,{fill:'#082C47'});
  label(sc.eventId?sc.eventId.replaceAll('-',' '):sc.authorityId,event.x,event.y+2,event.w,38,13,C.white,true,eventPage);
  label(sc.operationIds.length+' declared operations · open complete circuit',event.x,event.y+36,event.w,25,10,C.blue,false,eventPage);
 }
 if(!unassigned.length)label(allCalls.length>shownCalls.length?`${shownCalls.length} of ${allCalls.length} provider calls · open complete circuit`:'Provider calls retain operation ownership',180,inline?284:310,602,20,8,C.muted,false,allCalls.length>shownCalls.length?eventPage:undefined,7);
 const ordinals=affected.map(id=>model.nodes.find(n=>n.id===id).ordinal);
 const issueLabel=scopeIssues.slice(0,3).map(i=>i.id).join(', ')+(scopeIssues.length>3?' +'+(scopeIssues.length-3):'');
 const operationLabel=ordinals.slice(0,6).map(v=>String(v).padStart(2,'0')).join(', ')+(ordinals.length>6?' +'+(ordinals.length-6):'');
 const inspectionText=snapshot.identity.readiness?.execution==='HELD'?'Execution HELD · '+snapshot.identity.readiness.reason:scopeIssues.length?(invocationIssues.length?'Invocation inspection ':'Circuit inspection ')+issueLabel+(ordinals.length?' · operations '+operationLabel:''):'Provider references preserve operation and binding ownership';
 label(inspectionText,177,398,606,invocationIssues.length||outcomeIssues.length?22:30,10,scopeIssues.length?inspectionColor:C.muted,false,scopeIssues.length?slides.find(s=>s.blueprint?.role==='review'):undefined);
 p.blueprint.bindingIssueIds=bindingIssues.map(i=>i.id);
 if(invocationIssues.length||outcomeIssues.length){
  const invocationNotes=[...invocationIssues].sort((a,b)=>Number(b.severity==='error')-Number(a.severity==='error')).map(i=>(i.code==='INVOCATION_CONDITION_PATH_ABSENT'?'Gate: ':i.code.startsWith('NESTED_')?'Nested request: ':'Request: ')+(i.evidence?.path??'unverified')+(i.severity==='error'?' absent':' unverified'));
  const outcomeNotes=outcomeIssues.map(i=>'Display: '+(i.evidence?.path??'outcome')+' can hide details');
  // Reserve a summary slot for each affected boundary before showing more of one class.
  const notes=[...invocationNotes.slice(0,1),...outcomeNotes.slice(0,1),...invocationNotes.slice(1),...outcomeNotes.slice(1)];
  const paths=notes.slice(0,2).join(' · ')+(notes.length>2?' · +'+(notes.length-2)+' findings':'');
  label(paths,177,420,606,26,9,inspectionColor,false,undefined,7);
 }else p.text('Solid violet: binding identity. Dashed violet: testimony declaration.',180,428,605,18,8,C.muted,false,'center');
 p.add('shape','RECTANGLE',8,464,944,35,{fill:'#05243B',stroke:'#72D7EE',sw:.9});
 p.text('Observation / Telemetry',14,463,208,23,11,'#72D7EE',true);
 if(bugIssues.length){
  const bug=bugIssues[0],presentation=bug.evidence.presentation??{};
  const target=slides.find(s=>s.blueprint?.role==='inspection-evidence'&&s.blueprint.issueIds.includes(bug.id));
  const ink=bugIssues.some(i=>i.severity==='error')?C.red:C.amber;
  p.text(bugIssues.length+' open report'+(bugIssues.length===1?'':'s')+' · execution unselected',14,481,208,17,8,C.muted);
  p.add('shape','RECTANGLE',225,465,722,33,{fill:'#031B2F',stroke:ink,sw:1});
  if(bugIssues.length===1){
   label(bug.id+' · '+(presentation.headline||bug.message),230,464,712,18,10,ink,true,target,8);
   label(presentation.detail||'Open inspection evidence; see report for scope and repair',230,481,712,17,9,C.white,false,target,7);
  }else{
   // Independent report links keep every short label visible at scenario
   // altitude. The full finding and repair remain on the evidence slide.
   const shown=bugIssues.slice(0,bugIssues.length>6?5:6);
   shown.forEach((issue,i)=>{
    const report=issue.evidence.presentation??{},destination=slides.find(s=>s.blueprint?.role==='inspection-evidence'&&s.blueprint.issueIds.includes(issue.id));
    label(issue.id+' · '+(report.short||report.headline||issue.code),230+(i%3)*238,464+Math.floor(i/3)*17,235,18,9,issue.severity==='error'?C.red:C.amber,true,destination,7);
   });
   if(bugIssues.length>6)label('+'+(bugIssues.length-5)+' reports · review',706,481,235,18,9,ink,true,slides.find(s=>s.blueprint?.role==='review'),7);
  }
 }else{
 p.text('State overlays preserve the circuit',14,481,208,17,8,C.muted);
 for(const [title,value,x]of [['Invocation','None selected',235],['Circuit state','Unobserved',480]]){
  p.add('shape','ROUND_RECTANGLE',x,469,230,25,{fill:'#031B2F',stroke:'#72D7EE',sw:.8});
  documentIcon(p,x+9,475,'#72D7EE');p.text(title,x+23,469,97,23,9,'#72D7EE',true);p.text(value,x+116,469,111,23,9,C.muted);
 }
 p.text('No live execution testimony attached',723,465,225,32,9,C.muted);
 }
 if(eventPage)p.add('t','Complete execution circuit',14,501,310,22,12,C.blue,true,'left',link(eventPage));
 const coveragePage=slides.find(s=>s.blueprint?.role==='inspection-coverage');
 const summary=model.review.inspection.summary;
 const status=model.review.inspection.status;
 const held=model.review.inspection.readings.filter(r=>r.status!=='READ').map(r=>r.reading);
 const heldLabel=held.length?' · Held: '+held.slice(0,2).join(', ')+(held.length>2?' +'+(held.length-2):''):'';
 const signal=status==='SNAPSHOT_MATCH'?`${summary.read}/${summary.readings} readings${heldLabel} · ${summary.other} coverage rows · ${inspectionScope.globalIssues.length} unlocated/global findings`:'Inspection '+status.toLowerCase()+' · refresh evidence';
 const coverageInk=status!=='SNAPSHOT_MATCH'||inspectionScope.globalIssues.some(i=>i.severity==='error')?C.red:C.amber;
 // A distinct overlay strip; no diagnostic becomes a circuit node or wire.
 p.add('shape','RECTANGLE',14,446,932,18,{fill:'#05243B',stroke:coverageInk,sw:.7});
 label(signal,18,446,924,18,8,coverageInk,true,coveragePage,7);
 if(coveragePage)p.add('t','Inspection evidence',370,501,210,22,12,C.blue,true,'left',link(coveragePage));
 else if(meaningPage)p.add('t','Scenario meaning',370,501,210,22,12,C.blue,true,'left',link(meaningPage));
 const review=slides.find(s=>s.blueprint?.role==='review');if(review)p.add('t','Review · '+model.review.errors+' errors / '+model.review.warnings+' warnings',630,501,310,22,12,C.amber,true,'left',link(review));
 p.blueprint.providerPorts=ports;p.blueprint.inputFieldPaths=fields.map(f=>f.path);p.blueprint.textFrames=textFrames;
 if(eventPage&&pageIndex===0){const nav=eventPage.commands.find(c=>c.op==='t'&&c.args[0]==='Scenario');if(nav){nav.args[0]='Scenario blueprint';nav.args[4]=24;nav.args[3]=200;nav.args[9]=link(p);}}
 return p;
}
