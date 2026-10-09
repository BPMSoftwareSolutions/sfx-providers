import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {invoke,descriptor,MAX_REQUEST_BYTES,browser} from '../providers/sfx-ui-provider-drilldown/sfx-ui-provider-drilldown.mjs';
import {bindViewSelection} from '../providers/sfx-ui-provider-drilldown/selection.mjs';
const read=()=>JSON.parse(readFileSync(new URL('./fixtures/ui-view-read.json',import.meta.url),'utf8'));
test('drill-down prepares the supplied declaration without inventing a view or receipt',()=>{
  const input=read(),result=invoke(input);assert.equal(result.disposition,'AUTHORED');assert.deepEqual(result.candidate,input);assert.equal(descriptor.package,'providers/'+descriptor.providerId);assert.ok(browser.exports.includes('mount'));
});
test('one selected identity reaches source, section and action reads; literal values stay literal',()=>{
  const original={...read(),sources:[{sourceId:'provider-inspection',reader:'provider-inspection',input:{providerId:'prior',extra:'retained'}}],sections:[{bindings:{profile:{kind:'read',sourceId:'provider-inspection'},literal:{kind:'literal',value:'prior'}},actions:[{input:{change:{kind:'source',sourceId:'provider-inspection',input:{own:'retained'}}}}]}]};
  const before=structuredClone(original),selection={viewId:'not-an-input',providerId:'chosen',capabilityId:'cap',expectedSnapshotDigest:'a'.repeat(64),namespaceId:null};
  const result=bindViewSelection(original,selection);assert.deepEqual(original,before);
  assert.equal(result.sources[0].input.providerId,'chosen');assert.equal(result.sections[0].bindings.profile.input.providerId,'chosen');assert.equal(result.sections[0].actions[0].input.change.input.providerId,'chosen');assert.equal(result.sections[0].bindings.literal.value,'prior');assert.equal(result.sections[0].actions[0].input.change.input.own,'retained');assert.equal(result.sources[0].input.viewId,undefined);assert.equal(result.sources[0].input.namespaceId,undefined);
});
test('unreadable, malformed, unsupported and oversized views refuse by name',()=>{
  for(const input of [null,{}, {...read(),viewContractId:'other.v1'}])assert.equal(invoke(input).findings[0].code,'UI_VIEW_REQUEST_INVALID');
  assert.equal(invoke({...read(),status:'NOT_FOUND'}).findings[0].code,'UI_VIEW_NOT_READ');
  const bad=read();bad.sections[0].component.kind='unknown';assert.equal(invoke(bad).disposition,'HELD');
  assert.equal(invoke(read(),{requestBytes:MAX_REQUEST_BYTES+1}).findings[0].code,'UI_VIEW_REQUEST_OVERSIZED');
});
