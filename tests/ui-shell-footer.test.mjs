import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { invoke, regions, capabilities, contentManifest, descriptor } from '../providers/sfx-ui-shell-footer/sfx-ui-shell-footer.mjs';

const request = { contractId: 'ui-region-request.v1', regionId: 'footer' };

assert.equal(descriptor.providerId, 'sfx-ui-shell-footer');
assert.equal(descriptor.operations[0].operationId, 'ui.region.load');
assert.equal(descriptor.operations[0].effect, 'READ_ONLY');
assert.equal(regions.length, 1);
assert.equal(regions[0].regionId, 'footer');
assert.equal(regions[0].place, 5);
assert.equal(regions[0].role, 'shell-chrome');
assert.equal(capabilities[0].capabilityId, 'ui-region-footer');

const digest = (text) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
for (const asset of regions[0].assets) {
  assert.equal(asset.digest, digest(asset.content), `${asset.assetId} digest`);
  assert.equal(asset.bytes, Buffer.byteLength(asset.content, 'utf8'), `${asset.assetId} bytes`);
}
assert.equal(contentManifest.regions.length, 1);
assert.ok(/^sha256:[0-9a-f]{64}$/.test(contentManifest.digest));

const authored = invoke(request);
assert.equal(authored.disposition, 'AUTHORED');
assert.equal(authored.shapeConforms, true);
assert.equal(authored.candidate.regionProviderId, 'sfx-ui-shell-footer');
assert.equal(authored.candidate.assets.length, 3);

for (const [input, code] of [
  [{ ...request, regionId: 'header' }, 'UI_REGION_UNKNOWN'],
  [{ ...request, contractId: 'other.v1' }, 'UI_REGION_REQUEST_INVALID'],
  [{ ...request, extra: 1 }, 'UI_REGION_REQUEST_INVALID'],
  [{}, 'UI_REGION_REQUEST_INVALID'],
]) {
  const held = invoke(input);
  assert.equal(held.disposition, 'HELD', JSON.stringify(input));
  assert.equal(held.findings[0].code, code, JSON.stringify(input));
  assert.equal(held.candidate, null);
}

const oversized = invoke(request, { requestBytes: 20000 });
assert.equal(oversized.findings[0].code, 'UI_REGION_REQUEST_OVERSIZED');

console.log('ui-shell-footer tests passed');
