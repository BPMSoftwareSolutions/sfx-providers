import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {objectsFromRequests} from './render.mjs';
const hex=rgb=>'#'+['red','green','blue'].map(k=>Math.round((rgb?.[k]??0)*255).toString(16).padStart(2,'0')).join('');
const fill=p=>!p||p.propertyState==='NOT_RENDERED'?'none':hex(p.solidFill?.color?.rgbColor)+(p.solidFill?.alpha<1?'/'+Math.round(p.solidFill.alpha*100):'');
const geom={RECTANGLE:'rect',ROUND_RECTANGLE:'roundRect',ELLIPSE:'ellipse',DIAMOND:'diamond',HEXAGON:'hexagon',TEXT_BOX:'textbox'};

export async function exportPptx(candidate,outputPath,{artifactTool,renderDirectory}={}) {
 if(!artifactTool){
  const modulePath=process.env.CIRCUIT_ARTIFACT_MODULE;
  if(modulePath&&!path.isAbsolute(modulePath))throw new Error('CIRCUIT_ARTIFACT_MODULE must name an absolute local module file.');
  try{artifactTool=await import(modulePath?pathToFileURL(modulePath).href:'@oai/artifact-tool');}
  catch(error){throw new Error('PPTX export requires @oai/artifact-tool. Set CIRCUIT_ARTIFACT_MODULE to its installed dist/artifact_tool.mjs. JSON and SVG compilation need no dependencies.',{cause:error});}
 }
 try{await fs.access(outputPath);throw new Error('Refusing to overwrite an existing PPTX.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const {Presentation,PresentationFile}=artifactTool;
 const scale=4/3,ppt=Presentation.create({slideSize:{width:1280,height:720}});
 for(const design of candidate.slides){
  const s=ppt.slides.add();s.background.fill='#06111F';
  const objects=objectsFromRequests(design.requests);
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

  s.speakerNotes.textFrame.setText(design.notes);
 }
 await(await PresentationFile.exportPptx(ppt)).save(outputPath);
 if(renderDirectory){
  await fs.mkdir(renderDirectory,{recursive:true});
  for(const [i,slide]of ppt.slides.items.entries()){
   const blob=await ppt.export({slide,format:'png',scale:1});
   await fs.writeFile(path.join(renderDirectory,'slide-'+String(i+1).padStart(2,'0')+'.png'),new Uint8Array(await blob.arrayBuffer()));
  }
 }
 return {path:outputPath,slideCount:ppt.slides.items.length};
}
