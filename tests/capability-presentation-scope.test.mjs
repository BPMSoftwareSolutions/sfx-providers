import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rawFixture } from './fixtures/capability-presentation.mjs';
import { normalizeSnapshot } from '../src/capability-presentation/snapshot.mjs';
import { handle, inputShape } from '../src/capability-presentation/provider.mjs';

// Synthetic identities deliberately differ from the retained demonstration
// decks. No external capability is executed by these generation tests.
function selectedFixture(capabilityId, namespaceId) {
  const raw = rawFixture();
  raw.capability.capability_id = capabilityId;
  raw.capability.namespace_id = namespaceId;
  raw.capability.name = capabilityId;
  raw.graph.capabilityId = capabilityId;
  return raw;
}

test('one request selects only its root and cannot reuse a previous capability or namespace', async () => {
  const requests = [
    { capabilityId: 'inspect-sample', namespaceId: 'test:lab' },
    { capabilityId: 'inspect-sample', namespaceId: 'test:field' },
    { capabilityId: 'dispatch-parcel', namespaceId: 'test:delivery' },
  ];
  const snapshots = requests.map((request, index) => {
    const raw = selectedFixture(request.capabilityId, request.namespaceId);
    raw.capability.intent = `Source intent for selection ${index}`;
    raw.graph.interfaceAuthority.portBindings.push({ portId: `retained-${index}`, platformCapabilityId: `source-platform-${index}`, configuration: {} });
    return normalizeSnapshot(raw);
  });
  const calls = [];
  const readEstate = async request => {
    calls.push(request);
    const index = requests.findIndex(r => r.capabilityId === request.capabilityId && r.namespaceId === request.namespaceId);
    assert.notEqual(index, -1, 'No implicit selection of another capability');
    return snapshots[index];
  };
  const digests = [];
  for (const index of [0, 1, 2, 0]) {
    const result = await handle({ contractId: inputShape.contractId, ...requests[index] }, { readEstate });
    assert.equal(result.disposition, 'AUTHORED', JSON.stringify(result.findings));
    const deck = result.candidate;
    assert.deepEqual(deck.snapshot, snapshots[index]);
    assert.equal(deck.capabilityId, requests[index].capabilityId);
    assert.equal(deck.storyboard.blueprint.snapshotDigest, snapshots[index].snapshotDigest);
    assert.equal(deck.storyboard.slides.filter(s => s.blueprint?.role === 'overview').length, 1);
    assert.deepEqual(deck.storyboard.contexts.map(c => c.altitude), [1,2,3,4,5,6,7,8,9,10,11]);
    for (let other = 0; other < snapshots.length; other++) {
      assert.equal(deck.storyboard.blueprint.nodes.some(n => n.id === `binding:retained-${other}`), other === index);
    }
    digests.push(deck.contentDigest);
  }
  assert.deepEqual(calls, [requests[0], requests[1], requests[2], requests[0]]);
  assert.equal(new Set(digests.slice(0, 3)).size, 3);
  assert.equal(digests[0], digests[3], 'Replay does not depend on the previous request');
});

test('prose naming another capability cannot resolve a runtime selector or add a second blueprint', async () => {
  const request = { capabilityId: 'invoke-selected-work', namespaceId: 'test:runtime' };
  const raw = selectedFixture(request.capabilityId, request.namespaceId);
  raw.capability.intent = 'Invoke a selected capability. An example is inspect-sample.';
  raw.graph.interfaceAuthority.portBindings[0].configuration = { capabilityIdPath: 'capabilityId', requestPath: 'input', resultPath: 'result' };
  const snapshot = normalizeSnapshot(raw), calls = [];
  const result = await handle({ contractId: inputShape.contractId, ...request }, { readEstate: async selection => {
    calls.push(selection);
    assert.deepEqual(selection, request);
    return snapshot;
  } });
  assert.equal(result.disposition, 'AUTHORED', JSON.stringify(result.findings));
  assert.deepEqual(calls, [request]);
  const story = result.candidate.storyboard;
  assert.equal(story.slides.filter(s => s.blueprint?.role === 'overview').length, 1);
  assert.deepEqual(story.blueprint.references.filter(n => n.code === 'RUNTIME_TARGET_UNRESOLVED').map(n => n.targetId), ['capabilityId']);
  assert.ok(!story.blueprint.nodes.some(n=>n.kind==='dynamic'));
  assert.ok(!story.blueprint.nodes.some(n => n.label === 'inspect-sample'));
  assert.deepEqual(story.blueprint.scenarios.map(s => s.id), snapshot.scenarios.map(s => s.id));
});

