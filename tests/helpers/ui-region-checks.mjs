import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';


export function verifyRegionProvider(provider, regionId, expectedPlace) {
const PACKAGE_ROOT = new URL(`../../providers/${provider.providerId}/`, import.meta.url);
const request = { contractId: provider.REQUEST_CONTRACT_ID };
const EXPECTED_REGIONS = [regionId];
const EXPECTED_KINDS = ['css', 'html', 'svg'];

function fileOf(asset) {
  const content = readFileSync(new URL(asset.path, PACKAGE_ROOT), 'utf8');
  return {
    content,
    bytes: Buffer.byteLength(content, 'utf8'),
    digest: `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`,
  };
}

test('uniform contract exports agree with the descriptor and capability declarations', () => {
  assert.equal(provider.descriptor.moduleContractId, 'ui-runtime-provider.v1');
  assert.equal(provider.descriptor.providerId, provider.providerId);
  assert.equal(provider.descriptor.operations[0].operationId, provider.toolId);
  assert.equal(provider.toolId, 'ui.region.load');
  assert.equal(provider.descriptor.operations[0].inputContractId, provider.REQUEST_CONTRACT_ID);
  assert.equal(provider.descriptor.operations[0].outputContractId, provider.OUTPUT_CONTRACT_ID);
  assert.equal(provider.descriptor.operations[0].effect, 'READ_ONLY');
  assert.equal(provider.descriptor.bindingState, 'UNBOUND');
  assert.equal(provider.descriptor.readiness.declaration, 'REVIEWABLE');
  assert.equal(provider.descriptor.readiness.execution, 'HELD');
  assert.equal(typeof provider.invoke, 'function');
  assert.equal(provider.handle, provider.invoke);
  assert.equal(provider.inputShape.contractId, provider.REQUEST_CONTRACT_ID);
  assert.equal(provider.outputShape.contractId, provider.OUTPUT_CONTRACT_ID);
});

test('declares exactly its own provider capability', () => {
  assert.deepEqual(provider.REGION_IDS, EXPECTED_REGIONS);
  assert.equal(provider.regions.length, 1);
  assert.equal(provider.capabilities.length, 1);
  const ports = new Set();
  provider.regions.forEach((region, index) => {
    assert.equal(region.regionId, EXPECTED_REGIONS[index]);
    assert.equal(region.regionProviderId, provider.providerId);
    assert.equal(region.place, expectedPlace);
    assert.equal(region.bindingState, 'UNBOUND');
    assert.deepEqual(region.readiness, { declaration: 'REVIEWABLE', execution: 'HELD' });
    assert.equal(typeof region.role, 'string');
    assert.ok(region.basis.includes('ui-circuit-blueprint-strategy.md'));
    const capability = provider.capabilities.find((entry) => entry.providerId === region.regionProviderId);
    assert.ok(capability);
    assert.equal(capability.capabilityId, region.capabilityId);
    assert.equal(capability.role, 'PLATFORM');
    assert.equal(capability.platformCapabilityId, region.platformCapabilityId);
    assert.equal(capability.conformanceContractId, provider.OUTPUT_CONTRACT_ID);
    assert.equal(capability.operationId, provider.toolId);
    assert.equal(capability.status, 'PROPOSED');
    assert.ok(!ports.has(region.platformCapabilityId));
    ports.add(region.platformCapabilityId);
  });
});

test('content manifest links every region asset kind to its file digest', () => {
  assert.equal(provider.contentManifest.contractId, provider.MANIFEST_CONTRACT_ID);
  assert.equal(provider.contentManifest.manifestId, `${regionId}.v1`);
  assert.equal(provider.contentManifest.providerId, provider.providerId);
  assert.equal(provider.contentManifest.derivedFrom, 'live-circuit/circuit/explorer.html:180-302');
  assert.deepEqual(provider.contentManifest.regions.map((region) => region.regionId), EXPECTED_REGIONS);
  assert.match(provider.contentManifest.digest, /^sha256:[0-9a-f]{64}$/);
  const assetIds = new Set();
  for (const region of provider.contentManifest.regions) {
    assert.deepEqual(region.assets.map((asset) => asset.kind), EXPECTED_KINDS);
    for (const asset of region.assets) {
      assert.equal(asset.content, undefined);
      assert.equal(asset.path, `assets/${asset.assetId}`);
      assert.ok(asset.bytes > 0);
      assert.match(asset.digest, /^sha256:[0-9a-f]{64}$/);
      assert.ok(!assetIds.has(asset.assetId));
      assetIds.add(asset.assetId);
      assert.equal(asset.digest, fileOf(asset).digest, asset.assetId);
    }
  }
  assert.equal(assetIds.size, 3);
});

test('invoke loads each region through the circuit deterministically', () => {
  for (const regionId of EXPECTED_REGIONS) {
    const first = provider.invoke({ ...request, regionId });
    const second = provider.invoke({ ...request, regionId });
    assert.equal(first.disposition, 'AUTHORED');
    assert.equal(first.providerId, provider.providerId);
    assert.equal(first.toolId, provider.toolId);
    assert.equal(first.providerExecution, 'deterministic');
    assert.equal(first.shapeConforms, true);
    assert.deepEqual(first.findings, []);
    assert.deepEqual(first.candidate, second.candidate);
    assert.equal(first.candidate.contractId, provider.OUTPUT_CONTRACT_ID);
    assert.equal(first.candidate.regionId, regionId);
    assert.equal(first.candidate.regionProviderId, provider.providerId);
    assert.match(first.candidate.digest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(first.candidate.assets.length, 3);
    for (const asset of first.candidate.assets) {
      const file = fileOf(asset);
      assert.equal(asset.bytes, file.bytes);
      assert.equal(asset.digest, file.digest);
      assert.equal(asset.content, file.content);
    }
    const html = first.candidate.assets.find((asset) => asset.kind === 'html');
    assert.match(html.content, new RegExp(`data-region="${regionId}"`));
  }
  assert.deepEqual(
    provider.contentManifest.regions.map((region) => region.regionId),
    provider.regions.map((region) => region.regionId),
  );
});

test('refuses unknown regions and malformed requests by code', () => {
  const cases = [
    [null, 'UI_REGION_REQUEST_INVALID'],
    [{}, 'UI_REGION_REQUEST_INVALID'],
    [{ contractId: provider.REQUEST_CONTRACT_ID }, 'UI_REGION_REQUEST_INVALID'],
    [{ contractId: 'other.v1', regionId: 'header' }, 'UI_REGION_REQUEST_INVALID'],
    ...[...provider.inputShape.schema.properties.regionId.enum].filter(id => id !== regionId).map(id => [{...request, regionId:id}, 'UI_REGION_UNKNOWN']),
    [{ ...request, regionId: 'Header' }, 'UI_REGION_UNKNOWN'],
    [{ ...request, regionId: 7 }, 'UI_REGION_REQUEST_INVALID'],
    [{ ...request, regionId: 'header', extra: true }, 'UI_REGION_REQUEST_INVALID'],
  ];
  for (const [input, code] of cases) {
    const result = provider.invoke(input);
    assert.equal(result.disposition, 'HELD', JSON.stringify(input));
    assert.equal(result.candidate, null);
    assert.equal(result.shapeConforms, false);
    assert.equal(result.findings[0].code, code);
    assert.ok(result.findings[0].path.startsWith('$'));
  }
});

test('refuses requests over the declared byte limit', () => {
  const result = provider.invoke(request, { requestBytes: provider.MAX_REQUEST_BYTES + 1 });
  assert.equal(result.disposition, 'HELD');
  assert.equal(result.candidate, null);
  assert.equal(result.findings[0].code, 'UI_REGION_REQUEST_OVERSIZED');
  assert.equal(result.requestBytes, provider.MAX_REQUEST_BYTES + 1);
});

}
