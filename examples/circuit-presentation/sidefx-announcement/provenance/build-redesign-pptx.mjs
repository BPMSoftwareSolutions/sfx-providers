import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
import {ROOT,B,C,sourceDeck} from './redesign-lib.mjs';
import {buildOpening} from './redesign-opening.mjs';
import {buildMiddle} from './redesign-middle.mjs';
import {buildAppendix} from './redesign-appendix.mjs';
const scale=4/3;
const ppt=Presentation.create({slideSize:{width:1280,height:720}});
const slides=[...await buildOpening(),...await buildMiddle(),...await buildAppendix()].sort((a,b)=>a.n-b.n);
const hex=rgb=>'#'+['red','green','blue'].map(k=>Math.round((rgb?.[k]??0)*255).toString(16).padStart(2,'0')).join('');
const fill=p=>!p||p.propertyState==='NOT_RENDERED'?'none':hex(p.solidFill?.color?.rgbColor)+(p.solidFill?.alpha<1?'/'+Math.round(p.solidFill.alpha*100):'');
const geom={RECTANGLE:'rect',ROUND_RECTANGLE:'roundRect',ELLIPSE:'ellipse',DIAMOND:'diamond',HEXAGON:'hexagon',TEXT_BOX:'textbox'};
for(const design of slides){
 await design.save();const s=ppt.slides.add();s.background.fill=C.bg;
 const objects=[];const map=new Map();
 for(const req of design.req){
  if(req.createShape||req.createLine){const v=req.createShape??req.createLine;const o={...v,kind:req.createShape?'shape':'line'};objects.push(o);map.set(v.objectId,o);}
  if(req.updateShapeProperties){const v=req.updateShapeProperties;map.get(v.objectId).props=v.shapeProperties;}
  if(req.insertText){const v=req.insertText;map.get(v.objectId).text=v.text;}
  if(req.updateTextStyle){const v=req.updateTextStyle;map.get(v.objectId).textStyle=v.style;}
  if(req.updateParagraphStyle){const v=req.updateParagraphStyle;map.get(v.objectId).para=v.style;}
  if(req.updateLineProperties){const v=req.updateLineProperties;map.get(v.objectId).lineProps=v.lineProperties;}
 }
 for(const o of objects){
  const ep=o.elementProperties;const t=ep.transform;const x=t.translateX*scale,y=t.translateY*scale,w=ep.size.width.magnitude*scale,h=ep.size.height.magnitude*scale;
  if(o.kind==='line'){
   const dx=w*t.scaleX,dy=h*t.scaleY;const minx=Math.min(x,x+dx),miny=Math.min(y,y+dy),ww=Math.max(Math.abs(dx),.01),hh=Math.max(Math.abs(dy),.01);const lp=o.lineProps;
   const color=fill(lp.lineFill);const linewidth=lp.weight.magnitude*scale;
   s.shapes.add({geometry:'custom',name:o.objectId,position:{left:minx,top:miny,width:ww,height:hh},fill:'none',line:{fill:color,width:linewidth,style:lp.dashStyle==='DASH'?'dashed':'solid'},customPaths:[{width:ww,height:hh,commands:[{moveTo:{x:x-minx,y:y-miny}},{lineTo:{x:x+dx-minx,y:y+dy-miny}}]}]});
   if(lp.endArrow==='FILL_ARROW'){
    const a=Math.atan2(dy,dx),len=6*scale,spread=3.1*scale;const ex=x+dx,ey=y+dy;
    const pts=[[ex,ey],[ex-len*Math.cos(a)+spread*Math.sin(a),ey-len*Math.sin(a)-spread*Math.cos(a)],[ex-len*Math.cos(a)-spread*Math.sin(a),ey-len*Math.sin(a)+spread*Math.cos(a)]];
    const xx=Math.min(...pts.map(p=>p[0])),yy=Math.min(...pts.map(p=>p[1])),aw=Math.max(...pts.map(p=>p[0]))-xx,ah=Math.max(...pts.map(p=>p[1]))-yy;
    s.shapes.add({geometry:'custom',name:o.objectId+'_arrow',position:{left:xx,top:yy,width:aw,height:ah},fill:color,line:{fill:'none',width:0},customPaths:[{width:aw,height:ah,commands:[{moveTo:{x:pts[0][0]-xx,y:pts[0][1]-yy}},{lineTo:{x:pts[1][0]-xx,y:pts[1][1]-yy}},{lineTo:{x:pts[2][0]-xx,y:pts[2][1]-yy}},{close:{}}]}]});
   }
  }else{
   const p=o.props??{};const outline=p.outline;
   const shape=s.shapes.add({geometry:geom[o.shapeType],name:o.objectId,position:{left:x,top:y,width:w,height:h},fill:fill(p.shapeBackgroundFill),line:{fill:!outline||outline.propertyState==='NOT_RENDERED'?'none':fill(outline.outlineFill),width:(outline?.weight?.magnitude??0)*scale},...(o.shapeType==='ROUND_RECTANGLE'?{borderRadius:8*scale}:{})});
   if(o.text){const st=o.textStyle;shape.text=o.text;shape.text.style={typeface:'Arial',fontSize:st.fontSize.magnitude*scale,bold:st.bold,color:hex(st.foregroundColor.opaqueColor.rgbColor),alignment:o.para.alignment==='CENTER'?'center':o.para.alignment==='END'?'right':'left',verticalAlignment:'top',autoFit:'none',wrap:'square',insets:{left:4*scale,right:4*scale,top:3*scale,bottom:0},lineSpacing:1.08};if(st.link)shape.text.get(o.text).link={uri:st.link.url,isExternal:true};}
  }
 }
 const notes=sourceDeck.slides[design.n-1].slideProperties.notesPage.pageElements.flatMap(e=>e.shape?.text?.textElements??[]).map(e=>e.textRun?.content??'').join('');
 s.speakerNotes.textFrame.setText(notes+'\n\nVISUALS\nEditable circuit schematics. Branches and bindings are semantic projections, not generated runtime graph exports. Source-specific and proposed diagrams are labeled on the slide.');
 console.log('Built '+design.n+' '+design.title);
}
const version=process.env.REDESIGN_VERSION??'v4';
const candidate=path.join(B,`candidate-redesign-${version}.pptx`);await(await PresentationFile.exportPptx(ppt)).save(candidate);
const dir=path.join(B,'redesign-native-renders');await fs.mkdir(dir,{recursive:true});
for(let i=0;i<ppt.slides.items.length;i++){const b=await ppt.export({slide:ppt.slides.items[i],format:'png',scale:1.25});await fs.writeFile(path.join(dir,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await b.arrayBuffer()));}
const SKILL='C:/Users/Sidney Jones/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
const {finalizePresentation}=await import(pathToFileURL(path.join(SKILL,'container_tools/artifact_tool_utils.mjs')).href);
const final=path.join(ROOT,'deliverables',`SideFX_Circuit_Architecture_${version}.pptx`);
await finalizePresentation({workspaceDir:ROOT,candidatePath:candidate,finalPath:final,pythonExecutable:'C:/Users/Sidney Jones/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:path.join(B,`validation-redesign-${version}.json`)});
console.log(JSON.stringify({final,candidate,renders:dir}));