test('capability-id CLI selects through the estate host and records the selection without a snapshot argument', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'sfx-capability-scope-'));
  try {
    const request = { capabilityId: 'route-laboratory-sample', namespaceId: 'test:lab' };
    const raw = selectedFixture(request.capabilityId, request.namespaceId);
    const records = [[raw.capability], [{ graph_source: JSON.stringify(raw.graph) }], [], raw.features, raw.fixtures, raw.obligations, raw.altitudeCatalog, [], []];
    await fs.writeFile(path.join(temp, 'records.json'), JSON.stringify(records));
    // Exercise the normal SQL-reader boundary without requiring a live database.
    const host = path.join(temp, 'host.mjs');
    await fs.writeFile(host, `import fs from 'node:fs/promises';
const calls = [];
export async function openSql() {
  return { pool: { close: async () => fs.writeFile(new URL('./calls.json', import.meta.url), JSON.stringify(calls)) }, sql: {
    NVarChar: n => n, ISOLATION_LEVEL: { SNAPSHOT: 'SNAPSHOT' },
    Transaction: class { async begin() {} async rollback() {} },
    Request: class {
      input(name, type, value) { calls.push({ name, value }); return this; }
      async query() { return { recordsets: JSON.parse(await fs.readFile(new URL('./records.json', import.meta.url), 'utf8')) }; }
    }
  } };
}
`);
    const output = path.join(temp, 'deck');
    const cli = fileURLToPath(new URL('../capability-deck.mjs', import.meta.url));
    const result = await promisify(execFile)(process.execPath, [cli, '--capability-id', request.capabilityId, '--namespace-id', request.namespaceId, '--output', output], {
      cwd: temp, env: { ...process.env, CAPABILITY_ESTATE_HOST_MODULE: host },
    });
    assert.equal(JSON.parse(result.stdout).capabilityId, request.capabilityId);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(temp, 'calls.json'), 'utf8')), [
      { name: 'capability_id', value: request.capabilityId }, { name: 'namespace_id', value: request.namespaceId },
    ]);
    const receipt = JSON.parse(await fs.readFile(path.join(output, 'receipt.json'), 'utf8'));
    assert.equal(receipt.request.capabilityId, request.capabilityId);
    assert.equal(receipt.request.namespaceId, request.namespaceId);
    assert.deepEqual(receipt.selection, {
      ...request, estateModelId: '42', capabilityVersionPk: '9', rootScenarioId: 'review',
    });
    const snapshot = JSON.parse(await fs.readFile(path.join(output, 'snapshot.json'), 'utf8'));
    assert.equal(receipt.snapshotDigest, snapshot.snapshotDigest);
    const blueprint = JSON.parse(await fs.readFile(path.join(output, 'circuit-blueprint.json'), 'utf8'));
    assert.equal(blueprint.capabilityId, request.capabilityId);
    assert.equal(blueprint.snapshotDigest, snapshot.snapshotDigest);
  } finally {
    const resolved = await fs.realpath(temp);
    assert.equal(path.dirname(resolved), await fs.realpath(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('sfx-capability-scope-'));
    await fs.rm(resolved, { recursive: true, force: true });
  }
});
