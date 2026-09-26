// Reusable native diagram primitives extracted from the retained SideFX design.
export const C={bg:'#06111F',panel:'#102238',plane:'#142A43',white:'#F4F7FB',muted:'#A8B8CA',blue:'#45A7FF',amber:'#F6B94D',violet:'#A98AF2',green:'#4DE0B0',red:'#FF5F70',grid:'#263A51'};
const rgb=h=>({red:parseInt(h.slice(1,3),16)/255,green:parseInt(h.slice(3,5),16)/255,blue:parseInt(h.slice(5,7),16)/255});
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export class Slide{
 constructor(n,title,subtitle='',{id=`circuit_slide_${n}`,sources=[]}={}){
  this.n=n;this.id=id;this.sources=sources;this.req=[];this.svg=[];this.k=0;this.refs=[];this.title=title;
  this.req.push({updatePageProperties:{objectId:this.id,pageProperties:{pageBackgroundFill:{solidFill:{color:{rgbColor:rgb(C.bg)},alpha:1}}},fields:'pageBackgroundFill'}});
  this.t(title,34,22,880,49,31,C.white,true);
  if(subtitle)this.t(subtitle,36,77,876,44,14,C.muted);
  this.t(String(n).padStart(2,'0'),895,510,36,20,10,C.muted,false,'right');
 }
 idNew(){return `${this.id}_o${++this.k}`;}
 shape(type,x,y,w,h,{fill=C.panel,stroke='none',sw=1,alpha=1,sa=1}={}){
  const id=this.idNew();this.req.push({createShape:{objectId:id,shapeType:type,elementProperties:{pageObjectId:this.id,size:{width:{magnitude:w,unit:'PT'},height:{magnitude:h,unit:'PT'}},transform:{scaleX:1,scaleY:1,translateX:x,translateY:y,unit:'PT'}}}});
  const props={shapeBackgroundFill:fill==='none'?{propertyState:'NOT_RENDERED'}:{solidFill:{color:{rgbColor:rgb(fill)},alpha}},outline:stroke==='none'?{propertyState:'NOT_RENDERED'}:{solidFill:undefined,outlineFill:{solidFill:{color:{rgbColor:rgb(stroke)},alpha:sa}},weight:{magnitude:sw,unit:'PT'},dashStyle:'SOLID'}};
  this.req.push({updateShapeProperties:{objectId:id,shapeProperties:props,fields:'shapeBackgroundFill,outline'}});
  const attrs=`fill="${fill}" fill-opacity="${alpha}" stroke="${stroke}" stroke-width="${sw}" stroke-opacity="${sa}"`;
  if(type==='ELLIPSE')this.svg.push(`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" ${attrs}/>`);
  else if(type==='DIAMOND')this.svg.push(`<polygon points="${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}" ${attrs}/>`);
  else if(type==='HEXAGON')this.svg.push(`<polygon points="${x+w*.23},${y} ${x+w*.77},${y} ${x+w},${y+h/2} ${x+w*.77},${y+h} ${x+w*.23},${y+h} ${x},${y+h/2}" ${attrs}/>`);
  else this.svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${type==='ROUND_RECTANGLE'?8:0}" ${attrs}/>`);
  return id;
 }
 t(text,x,y,w,h,size=18,color=C.white,bold=false,align='left',link){
  const id=this.idNew();this.req.push({createShape:{objectId:id,shapeType:'TEXT_BOX',elementProperties:{pageObjectId:this.id,size:{width:{magnitude:w,unit:'PT'},height:{magnitude:h,unit:'PT'}},transform:{scaleX:1,scaleY:1,translateX:x,translateY:y,unit:'PT'}}}});
  this.req.push({insertText:{objectId:id,insertionIndex:0,text}});
  this.req.push({updateTextStyle:{objectId:id,textRange:{type:'ALL'},style:{fontFamily:'Arial',fontSize:{magnitude:size,unit:'PT'},bold,foregroundColor:{opaqueColor:{rgbColor:rgb(color)}},...(link?{link:typeof link==='string'?{url:link}:link,underline:true}:{})},fields:'fontFamily,fontSize,bold,foregroundColor'+(link?',link,underline':'')}});
  this.req.push({updateParagraphStyle:{objectId:id,textRange:{type:'ALL'},style:{alignment:align==='center'?'CENTER':align==='right'?'END':'START',spaceAbove:{magnitude:0,unit:'PT'},spaceBelow:{magnitude:0,unit:'PT'},lineSpacing:108},fields:'alignment,spaceAbove,spaceBelow,lineSpacing'}});
  const ax=align==='center'?x+w/2:align==='right'?x+w-4:x+4;
  const anchor=align==='center'?'middle':align==='right'?'end':'start';
  this.svg.push(`<text x="${ax}" y="${y+size+3}" font-family="Arial" font-size="${size}" font-weight="${bold?700:400}" fill="${color}" text-anchor="${anchor}">${text.split('\n').map((l,i)=>`<tspan x="${ax}" dy="${i?size*1.08:0}">${esc(l)}</tspan>`).join('')}</text>`);
  return id;
 }
 line(x1,y1,x2,y2,color=C.muted,width=2,{dash=false,alpha=1,arrow=false}={}){
  const id=this.idNew();const dx=x2-x1,dy=y2-y1;
  this.req.push({createLine:{objectId:id,lineCategory:'STRAIGHT',elementProperties:{pageObjectId:this.id,size:{width:{magnitude:Math.max(Math.abs(dx),.01),unit:'PT'},height:{magnitude:Math.max(Math.abs(dy),.01),unit:'PT'}},transform:{scaleX:dx===0?0:Math.sign(dx),scaleY:dy===0?0:Math.sign(dy),translateX:x1,translateY:y1,unit:'PT'}}}});
  this.req.push({updateLineProperties:{objectId:id,lineProperties:{lineFill:{solidFill:{color:{rgbColor:rgb(color)},alpha}},weight:{magnitude:width,unit:'PT'},dashStyle:dash?'DASH':'SOLID',startArrow:'NONE',endArrow:arrow?'FILL_ARROW':'NONE'},fields:'lineFill,weight,dashStyle,startArrow,endArrow'}});
  this.svg.push(`<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${alpha}" ${dash?'stroke-dasharray="6 5"':''}/>`);
  if(arrow){const a=Math.atan2(dy,dx),z=6;this.svg.push(`<path d="M${x2-z*Math.cos(a-.5)} ${y2-z*Math.sin(a-.5)} L${x2} ${y2} L${x2-z*Math.cos(a+.5)} ${y2-z*Math.sin(a+.5)}" fill="none" stroke="${color}" stroke-width="${width}"/>`);}
 }
 route(points,color=C.green,{width=2.5,dash=false,arrow=false,glow=true}={}){
  if(glow)for(let i=1;i<points.length;i++)this.line(...points[i-1],...points[i],color,width+5,{alpha:.065,dash});
  for(let i=1;i<points.length;i++)this.line(...points[i-1],...points[i],color,width,{dash,arrow:arrow&&i===points.length-1});
 }
 port(x,y,color=C.green,r=4){this.shape('ELLIPSE',x-r,y-r,r*2,r*2,{fill:C.bg,stroke:color,sw:1.5});}
 junction(x,y,color=C.green,r=5){this.shape('ELLIPSE',x-r-3,y-r-3,(r+3)*2,(r+3)*2,{fill:color,alpha:.10});this.shape('ELLIPSE',x-r,y-r,r*2,r*2,{fill:color,stroke:C.bg,sw:1});}
 stop(x,y,color=C.red){this.line(x-7,y-9,x+7,y+9,color,3);this.line(x-7,y+9,x+7,y-9,color,3);}
 gate(x,y,label='',color=C.violet,r=20){this.shape('DIAMOND',x-r,y-r,r*2,r*2,{fill:C.panel,stroke:color,sw:2});if(label)this.t(label,x-r+1,y-10,r*2-2,23,10,color,true,'center');return {x,y};}
 chip(x,y,w,h,label,color=C.green,{size=16,sub='',pins=3}={}){
  this.shape('ROUND_RECTANGLE',x+4,y+5,w,h,{fill:'#020A14'});
  this.shape('ROUND_RECTANGLE',x,y,w,h,{fill:C.panel,stroke:color,sw:1.4});
  this.shape('RECTANGLE',x+5,y+5,w-10,3,{fill:color,alpha:.5});
  for(let i=0;i<pins;i++){const yy=pins===1?y+h/2:y+15+i*(h-30)/Math.max(pins-1,1);this.line(x-7,yy,x,yy,color,1.5);this.line(x+w,yy,x+w+7,yy,color,1.5);}
  this.t(label,x+5,y+12,w-10,h-14,size,C.white,true,'center');
  if(sub)this.t(sub,x-8,y+h+8,w+16,44,12,color,false,'center');
  return {x,y,w,h,l:[x-7,y+h/2],r:[x+w+7,y+h/2],top:[x+w/2,y],bottom:[x+w/2,y+h]};
 }
 socket(x,y,{color=C.green,label='',height=48}={}){
  this.shape('RECTANGLE',x-9,y-height/2,18,height,{fill:C.plane,stroke:color,sw:1});
  for(let d=-1;d<=1;d++)this.line(x-16,y+d*10,x+16,y+d*10,color,2);
  this.port(x,y,color,3);if(label)this.t(label,x-68,y+height/2+8,136,37,12,color,false,'center');
 }
 terminal(x,y,label,color=C.green,{sub='',r=23,size=14}={}){
  this.shape('ELLIPSE',x-r-4,y-r-4,(r+4)*2,(r+4)*2,{fill:'none',stroke:color,sw:.6,sa:.45});
  this.shape('ELLIPSE',x-r,y-r,r*2,r*2,{fill:C.panel,stroke:color,sw:1.8});
  if(label)this.t(label,x-r+2,y-10,r*2-4,26,size,color,true,'center');
  if(sub)this.t(sub,x-65,y+r+9,130,40,12,C.muted,false,'center');
 }
 region(x,y,w,h,label,color=C.muted){this.shape('ROUND_RECTANGLE',x,y,w,h,{fill:C.panel,alpha:.3,stroke:color,sw:.65,sa:.5});this.t(label,x+9,y+5,w-18,24,11,color,true);}
 label(text,x,y,w=180,color=C.muted,size=13){this.t(text,x,y,w,48,size,color);}
 source(ids=[]){let x=36;this.refs=ids;for(const id of ids){const s=this.sources.find(s=>s.id===id);if(!s)continue;let name=s.shortTitle??s.title;name=name.replace(/\([^)]*\)/g,'').trim();if(name.length>31)name=name.slice(0,29)+'…';const w=Math.min(218,name.length*5.4+15);this.t(name,x,510,w,22,9.5,C.muted,false,'left',s.url);x+=w;}}
 foot(text){this.t(text,36,468,873,36,12,C.muted);}
 legend(items,y=470){let x=40;for(const [name,color] of items){this.line(x,y+10,x+19,y+10,color,3);this.t(name,x+22,y-1,name.length*7+14,25,10.5,C.muted);x+=name.length*7+61;}}
}
