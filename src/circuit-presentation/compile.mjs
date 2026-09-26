import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Slide } from './design.mjs';
import { OUTPUT_ID, operations, requestSchema, validate } from './contracts.mjs';
import { objectsFromRequests, renderSvg } from './render.mjs';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const presetUrl=new URL('./presets/sidefx-announcement.json',import.meta.url);
let presetPromise;
const error=(message,code='CIRCUIT_LAYOUT_INVALID')=>Object.assign(new Error(message),{code});

function checkGeometry(requests) {
  for(const o of objectsFromRequests(requests)){
    const {size,transform:t}=o.elementProperties;const w=size.width.magnitude,h=size.height.magnitude;
    const x2=t.translateX+w*t.scaleX,y2=t.translateY+h*t.scaleY;
    if(![w,h,t.translateX,t.translateY,t.scaleX,t.scaleY].every(Number.isFinite)||w<=0||h<=0||
      Math.min(t.translateX,x2)<-.1||Math.max(t.translateX,x2)>960.1||Math.min(t.translateY,y2)<-.1||Math.max(t.translateY,y2)>540.1)throw error(`Element ${o.objectId} lies outside the 960 x 540 point canvas or has invalid geometry.`);
    if(o.text&&(o.textStyle.fontSize.magnitude<6||o.textStyle.fontSize.magnitude>96))throw error(`Element ${o.objectId} requires a font size from 6 to 96 points.`);
  }
}

export async function compilePresentation(input) {
  validate(input,requestSchema);
  const prefix=input.objectPrefix??'sfx_circuit';
  let title,slides;
  if(input.preset){
    const preset=await (presetPromise??=fs.readFile(presetUrl,'utf8').then(JSON.parse));
    title=preset.title;
    slides=preset.slides.map((slide,i)=>{
      const id=`${prefix}_s${i+1}`,map=new Map([[slide.id,id]]);
      let count=0;for(const r of slide.requests){const c=r.createShape??r.createLine;if(c)map.set(c.objectId,`${id}_o${++count}`);}
      const requests=structuredClone(slide.requests);
      for(const r of requests){const v=Object.values(r)[0];if(v.objectId)v.objectId=map.get(v.objectId);if(v.elementProperties)v.elementProperties.pageObjectId=id;}
      // Trim unused frame margins at the canvas edge in the retained design.
      // Visible text and coordinates within the canvas remain unchanged.
      for(const r of requests)if(r.createShape?.shapeType==='TEXT_BOX'){
        const e=r.createShape.elementProperties;
        if(e.transform.translateX<0){e.size.width.magnitude+=e.transform.translateX;e.transform.translateX=0;}
        e.size.width.magnitude=Math.min(e.size.width.magnitude,960-e.transform.translateX);
      }
      return {id,title:slide.title,notes:slide.notes,requests};
    });
  } else {
    title=input.deck.title;
    if(input.deck.slides.reduce((n,s)=>n+s.commands.length,0)>4000)throw error('Maximum 4,000 diagram commands per deck.','CIRCUIT_REQUEST_OVERSIZED');
    const sources=input.deck.sources??[];
    if(new Set(sources.map(s=>s.id)).size!==sources.length)throw error('Source IDs must be unique.','CIRCUIT_REQUEST_INVALID');
    let nativeCount=0;
    slides=input.deck.slides.map((spec,i)=>{
      const id=`${prefix}_s${i+1}`,s=new Slide(i+1,spec.title,spec.subtitle??'',{id,sources});
      for(const command of spec.commands){
        if(!Object.hasOwn(operations,command.op))throw error('Unsupported diagram operation.','CIRCUIT_REQUEST_INVALID');
        if(command.op==='source'&&command.args[0].some(id=>!sources.some(s=>s.id===id)))throw error('Unknown source reference.','CIRCUIT_REQUEST_INVALID');
        const before=s.req.length;
        Slide.prototype[command.op].apply(s,command.args);
        nativeCount+=s.req.length-before;
        if(nativeCount>23000)throw error('Native request budget exceeded.','CIRCUIT_REQUEST_OVERSIZED');
      }
      return {id,title:spec.title,notes:spec.notes??'',requests:s.req};
    });
  }
  const requests=[];
  for(const slide of slides){
    checkGeometry(slide.requests);
    slide.svg=renderSvg(slide.requests);
    requests.push({createSlide:{objectId:slide.id,slideLayoutReference:{predefinedLayout:'BLANK'}}},...slide.requests);
  }
  if(requests.length>24000)throw error('Maximum 24,000 native requests per deck.','CIRCUIT_REQUEST_OVERSIZED');
  const body={title,pageSize:{width:960,height:540,unit:'PT'},slides,requests};
  return {contractId:OUTPUT_ID,inputDigest:hash(input),contentDigest:hash(body),...body};
}
