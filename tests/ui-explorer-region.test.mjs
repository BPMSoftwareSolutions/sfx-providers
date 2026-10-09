import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadUiProviders} from '../src/ui-providers/registry.mjs';
test('each declared region has exactly one matching folder and package identity',async()=>{
 const providers=await loadUiProviders();
 for(const region of ['header','left-sidebar','middle','right-sidebar']) {
  const id='sfx-ui-explorer-region-'+region,entry=providers.get(id);
  assert.ok(entry,id);assert.equal(entry.name,id);assert.equal(entry.module.descriptor.package,'providers/'+id);
  assert.deepEqual(entry.module.regions.map(x=>x.regionId),[region]);
 }
 assert.equal(providers.has('sfx-ui-explorer-region'),false);
});
