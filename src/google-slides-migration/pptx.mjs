import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import path from 'node:path';

export const PPTX_MIME='application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const MAX_PPTX_BYTES=50*1024*1024;
const fail=message=>{throw new Error(message);};
const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos|#x[\da-f]+|#\d+);/gi,v=>({ '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'" }[v]??String.fromCodePoint(v.startsWith('&#x')?parseInt(v.slice(3,-1),16):Number(v.slice(2,-1)))));
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m=>[m[1],decode(m[2]??m[3])]));
const textRuns=xml=>[...xml.matchAll(/<(?:[\w]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w]+:)?t>/g)].map(m=>decode(m[1])).filter(v=>v.trim());
const relationships=xml=>[...xml.matchAll(/<(?:\w+:)?Relationship\b([^>]*?)\/?\s*>/g)].map(m=>attrs(m[1]));
const part=(base,target)=>path.posix.normalize(target.startsWith('/')?target.slice(1):path.posix.join(base,target));

// Read ZIP entries in memory. No archive paths are extracted to the filesystem.
export function inspectPptx(bytes) {
  if(!Buffer.isBuffer(bytes)||bytes.length<22||bytes.length>MAX_PPTX_BYTES)fail('PPTX must contain 22 bytes to 50 MiB.');
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}
  if(end<0)fail('Invalid PPTX ZIP directory.');
  if(bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6))fail('Multi-disk ZIP is unsupported.');
  const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),offset=bytes.readUInt32LE(end+16);
  if(count===65535||offset+size>end)fail('ZIP64 or invalid ZIP directory is unsupported.');
  const entries=new Map();let cursor=offset,totalXml=0;
  for(let i=0;i<count;i++){
    if(cursor+46>end||bytes.readUInt32LE(cursor)!==0x02014b50)fail('Invalid ZIP entry.');
    const n=bytes.readUInt16LE(cursor+28),extra=bytes.readUInt16LE(cursor+30),comment=bytes.readUInt16LE(cursor+32);
    const name=bytes.subarray(cursor+46,cursor+46+n).toString('utf8');
    if(entries.has(name)||name.includes('..')||name.startsWith('/'))fail('Duplicate or unsafe ZIP entry.');
    entries.set(name,{flags:bytes.readUInt16LE(cursor+8),method:bytes.readUInt16LE(cursor+10),compressed:bytes.readUInt32LE(cursor+20),length:bytes.readUInt32LE(cursor+24),at:bytes.readUInt32LE(cursor+42)});
    cursor+=46+n+extra+comment;if(cursor>offset+size)fail('ZIP directory overrun.');
  }
  const read=name=>{
    const e=entries.get(name);if(!e)return '';
    if(e.flags&1||e.length>16*1024*1024||e.at+30>bytes.length||bytes.readUInt32LE(e.at)!==0x04034b50)fail('Encrypted or oversized PPTX part.');
    const start=e.at+30+bytes.readUInt16LE(e.at+26)+bytes.readUInt16LE(e.at+28);
    if(start+e.compressed>offset)fail('Invalid ZIP part bounds.');
    const source=bytes.subarray(start,start+e.compressed);
    const data=e.method===0?source:e.method===8?inflateRawSync(source,{maxOutputLength:16*1024*1024}):fail('Unsupported ZIP compression.');
    totalXml+=data.length;if(data.length!==e.length||totalXml>32*1024*1024)fail('PPTX XML exceeds size bounds.');
    return data.toString('utf8');
  };
  if(!entries.has('[Content_Types].xml')||!entries.has('ppt/presentation.xml'))fail('The file is not a PPTX package.');
  const main=read('ppt/presentation.xml'),rels=relationships(read('ppt/_rels/presentation.xml.rels'));
  const ids=[...main.matchAll(/<(?:\w+:)?sldId\b([^>]*?)\/?\s*>/g)].map(m=>attrs(m[1])['r:id']);
  if(!ids.length||ids.length>256)fail('Expected 1 to 256 PPTX slides.');
  const slides=ids.map((id,index)=>{
    const rel=rels.find(r=>r.Id===id&&r.Type?.endsWith('/slide')&&r.TargetMode!=='External');
    if(!rel)fail('Unresolved slide relationship.');
    const name=part('ppt',rel.Target);if(!entries.has(name))fail('Missing slide part.');
    const xml=read(name),slideRels=relationships(read(path.posix.join(path.posix.dirname(name),'_rels',path.posix.basename(name)+'.rels')));
    const note=slideRels.find(r=>r.Type?.endsWith('/notesSlide')&&r.TargetMode!=='External');
    const notes=note?read(part(path.posix.dirname(name),note.Target)):'';
    return {number:index+1,text:textRuns(xml),notes:textRuns(notes),links:slideRels.filter(r=>r.Type?.endsWith('/hyperlink')&&r.TargetMode==='External').map(r=>r.Target),
      shapeCount:[...xml.matchAll(/<(?:\w+:)?sp\b/g)].length,imageCount:[...xml.matchAll(/<(?:\w+:)?pic\b/g)].length};
  });
  return {mimeType:PPTX_MIME,sha256:createHash('sha256').update(bytes).digest('hex'),byteCount:bytes.length,slideCount:slides.length,slides};
}
