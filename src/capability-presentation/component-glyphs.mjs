import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {C} from '../circuit-presentation/design.mjs';

export function validateComponentStyle(style){
 const bad=message=>{throw Object.assign(new Error(message),{code:'CAPABILITY_GLYPH_STYLE_INVALID'});};
 if(style?.contractId!=='capability-component-glyphs.v1'||!style.glyphs||!style.roles)bad('Unsupported component style contract.');
 const tuple=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(v=>Number.isFinite(v)&&v>=0&&v<=1);
 const frame=a=>tuple(a,4)&&a[2]>0&&a[3]>0&&a[0]+a[2]<=1.000001&&a[1]+a[3]<=1.000001;
 for(const g of Object.values(style.glyphs)){
  if(!frame(g.heading)||!frame(g.label)||!Array.isArray(g.primitives)||!g.primitives.length||g.primitives.length>32)bad('Invalid glyph frames or primitives.');
  for(const side of ['left','right','top','bottom'])if(!tuple(g.anchors?.[side],2))bad('Invalid glyph anchor.');
  for(const p of g.primitives){
   if(!['RECTANGLE','ROUND_RECTANGLE','ELLIPSE','DIAMOND','HEXAGON','LINE'].includes(p.type)||!(p.type==='LINE'?tuple(p.box,4)&&!(p.box[0]===p.box[2]&&p.box[1]===p.box[3]):frame(p.box)))bad('Invalid normalized primitive.');
   for(const token of [p.fill,p.stroke].filter(v=>v!=null))if(!['none','ink','panel','shadow','background'].includes(token))bad('Unknown paint token.');
   if(p.type==='LINE'&&(!p.stroke||p.stroke==='none'))bad('A contact line requires visible ink.');
   if(p.weight!=null&&(!Number.isFinite(p.weight)||p.weight<=0||p.weight>4))bad('Invalid stroke weight.');
   if(p.opacity!=null&&(!Number.isFinite(p.opacity)||p.opacity<0||p.opacity>1))bad('Invalid opacity.');
  }
 }
 const event=style.event;
 if(event){
  if(!event.platforms||!event.operations||!event.fallback)bad('Invalid Event component selection.');
  for(const entry of [...Object.values(event.platforms),...Object.values(event.operations),event.fallback])if(typeof entry.label!=='string'||!entry.label||!Object.hasOwn(style.glyphs,entry.glyph))bad('Invalid Event component rule.');
 }
 for(const name of [style.fallback,...Object.values(style.roles),...(style.rules??[]).map(r=>r.glyph)])if(!Object.hasOwn(style.glyphs,name))bad('Unknown glyph reference.');
 for(const r of style.rules??[])if(typeof r.kind!=='string'||typeof r.label!=='string')bad('Rules must match exact declared kind and label.');
 return style;
}
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export const COMPONENT_STYLE=freeze(validateComponentStyle(JSON.parse(readFileSync(new URL('./styles/component-glyphs.v1.json',import.meta.url),'utf8'))));
export const COMPONENT_STYLE_DIGEST=createHash('sha256').update(JSON.stringify(COMPONENT_STYLE)).digest('hex');
export function componentGlyph(node,style=COMPONENT_STYLE,glyphName){
 const name=glyphName??style.rules?.find(r=>r.kind===node.kind&&r.label===node.label)?.glyph??style.roles[node.kind]??style.fallback;
 if(!Object.hasOwn(style.glyphs,name))throw Object.assign(new Error('Unknown component glyph.'),{code:'CAPABILITY_GLYPH_STYLE_INVALID'});
 return {name,...style.glyphs[name]};
}
export const glyphFrame=(b,f)=>({x:b.x+f[0]*b.w,y:b.y+f[1]*b.h,w:f[2]*b.w,h:f[3]*b.h});
export function glyphAnchor(node,b,side,style=COMPONENT_STYLE,glyphName){const a=componentGlyph(node,style,glyphName).anchors[side];return [b.x+a[0]*b.w,b.y+a[1]*b.h];}
export function drawComponentGlyph(p,node,b,color,{scale=1,style=COMPONENT_STYLE,glyphName,record=true,fill='#041C32'}={}){
 const glyph=componentGlyph(node,style,glyphName),paint={none:'none',ink:color,panel:fill,shadow:'#020A14',background:C.bg};
 for(const q of glyph.primitives){const weight=Math.max(.5,(q.weight??1)*scale);
  if(q.type==='LINE'){const a=q.box;p.add('line',b.x+a[0]*b.w,b.y+a[1]*b.h,b.x+a[2]*b.w,b.y+a[3]*b.h,paint[q.stroke],weight,{alpha:q.opacity??1});}
  else{const f=glyphFrame(b,q.box);p.add('shape',q.type,f.x,f.y,f.w,f.h,{fill:paint[q.fill??'none'],stroke:paint[q.stroke??'none'],sw:weight,alpha:q.opacity??1});}
 }
 if(record&&p.blueprint){(p.blueprint.glyphs??=[]).push({nodeId:node.id,kind:node.kind,glyph:glyph.name,bounds:{...b},anchors:Object.fromEntries(['left','right','top','bottom'].map(side=>[side,glyphAnchor(node,b,side,style,glyphName)]))});p.blueprint.style={contractId:style.contractId,digest:style===COMPONENT_STYLE?COMPONENT_STYLE_DIGEST:createHash('sha256').update(JSON.stringify(style)).digest('hex')};}
 return {heading:glyphFrame(b,glyph.heading),label:glyphFrame(b,glyph.label)};
}
