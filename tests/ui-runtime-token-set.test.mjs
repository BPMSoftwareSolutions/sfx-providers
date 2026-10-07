import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as provider from '../providers/ui-runtime-token-set/ui-runtime-token-set.mjs';

const request = { contractId: provider.REQUEST_CONTRACT_ID };

test('uniform contract exports agree with the descriptor and capability declarations', () => {
  assert.equal(provider.descriptor.moduleContractId, 'ui-runtime-provider.v1');
  assert.equal(provider.descriptor.providerId, provider.providerId);
  assert.equal(provider.descriptor.operations[0].operationId, provider.toolId);
  assert.equal(provider.toolId, 'ui.tokens.resolve');
  assert.equal(provider.descriptor.operations[0].inputContractId, provider.REQUEST_CONTRACT_ID);
  assert.equal(provider.descriptor.operations[0].outputContractId, provider.OUTPUT_CONTRACT_ID);
  assert.equal(provider.descriptor.bindingState, 'UNBOUND');
  assert.equal(provider.capabilities[0].capabilityId, 'resolve-ui-token-set');
  assert.equal(provider.capabilities[0].platformCapabilityId, 'sda-ui-token-set-port.v1');
  assert.equal(typeof provider.invoke, 'function');
  assert.equal(provider.handle, provider.invoke);
  assert.equal(provider.inputShape.contractId, provider.REQUEST_CONTRACT_ID);
  assert.equal(provider.outputShape.contractId, provider.OUTPUT_CONTRACT_ID);
});

test('resolves the full site.v1 token set deterministically', () => {
  const first = provider.invoke(request);
  const second = provider.invoke(request);
  assert.equal(first.disposition, 'AUTHORED');
  assert.equal(first.providerId, provider.providerId);
  assert.equal(first.toolId, provider.toolId);
  assert.equal(first.providerExecution, 'deterministic');
  assert.equal(first.shapeConforms, true);
  assert.deepEqual(first.findings, []);
  assert.equal(first.candidate.contractId, provider.OUTPUT_CONTRACT_ID);
  assert.equal(first.candidate.tokenSetId, provider.TOKEN_SET_ID);
  assert.equal(first.candidate.derivedFrom, 'live-circuit/circuit/site.css:4-12');
  assert.equal(first.candidate.tokens.length, 17);
  assert.ok(first.candidate.tokens.every((token) => typeof token.value === 'string' && token.group && token.kind));
  assert.ok(first.candidate.tokens.some((token) => token.name === '--cyan' && token.value === '#72D7EE'));
  assert.ok(first.candidate.tokens.some((token) => token.name === '--radius' && token.value === '10px'));
  assert.deepEqual(first.candidate.aliases, provider.tokenSet.aliases);
  assert.match(first.candidate.digest, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(first.candidate, second.candidate);
});

test('selects by group and by name, resolving aliases and unioning selectors', () => {
  const byGroup = provider.invoke({ ...request, groups: ['accent'] });
  assert.equal(byGroup.disposition, 'AUTHORED');
  assert.deepEqual(byGroup.candidate.tokens.map((token) => token.name), ['--cyan', '--blue']);

  const byName = provider.invoke({ ...request, names: ['--observation', '--radius'] });
  assert.equal(byName.disposition, 'AUTHORED');
  assert.equal(byName.candidate.tokens.length, 2);
  const observation = byName.candidate.tokens.find((token) => token.name === '--observation');
  assert.equal(observation.value, '#72D7EE');
  assert.equal(observation.aliasOf, '--cyan');
  assert.equal(byName.candidate.tokens.find((token) => token.name === '--radius').value, '10px');

  const union = provider.invoke({ ...request, groups: ['accent'], names: ['--radius'] });
  assert.deepEqual(union.candidate.tokens.map((token) => token.name).sort(), ['--blue', '--cyan', '--radius']);
});

test('refuses malformed requests, unknown sets, groups and names by code', () => {
  const cases = [
    [null, 'UI_TOKEN_REQUEST_INVALID'],
    [{}, 'UI_TOKEN_REQUEST_INVALID'],
    [{ contractId: provider.REQUEST_CONTRACT_ID, extra: true }, 'UI_TOKEN_REQUEST_INVALID'],
    [{ ...request, tokenSetId: 'other.v1' }, 'UI_TOKEN_SET_UNKNOWN'],
    [{ ...request, groups: ['absent'] }, 'UI_TOKEN_GROUP_UNKNOWN'],
    [{ ...request, groups: 'accent' }, 'UI_TOKEN_REQUEST_INVALID'],
    [{ ...request, names: ['--absent'] }, 'UI_TOKEN_NAME_UNKNOWN'],
    [{ ...request, names: [7] }, 'UI_TOKEN_REQUEST_INVALID'],
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
  assert.equal(result.findings[0].code, 'UI_TOKEN_REQUEST_OVERSIZED');
  assert.equal(result.requestBytes, provider.MAX_REQUEST_BYTES + 1);
});
