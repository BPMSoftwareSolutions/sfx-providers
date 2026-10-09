import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { loadUiProviders, MANIFEST_CONTRACT_ID, INDEX_CONTRACT_ID } from '../src/ui-providers/registry.mjs';
import { createUiProviderRequestHandler } from '../src/ui-providers/http.mjs';

// The hosted API, exercised over HTTP for every discovered UI runtime package.
const PROVIDERS = fileURLToPath(new URL('../providers/', import.meta.url));
const digestOf = (value) => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
const bytesDigest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

async function host(providers, options) {
  const handle = createUiProviderRequestHandler(providers, options);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!(await handle(req, res, url.pathname, url.searchParams))) { res.writeHead(404); res.end(); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}
const post = (url, body, headers = { 'content-type': 'application/json' }) => fetch(url, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('a configured provider credential protects invocation and accepts the governed carrier body shape', async()=>{
  const entries=await loadUiProviders(PROVIDERS), protectedHost=await host(entries,{invocationKey:'test-only-ui-provider-key'});
  try {
    const [id,entry]=[...entries][0],url=`${protectedHost.base}/ui-providers/${id}/invoke`,input=requestsOf(entry)[0];
    for(const key of [null,'wrong']) {
      const response=await post(url,input,{'content-type':'application/json',...(key?{'x-sfx-provider-key':key}:{})});
      assert.equal(response.status,401);assert.equal((await response.json()).error,'UI_PROVIDER_CREDENTIAL_REQUIRED');
    }
    const response=await fetch(url,{method:'POST',headers:{'x-sfx-provider-key':'test-only-ui-provider-key'},body:Buffer.from(JSON.stringify(input))});
    assert.equal(response.status,200);assert.equal((await response.json()).disposition,'AUTHORED');
    const manifest=await fetch(`${protectedHost.base}/ui-providers/${id}/manifest`);assert.equal(manifest.status,200);await manifest.body.cancel();
  } finally {await protectedHost.close();}
});
// A minimal valid request for each operation, from the package's own contracts:
// the input contract, plus each declared region for region providers.
function requestsOf(entry) {
  const contractId = entry.module.inputShape?.contractId;
  if (contractId === 'ui-page.v1') return [JSON.parse(readFileSync(new URL('./fixtures/ui-view-read.json',import.meta.url),'utf8'))];
  const regions = (entry.module.contentManifest?.regions ?? []).map((region) => region.regionId);
  return regions.length ? regions.map((regionId) => ({ contractId, regionId })) : [{ contractId }];
}

let providers, server;
before(async () => { providers = await loadUiProviders(PROVIDERS); server = await host(providers); });
after(async () => { await server?.close(); });

test('every UI runtime package is discovered and listed in the index', async () => {
  assert(providers.size >= 1, 'At least one ui-runtime-provider.v1 package is hosted');
  const index = await (await fetch(`${server.base}/ui-providers`)).json();
  assert.equal(index.contractId, INDEX_CONTRACT_ID);
  assert.deepEqual(index.providers.map((p) => p.providerId).sort(), [...providers.keys()].sort());
  const { digest, ...body } = index; assert.equal(digest, digestOf(body));
  for (const listed of index.providers) assert.equal(listed.manifestDigest, providers.get(listed.providerId).manifest.digest);
});

test('each manifest carries identity, version, contracts, entrypoint and integrity, and its digest recomputes', async () => {
  for (const [providerId, entry] of providers) {
    const response = await fetch(`${server.base}/ui-providers/${encodeURIComponent(providerId)}/manifest`);
    assert.equal(response.status, 200);
    const manifest = await response.json();
    assert.equal(manifest.contractId, MANIFEST_CONTRACT_ID);
    assert.equal(manifest.identity.providerId, providerId);
    assert.equal(manifest.version.version, entry.module.descriptor.version);
    assert.equal(response.headers.get('x-ui-provider'), `${providerId}@${entry.module.descriptor.version}`);
    assert.deepEqual(manifest.contracts.map((c) => c.operationId), entry.module.descriptor.operations.map((o) => o.operationId));
    assert.equal(manifest.entrypoint.module, `providers/${entry.name}/${entry.name}.mjs`);
    const { digest, ...body } = manifest; assert.equal(digest, digestOf(body), `${providerId} manifest digest`);
    // Repeat reads are byte-stable while the package is unchanged.
    assert.equal(await (await fetch(`${server.base}/ui-providers/${encodeURIComponent(providerId)}/manifest`)).text(), JSON.stringify(manifest));
  }
});

test('every declared asset is served only as its declared, verified bytes', async () => {
  for (const [providerId, entry] of providers) for (const asset of entry.assets.values()) {
    const plain = await fetch(`${server.base}/ui-providers/${encodeURIComponent(providerId)}/assets/${encodeURIComponent(asset.assetId)}`);
    assert.equal(plain.status, 200);
    const bytes = Buffer.from(await plain.arrayBuffer());
    assert.equal(bytesDigest(bytes), asset.digest); assert.equal(bytes.length, asset.bytes);
    assert.equal(plain.headers.get('x-content-digest'), asset.digest);
    assert(plain.headers.get('content-type').startsWith(asset.mediaType));
    assert.equal(plain.headers.get('cache-control'), 'no-cache');
    const addressed = await fetch(server.base + asset.url);
    assert.equal(addressed.status, 200); await addressed.body.cancel();
    assert.equal(addressed.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    const revalidated = await fetch(server.base + asset.url, { headers: { 'if-none-match': `"${asset.digest}"` } });
    assert.equal(revalidated.status, 304);
    const stale = await fetch(`${server.base}/ui-providers/${encodeURIComponent(providerId)}/assets/${encodeURIComponent(asset.assetId)}?digest=sha256:${'0'.repeat(64)}`);
    assert.equal(stale.status, 409); assert.equal((await stale.json()).error, 'UI_PROVIDER_ASSET_DIGEST_STALE');
  }
});

test('invoke over HTTP returns exactly the in-process result, with the serving identity', async () => {
  for (const [providerId, entry] of providers) for (const request of requestsOf(entry)) {
    const response = await post(`${server.base}/ui-providers/${encodeURIComponent(providerId)}/invoke`, request);
    const body = await response.json();
    // elapsedMs is measured wall time, not content; everything else must match.
    const { servedBy, elapsedMs, ...result } = body;
    assert.equal(response.status, 200, `${providerId} ${JSON.stringify(request)}: ${JSON.stringify(body.findings)}`);
    assert.equal(result.disposition, 'AUTHORED');
    const { elapsedMs: inProcessElapsed, ...inProcess } = await entry.module.invoke(request, { requestBytes: Buffer.byteLength(JSON.stringify(request)) });
    assert.deepEqual(result, inProcess);
    assert(Number.isInteger(elapsedMs) && Number.isInteger(inProcessElapsed));
    assert.deepEqual(servedBy, { providerId, version: entry.module.descriptor.version, operationId: entry.manifest.entrypoint.operations[0], manifestDigest: entry.manifest.digest });
  }
});

test('provider refusals keep their names and HTTP meaning; the host refuses by name', async () => {
  for (const [providerId, entry] of providers) {
    const invoke = `${server.base}/ui-providers/${encodeURIComponent(providerId)}/invoke`;
    const invalid = await post(invoke, { contractId: 'not-a-contract.v0' });
    assert.equal(invalid.status, 400); assert.match((await invalid.json()).findings[0].code, /_REQUEST_INVALID$/);
    const oversized = await post(invoke, { contractId: entry.module.inputShape.contractId, padding: 'x'.repeat(entry.manifest.entrypoint.maxRequestBytes) });
    assert.equal(oversized.status, 413); assert.equal((await oversized.json()).error, 'UI_PROVIDER_REQUEST_OVERSIZED');
    const notJson = await post(invoke, '{', { 'content-type': 'application/json' });
    assert.equal(notJson.status, 400); assert.equal((await notJson.json()).error, 'UI_PROVIDER_REQUEST_INVALID');
    const wrongType = await post(invoke, 'x', { 'content-type': 'text/plain' });
    assert.equal(wrongType.status, 415);
    const get = await fetch(invoke); assert.equal(get.status, 405); assert.equal(get.headers.get('allow'), 'POST'); await get.body.cancel();
    const operation = await post(`${invoke}?operation=no.such.operation`, { contractId: entry.module.inputShape.contractId });
    assert.equal(operation.status, 400); assert.equal((await operation.json()).error, 'UI_PROVIDER_OPERATION_UNKNOWN');
    const pinned = await fetch(`${server.base}/ui-providers/${encodeURIComponent(providerId)}/manifest?version=${entry.module.descriptor.version}`);
    assert.equal(pinned.status, 200); await pinned.body.cancel();
    const otherVersion = await fetch(`${server.base}/ui-providers/${encodeURIComponent(providerId)}/manifest?version=999.0.0`);
    assert.equal(otherVersion.status, 409); assert.equal((await otherVersion.json()).error, 'UI_PROVIDER_VERSION_UNAVAILABLE');
    const unknownAsset = await fetch(`${server.base}/ui-providers/${encodeURIComponent(providerId)}/assets/no-such-asset.css`);
    assert.equal(unknownAsset.status, 404); assert.equal((await unknownAsset.json()).error, 'UI_PROVIDER_ASSET_UNKNOWN');
  }
  const unknown = await fetch(`${server.base}/ui-providers/no-such-provider/manifest`);
  assert.equal(unknown.status, 404); assert.equal((await unknown.json()).error, 'UI_PROVIDER_UNKNOWN');
  const route = await fetch(`${server.base}/ui-providers/no-such-provider/elsewhere`);
  assert.equal(route.status, 404); assert.equal((await route.json()).error, 'UI_PROVIDER_ROUTE_UNKNOWN');
});

test('asset bytes changed after loading are refused, never served', async () => {
  const [providerId, entry] = [...providers].find(([, candidate]) => candidate.assets.size > 0);
  const directory = mkdtempSync(path.join(tmpdir(), 'ui-provider-host-'));
  try {
    cpSync(entry.packageRoot, path.join(directory, entry.name), { recursive: true });
    const copied = new Map([[providerId, { ...entry, packageRoot: path.join(directory, entry.name) }]]);
    const asset = [...entry.assets.values()].find(asset => asset.path.startsWith('assets/'));
    writeFileSync(path.join(directory, entry.name, asset.path), 'tampered');
    const tampered = await host(copied);
    try {
      const response = await fetch(`${tampered.base}/ui-providers/${encodeURIComponent(providerId)}/assets/${encodeURIComponent(asset.assetId)}`);
      assert.equal(response.status, 500); assert.equal((await response.json()).error, 'UI_PROVIDER_ASSET_DIGEST_MISMATCH');
    } finally { await tampered.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('a package claiming the module contract without its members, or a duplicate identity, refuses the host', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ui-provider-registry-'));
  try {
    const write = (name, source) => { mkdirSync(path.join(directory, name), { recursive: true }); writeFileSync(path.join(directory, name, `${name}.mjs`), source); };
    write('incomplete', "export const descriptor = { moduleContractId: 'ui-runtime-provider.v1', providerId: 'x', version: '1.0.0', operations: [] };\n");
    await assert.rejects(loadUiProviders(directory), /UI_PROVIDER_PACKAGE_INVALID: incomplete/);
    rmSync(path.join(directory, 'incomplete'), { recursive: true, force: true });
    const valid = (id) => `export const descriptor = { moduleContractId: 'ui-runtime-provider.v1', providerId: '${id}', package: 'providers/${id}', version: '1.0.0', operations: [{ operationId: 'op' }] };\nexport function invoke() {}\n`;
    write('first', valid('first')); write('second', valid('first'));
    await assert.rejects(loadUiProviders(directory), /UI_PROVIDER_DUPLICATE: first/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('a provider whose folder does not match its declared identity refuses hosting', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ui-provider-identity-'));
  try {
    mkdirSync(path.join(directory, 'aggregate'));
    writeFileSync(path.join(directory, 'aggregate', 'aggregate.mjs'), "export const descriptor={moduleContractId:'ui-runtime-provider.v1',providerId:'declared-provider',package:'providers/declared-provider',version:'1.0.0',operations:[{operationId:'read'}]};export function invoke(){};");
    await assert.rejects(loadUiProviders(directory), /UI_PROVIDER_IDENTITY_MISMATCH/);
  } finally { rmSync(directory, {recursive:true,force:true}); }
});

test('the deployable host serves only the UI provider API and its health', async () => {
  const { startUiProviderHost } = await import('../ui-providers-host.mjs');
  const { server: deployable, port, providers: served } = await startUiProviderHost({ port: 0, host: '127.0.0.1' });
  try {
    const base = `http://127.0.0.1:${port}`;
    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.status, 'ok'); assert.deepEqual(health.uiProviders, served);
    assert.equal((await fetch(`${base}/ui-providers`)).status, 200);
    // Altitude, audio and presentation providers are never reachable here.
    for (const route of ['/altitude-01/health', '/audio-to-text/health', '/circuit-presentation/health']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 404, route); await response.body.cancel();
    }
  } finally { await new Promise((resolve) => deployable.close(resolve)); }
});
