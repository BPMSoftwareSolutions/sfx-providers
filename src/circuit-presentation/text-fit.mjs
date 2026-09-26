import fs from 'node:fs';
const metrics=JSON.parse(fs.readFileSync(new URL('./font-metrics/arial.json',import.meta.url),'utf8'));
export const textWidth=(text,size)=>Array.from(text).reduce((n,c)=>n+(metrics.advances[c]??metrics.fallbackAdvance),0)*size/metrics.unitsPerEm;
// Native Slides adds text-frame insets and uses Arial's line box, not its ink
// bounds. Reserve both plus a horizontal rounding allowance before wrapping.
export const blueprintTextFrame={horizontalInset:16,verticalInset:7.2,lineHeight:1.24};

export function fitBlueprintText(value,{width,height,fontSize,minFontSize=4}){
 const text=String(value??'');
 const {horizontalInset,verticalInset,lineHeight}=blueprintTextFrame;
 const wrap=size=>{
  const lines=[];
  for(const paragraph of text.split('\n')){
   let line='';
   for(const token of paragraph.split(/(?<=[\s/._-])/u)){
    if(line&&textWidth(line+token,size)>width-horizontalInset){lines.push(line.trimEnd());line='';}
    for(const char of token){
     if(line&&textWidth(line+char,size)>width-horizontalInset){lines.push(line.trimEnd());line='';}
     if(line||!/^\s$/.test(char))line+=char;
    }
   }
   lines.push(line.trimEnd());
  }
  return lines;
 };
 for(let size=Math.max(minFontSize,fontSize);size>=minFontSize-.001;size=Math.max(minFontSize,Math.round((size-.25)*100)/100)){
  const lines=wrap(size);
  if(lines.every(line=>textWidth(line,size)<=width-horizontalInset+.001)&&lines.length*size*lineHeight+verticalInset<=height+.001)return {text:lines.join('\n'),fontSize:size};
  if(size===minFontSize)break;
 }
 throw Object.assign(new Error('Blueprint label cannot fit its scaled cell without clipping: '+text),{code:'CAPABILITY_BLUEPRINT_TEXT_OVERFLOW'});
}
