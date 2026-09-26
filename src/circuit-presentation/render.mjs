export const rgbHex = rgb => '#'+['red','green','blue'].map(k=>Math.round((rgb?.[k]??0)*255).toString(16).padStart(2,'0')).join('');
const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export function objectsFromRequests(requests) {
  const objects = new Map();
  for(const r of requests){
    const create=r.createShape??r.createLine;
    if(create)objects.set(create.objectId,{...structuredClone(create),kind:r.createShape?'shape':'line'});
    if(r.deleteObject)objects.delete(r.deleteObject.objectId);
    for(const [key,field] of [['updateShapeProperties','props'],['updateTextStyle','textStyle'],['updateParagraphStyle','para'],['updateLineProperties','lineProps']]) {
      if(r[key]){const v=r[key];Object.assign(objects.get(v.objectId)[field]??= {},v.shapeProperties??v.style??v.lineProperties);}
    }
    if(r.insertText)objects.get(r.insertText.objectId).text=r.insertText.text;
  }
  return [...objects.values()];
}
const paint = p => !p||p.propertyState==='NOT_RENDERED'?'none':rgbHex(p.solidFill?.color?.rgbColor);
export function renderSvg(requests) {
  const bg=requests.find(r=>r.updatePageProperties)?.updatePageProperties.pageProperties.pageBackgroundFill;
  const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 960 540"><rect width="960" height="540" fill="${paint(bg)}"/>`];
  for(const o of objectsFromRequests(requests)) {
    const e=o.elementProperties,t=e.transform,x=t.translateX,y=t.translateY,w=e.size.width.magnitude,h=e.size.height.magnitude;
    if(o.kind==='line'){
      const p=o.lineProps,dx=w*t.scaleX,dy=h*t.scaleY,color=paint(p.lineFill),weight=p.weight.magnitude;
      out.push(`<path d="M${x} ${y} L${x+dx} ${y+dy}" fill="none" stroke="${color}" stroke-width="${weight}" opacity="${p.lineFill.solidFill.alpha??1}" ${p.dashStyle==='DASH'?'stroke-dasharray="6 5"':''}/>`);
      if(p.endArrow==='FILL_ARROW'){const a=Math.atan2(dy,dx),ex=x+dx,ey=y+dy;out.push(`<polygon points="${ex},${ey} ${ex-6*Math.cos(a)+3*Math.sin(a)},${ey-6*Math.sin(a)-3*Math.cos(a)} ${ex-6*Math.cos(a)-3*Math.sin(a)},${ey-6*Math.sin(a)+3*Math.cos(a)}" fill="${color}"/>`);}
      continue;
    }
    if(o.shapeType!=='TEXT_BOX'){
      const p=o.props??{},border=p.outline,attrs=`fill="${paint(p.shapeBackgroundFill)}" fill-opacity="${p.shapeBackgroundFill?.solidFill?.alpha??1}" stroke="${border?.propertyState==='NOT_RENDERED'?'none':paint(border?.outlineFill)}" stroke-width="${border?.weight?.magnitude??0}" stroke-opacity="${border?.outlineFill?.solidFill?.alpha??1}"`;
      if(o.shapeType==='ELLIPSE')out.push(`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" ${attrs}/>`);
      else if(o.shapeType==='DIAMOND')out.push(`<polygon points="${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}" ${attrs}/>`);
      else if(o.shapeType==='HEXAGON')out.push(`<polygon points="${x+w*.23},${y} ${x+w*.77},${y} ${x+w},${y+h/2} ${x+w*.77},${y+h} ${x+w*.23},${y+h} ${x},${y+h/2}" ${attrs}/>`);
      else out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.shapeType==='ROUND_RECTANGLE'?8:0}" ${attrs}/>`);
    }
    if(o.text){const s=o.textStyle,align=o.para.alignment,size=s.fontSize.magnitude,ax=align==='CENTER'?x+w/2:align==='END'?x+w-4:x+4;
      if(s.link)out.push(`<a href="${escape(s.link.url)}">`);
      out.push(`<text x="${ax}" y="${y+size+3}" font-family="Arial" font-size="${size}" font-weight="${s.bold?700:400}" fill="${rgbHex(s.foregroundColor.opaqueColor.rgbColor)}" text-anchor="${align==='CENTER'?'middle':align==='END'?'end':'start'}">${o.text.split('\n').map((line,i)=>`<tspan x="${ax}" dy="${i?size*1.08:0}">${escape(line)}</tspan>`).join('')}</text>`);
      if(s.link)out.push('</a>');
    }
  }
  return out.join('')+'</svg>';
}
