import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { requestSchema,outputSchema } from '../src/circuit-presentation/contracts.mjs';
import { inputShape as capabilityInput,outputShape as capabilityOutput } from '../src/capability-presentation/provider.mjs';
const root=new URL('../',import.meta.url),base=new URL('examples/circuit-presentation/sidefx-announcement/provenance/',root);
const json=async url=>JSON.parse(await fs.readFile(url,'utf8'));
const manifest=await json(new URL('manifest.json',base));
for(const file of manifest.files)if(file.sha256){const bytes=await fs.readFile(new URL(file.path,base));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,`Retained source changed: ${file.path}`);}
const preset=await json(new URL('src/circuit-presentation/presets/sidefx-announcement.json',root));
const repairs=[...await json(new URL('redesign-google-repairs.json',base)),...await json(new URL('redesign-google-repairs-2.json',base))];
for(const [i,slide]of preset.slides.entries()){
 const original=await json(new URL(`requests/slide-${String(i+1).padStart(2,'0')}.json`,base));
 const requests=original.filter(r=>!r.deleteObject);
 const ids=new Set(requests.flatMap(r=>[r.createShape?.objectId,r.createLine?.objectId].filter(Boolean)));
 for(const r of repairs){const v=Object.values(r)[0];if(v.elementProperties?.pageObjectId===slide.id)ids.add(v.objectId);if(!ids.has(v.objectId))continue;
  if(r.deleteObject){for(let j=requests.length-1;j>=0;j--)if(Object.values(requests[j])[0]?.objectId===v.objectId)requests.splice(j,1);}else requests.push(r);
 }
 assert.deepEqual(slide.requests,requests,`Preset does not replay the retained repairs on slide ${i+1}`);
}
assert.deepEqual(await json(new URL('contracts/circuit-presentation/request.v1.schema.json',root)),requestSchema);
assert.deepEqual(await json(new URL('contracts/circuit-presentation/output.v1.schema.json',root)),outputSchema);
assert.deepEqual(await json(new URL('contracts/capability-presentation/request.v1.schema.json',root)),capabilityInput.schema);
assert.deepEqual(await json(new URL('contracts/capability-presentation/output.v1.schema.json',root)),capabilityOutput.schema);
console.log(JSON.stringify({retainedHashes:manifest.files.filter(f=>f.sha256).length,replayedSlides:preset.slides.length,schemas:'match'}));
