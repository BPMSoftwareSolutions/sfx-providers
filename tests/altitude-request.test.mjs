import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMBEDDED_CONTEXT_MEMBERS,
  MAX_REQUEST_BYTES,
  REQUEST_CONTRACT_ID,
  requestBytesOf,
} from '../src/request-contract.mjs';

const providers = [];
for (let index = 1; index <= 11; index += 1) {
  const file = `altitude-${String(index).padStart(2, '0')}.mjs`;
  const folder = file.replace(/\.mjs$/, '');
  providers.push(await import(new URL(`../providers/${folder}/${file}`, import.meta.url)));
}

function compactRequest(provider) {
  return {
    altitude: provider.altitude,
    toolId: provider.toolId,
    objective: `Author the ${provider.altitudeName} artifact for the compact-request bridge test`,
    inputContractId: provider.inputShape.toolInputContract?.contractId ?? REQUEST_CONTRACT_ID,
    contextRefs: [
      { kind: 'contract', id: provider.outputShape.contractId, digest: `sha256:${'a'.repeat(64)}` },
      { kind: 'precedent', id: `altitude-${provider.altitude}-precedent`, digest: `sha256:${'b'.repeat(64)}` },
    ],
    contextSlices: [
      { ref: `sha256:${'a'.repeat(64)}`, document: { note: 'bounded selection', altitude: provider.altitude } },
    ],
  };
}

for (const provider of providers) {
  const label = `altitude-${String(provider.altitude).padStart(2, '0')}`;

  test(`${label} accepts the compact request shape`, () => {
    const outcome = provider.handle(compactRequest(provider));
    assert.equal(outcome.disposition, 'AUTHORED');
    assert.deepEqual(outcome.findings, []);
    assert.ok(outcome.candidate, 'candidate is present');
    assert.equal(outcome.candidate.contractId, provider.outputShape.contractId);
  });

  test(`${label} measures a sample request under the 256 KB cap`, () => {
    const bytes = requestBytesOf(compactRequest(provider));
    assert.ok(bytes <= MAX_REQUEST_BYTES, `sample request is ${bytes} bytes, expected <= ${MAX_REQUEST_BYTES}`);
  });

  test(`${label} refuses an oversized body with ALTITUDE_REQUEST_OVERSIZED`, () => {
    const request = compactRequest(provider);
    request.contextSlices = [{ ref: `sha256:${'c'.repeat(64)}`, document: { blob: 'x'.repeat(MAX_REQUEST_BYTES) } }];
    const outcome = provider.handle(request);
    assert.equal(outcome.disposition, 'HELD');
    assert.equal(outcome.candidate, null);
    assert.ok(outcome.findings.some((finding) => finding.code === 'ALTITUDE_REQUEST_OVERSIZED'));
  });

  test(`${label} refuses each embedded context member with ALTITUDE_REQUEST_EMBEDDED_CONTEXT`, () => {
    for (const member of EMBEDDED_CONTEXT_MEMBERS) {
      const request = { ...compactRequest(provider), [member]: { documents: ['x'.repeat(1024)] } };
      const outcome = provider.handle(request);
      assert.equal(outcome.disposition, 'HELD', member);
      assert.equal(outcome.candidate, null, member);
      assert.ok(
        outcome.findings.some(
          (finding) => finding.code === 'ALTITUDE_REQUEST_EMBEDDED_CONTEXT' && finding.path === `$.${member}`,
        ),
        member,
      );
    }
  });

  test(`${label} refuses legacy embedded payload members`, () => {
    const request = { ...compactRequest(provider), payload: { capabilityId: 'legacy-envelope' } };
    const outcome = provider.handle(request);
    assert.equal(outcome.disposition, 'HELD');
    assert.ok(outcome.findings.some((finding) => finding.code === 'ALTITUDE_REQUEST_UNKNOWN_MEMBER'));
  });
}

