#!/usr/bin/env node
// Formal verification: the Circuit Explorer, consuming its regions from the
// hosted UI provider API, renders and behaves exactly as it does with the same
// providers loaded in-process.
//   node scripts/verify-explorer-consumption.mjs [--platform <sfx-platform checkout>] [--ref <commit>] [--out <dir>]
// Inputs, all recorded in the receipt:
//   * the consumer: sfx-platform's live-circuit/ at --ref (default HEAD), archived
//     from git so uncommitted edits never take part; its circuit host serves the
//     Explorer, and its pinned retained scene and capture drive it;
//   * the providers: this checkout's ui-runtime-provider.v1 packages, hosted by
//     ui-providers-host.mjs on a local port (mode "hosted") and loaded in-process
//     by the platform host (modes "in-process" and its control repeat).
// In hosted mode the browser's region reads are answered from the hosted API
// only, after discovering which provider serves each region from its index and
// manifests; no provider or region is named here. Each mode runs the same
// steps; a step's normalized DOM must be stable across the in-process repeat
// before it is compared with hosted. Two fault injections must be detected:
// a tampered hosted asset (refused by the Explorer, by name) and different but
// valid hosted content (a DOM difference). Exit 1 if any assertion fails.
// Writes receipt.json, per-step DOM and screenshots, and report.html.
// Needs Playwright: SFX_BROWSER_TEST_MODULE (default: the platform's
// deploy/staging/test-tools install) and optionally SFX_BROWSER_EXECUTABLE.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const arg = (name, fallback) => { const index = process.argv.indexOf(name); return index > 0 ? process.argv[index + 1] : fallback; };
const platform = path.resolve(arg('--platform', path.join(root, '..', 'sfx-platform')));
const ref = arg('--ref', 'HEAD');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.resolve(arg('--out', path.join(root, 'outputs', 'explorer-consumption', stamp)));
const browserModule = process.env.SFX_BROWSER_TEST_MODULE ?? path.join(platform, 'deploy/staging/test-tools/node_modules/playwright/index.mjs');
const sha256 = value => 'sha256:' + createHash('sha256').update(value).digest('hex');
fs.mkdirSync(out, { recursive: true });

// --- inputs ------------------------------------------------------------------
const consumerCommit = execFileSync('git', ['-C', platform, 'rev-parse', ref], { encoding: 'utf8' }).trim();
const providerCommit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const providerDirty = execFileSync('git', ['-C', root, 'status', '--porcelain', '--', 'providers', 'src/ui-providers', 'ui-providers-host.mjs'], { encoding: 'utf8' }).trim() !== '';
const consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'explorer-consumer-'));
const archive = path.join(consumer, 'consumer.tar');
execFileSync('git', ['-C', platform, 'archive', '--format=tar', '-o', archive, consumerCommit, 'live-circuit', 'docs/replay-timing-fidelity']);
execFileSync('tar', ['-xf', archive, '-C', consumer]);
const sceneText = fs.readFileSync(path.join(consumer, 'docs/replay-timing-fidelity/scene.json'), 'utf8');
const scene = JSON.parse(sceneText);
const records = fs.readFileSync(path.join(consumer, 'docs/replay-timing-fidelity/capture.sse'), 'utf8')
  .split(/\r?\n/).filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
// The latest complete run of the scene's capability, exactly as "Replay latest run" selects it.
let selected = null, group = null;
for (const record of records) {
  if (record.kind === 'run-start') group = { records: [], graph: null, ended: false };
  if (!group) continue;
  group.records.push(record);
  if (record.payload?.graphId) group.graph = record.payload.graphId;
  if (record.kind === 'run-end') { group.ended = true; if (group.graph === 'graph:' + scene.capabilityId) selected = group; }
}
if (!selected) throw new Error('The retained capture holds no complete run of the scene capability');
const replayStream = selected.records.map(record => 'data: ' + JSON.stringify(record) + '\n\n').join('');

const spare = () => new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
async function startProcess(script, env, readyUrl) {
  const child = spawn(process.execPath, [script], { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null) throw new Error(`${path.basename(script)} exited: ${log.slice(-400)}`);
    try { if ((await fetch(readyUrl)).ok) return child; } catch { /* not listening yet */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  child.kill(); throw new Error(`${path.basename(script)} did not become ready: ${log.slice(-400)}`);
}
const hostPort = await spare(), platformPort = await spare();
const hostBase = `http://127.0.0.1:${hostPort}`, platformBase = `http://127.0.0.1:${platformPort}`;
const children = [];
const cleanup = () => { for (const child of children) if (child.exitCode === null) child.kill(); fs.rmSync(consumer, { recursive: true, force: true }); };
process.on('exit', cleanup);
children.push(await startProcess(path.join(root, 'ui-providers-host.mjs'), { PORT: String(hostPort), HOST: '127.0.0.1' }, hostBase + '/health'));
children.push(await startProcess(path.join(consumer, 'live-circuit/dispatch-pair/observe-server.mjs'), { OBSERVER_PORT: String(platformPort),
  SFX_UI_PROVIDER_DIR: path.join(root, 'providers'), SFX_PAGE_FIXTURE_DIR: path.join(consumer, 'live-circuit/circuit/fixtures/pages') }, platformBase + '/health'));

// The consumer's view of the hosted API: which provider serves each region,
// discovered from the index and each manifest's declared assets.
const index = await (await fetch(hostBase + '/ui-providers')).json();
const regionManifest = new Map(), manifests = [];
for (const listed of index.providers) {
  const manifest = await (await fetch(hostBase + listed.manifest)).json();
  manifests.push({ providerId: manifest.identity.providerId, version: manifest.version.version, digest: manifest.digest });
  if (manifest.contracts.some(contract => contract.operationId === 'ui.region.load'))
    for (const asset of manifest.integrity.assets) if (asset.regionId) regionManifest.set(asset.regionId, manifest);
}

// --- fault injections on the hosted response ------------------------------------
function regionBodyDigest(candidate) {
  return sha256(JSON.stringify({ contractId: candidate.contractId, providerId: candidate.providerId, regionProviderId: candidate.regionProviderId,
    regionId: candidate.regionId, role: candidate.role, place: candidate.place, basis: candidate.basis,
    assets: candidate.assets.map(a => ({ assetId: a.assetId, kind: a.kind, mediaType: a.mediaType, role: a.role, path: a.path, bytes: a.bytes, digest: a.digest, content: a.content })) }));
}
const FAULTS = {
  // Bytes changed in transit without their digests: the Explorer must refuse them.
  tampered: candidate => { const html = candidate.assets.find(a => a.kind === 'html'); html.content = html.content.replace('</', '<span>injected</span></'); },
  // A different, internally valid provider content: the DOM comparison must see it.
  altered: candidate => {
    const html = candidate.assets.find(a => a.kind === 'html');
    html.content = html.content.replace('</', '<small class="verification-marker">altered</small></');
    html.bytes = Buffer.byteLength(html.content, 'utf8'); html.digest = sha256(html.content); candidate.digest = regionBodyDigest(candidate);
  },
};

// --- one browser session per mode and sequence --------------------------------------
const { chromium } = await import(pathToFileURL(browserModule).href);
const browser = await chromium.launch({ executablePath: process.env.SFX_BROWSER_EXECUTABLE, headless: true });
const explorerUrl = platformBase + '/circuit/explorer?' + new URLSearchParams({ capability: scene.capabilityId, namespace: scene.namespaceId, scenario: scene.scenarioId, page: 'scenario-1' });
const normalize = html => html.replace(/\s+/g, ' ').replace(/blob:[^"]+/g, 'blob:<object-url>').replace(/data-replay-wall="[^"]*"/g, 'data-replay-wall="<wall-clock>"');

async function session(mode, { signedIn, fault = null, faultRegion = null }) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const evidence = { mode, errors: [], hostedReads: [], inProcessReads: 0, admission: null };
  page.on('pageerror', error => evidence.errors.push(error.message));
  await page.route('**/api/circuit/v1/scenario*', route => new URL(route.request().url()).searchParams.get('detailId')
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...scene, detailSlides: [], detail: { id: new URL(route.request().url()).searchParams.get('detailId'), kind: 'provider', status: 'DECLARED', body: { providerId: new URL(route.request().url()).searchParams.get('detailId').replace(/^provider:/, '') } } }) })
    : route.fulfill({ contentType: 'application/json', body: sceneText }));
  await page.route('**/api/circuit/v1/capabilities', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ capabilities: [{ capabilityId: scene.capabilityId, namespaceId: scene.namespaceId }] }) }));
  await page.route('**/api/circuit/v1/session', route => route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(signedIn ? { authenticated: true, observeRequiresSession: true, principalId: 'verification', identifier: 'Verification' } : { authenticated: false, observeRequiresSession: true }) })
    : route.continue());
  await page.route('**/api/circuit/v1/session/runs', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ principalId: 'verification', runs: [] }) }));
  await page.route('**/api/circuit/v1/runs', route => { evidence.admission = route.request().postDataJSON(); return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ disposition: 'SIGN_IN_REQUIRED' }) }); });
  await page.route('**/events*', route => route.fulfill({ status: 200, contentType: 'text/event-stream',
    body: new URL(route.request().url()).searchParams.get('run') === 'current' ? replayStream : ': verification; no live records\n\n' }));
  await page.route('**/api/circuit/v1/region*', async route => {
    const url = new URL(route.request().url()), regionId = url.searchParams.get('regionId');
    if (mode !== 'hosted') { evidence.inProcessReads++; return route.continue(); }
    const manifest = regionManifest.get(regionId);
    if (!manifest) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ disposition: 'HELD', candidate: null, findings: [{ code: 'UI_REGION_UNKNOWN', path: '$.regionId', message: 'Not hosted.' }] }) });
    const response = await fetch(hostBase + manifest.entrypoint.invoke + '?version=' + encodeURIComponent(manifest.version.version), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contractId: url.searchParams.get('contractId'), regionId }) });
    const body = await response.json();
    evidence.hostedReads.push({ regionId, status: response.status, servedBy: body.servedBy, candidateDigest: body.candidate?.digest ?? null });
    if (fault && regionId === faultRegion && body.candidate) FAULTS[fault](body.candidate);
    return route.fulfill({ status: response.status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return { context, page, evidence };
}
async function settle(page) {
  await page.waitForFunction(() => {
    const mounts = [...document.querySelectorAll('[data-region]')].filter(node => node.id && /^(region-|tree$|context$)/.test(node.id));
    return mounts.length > 0 && mounts.every(node => node.dataset.regionSource === 'declared' || node.dataset.regionFailure !== undefined);
  }, null, { timeout: 30000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}
async function snapshot(page, step, label) {
  const file = `${label}-${step}.png`;
  await page.screenshot({ path: path.join(out, file), fullPage: true });
  const state = await page.evaluate(() => ({
    regions: Object.fromEntries([...document.querySelectorAll('[data-region]')].filter(node => node.id && /^(region-|tree$|context$)/.test(node.id))
      .map(node => [node.id, node.dataset.regionSource === 'declared' ? 'declared' : `failure:${node.dataset.regionFailure}`])),
    digests: [...document.querySelectorAll('[data-region-digest]')].map(node => node.getAttribute('data-region-digest')),
    mode: document.querySelector('#mode')?.textContent ?? null,
    selectedTab: document.querySelector('[role=tab][aria-selected=true]')?.textContent ?? null,
    html: document.body.outerHTML }));
  const dom = normalize(state.html);
  fs.writeFileSync(path.join(out, `${label}-${step}.html`), dom);
  return { step, screenshot: file, regions: state.regions, digests: state.digests, mode: state.mode, selectedTab: state.selectedTab, domDigest: sha256(dom), domBytes: dom.length };
}
const OBJECTIVE = "What is Broadcom's current market price?";
// The same steps in every mode: the Explorer signed out and signed in, its
// context tabs, the provider drill-down, the objective composer and a replay of
// the retained run.
async function sequence(mode, label) {
  const steps = [], errors = [], hostedReads = [];
  let admission = null, inProcessReads = 0;
  for (const signedIn of [false, true]) {
    const { context, page, evidence } = await session(mode, { signedIn });
    await page.goto(explorerUrl); await settle(page);
    steps.push(await snapshot(page, signedIn ? 'explorer-signed-in' : 'explorer-signed-out', label));
    if (signedIn) {
      for (const tab of ['Runs', 'Evidence', 'Run']) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        steps.push(await snapshot(page, `tab-${tab.toLowerCase()}`, label));
      }
      const glyph = page.locator('.component-hit[data-kind="provider"]').filter({ visible: true }).first();
      const box = await glyph.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.locator('#declaration-detail').waitFor({ state: 'visible' });
      await page.waitForLoadState('networkidle').catch(() => {});
      steps.push(await snapshot(page, 'provider-drill-down', label));
      await page.locator('#close-detail').click();
      await page.locator('#replay').click();
      await page.waitForFunction(() => /SCENARIO REPLAY · 1× · finished/.test(document.querySelector('#mode')?.textContent ?? ''), null, { timeout: 120000 });
      steps.push(await snapshot(page, 'replay-finished', label));
    } else {
      await page.locator('#objective-input').fill(OBJECTIVE);
      await page.locator('#objective-run').click();
      await page.waitForFunction(() => (document.querySelector('#objective-run-status')?.textContent ?? '') !== '', null, { timeout: 30000 });
      steps.push(await snapshot(page, 'objective-submitted', label));
    }
    errors.push(...evidence.errors); hostedReads.push(...evidence.hostedReads); inProcessReads += evidence.inProcessReads;
    admission ??= evidence.admission;
    await context.close();
  }
  return { mode, label, steps, errors, hostedReads, inProcessReads, admission };
}
async function faultRun(fault) {
  const faultRegion = [...regionManifest.keys()][0];
  const { context, page, evidence } = await session('hosted', { signedIn: true, fault, faultRegion });
  await page.goto(explorerUrl); await settle(page);
  const shot = await snapshot(page, 'explorer-signed-in', `fault-${fault}`);
  await context.close();
  return { fault, faultRegion, ...shot, errors: evidence.errors };
}

// --- run and assert ------------------------------------------------------------------
const assertions = [];
const assert = (id, statement, pass, observed) => { assertions.push({ id, statement, pass: Boolean(pass), observed }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} · ${statement}`); };
let inProcess, control, hosted, faults = [];
try {
  inProcess = await sequence('in-process', 'in-process');
  control = await sequence('in-process', 'in-process-repeat');
  hosted = await sequence('hosted', 'hosted');
  faults = [await faultRun('tampered'), await faultRun('altered')];
} finally { await browser.close(); }

const regionIds = [...regionManifest.keys()];
const declaredEverywhere = run => run.steps.every(step => Object.values(step.regions).every(state => state === 'declared'));
assert('regions-declared', 'Every Explorer region mounts from declared content in every step, in both modes',
  declaredEverywhere(inProcess) && declaredEverywhere(hosted), { inProcess: inProcess.steps[0].regions, hosted: hosted.steps[0].regions });
assert('hosted-only', 'In hosted mode every region read was answered by the hosted API, none by the platform host',
  hosted.inProcessReads === 0 && hosted.hostedReads.length > 0 && hosted.hostedReads.every(read => read.status === 200 && read.servedBy),
  { hostedReads: hosted.hostedReads.length, platformReads: hosted.inProcessReads, regions: [...new Set(hosted.hostedReads.map(read => `${read.regionId}<-${read.servedBy?.providerId}@${read.servedBy?.version}`))] });
assert('hosted-coverage', 'Every region the hosted providers declare was consumed', regionIds.every(id => hosted.hostedReads.some(read => read.regionId === id)), { declared: regionIds });
assert('no-page-errors', 'No JavaScript errors in any mode', [inProcess, control, hosted].every(run => run.errors.length === 0),
  { inProcess: inProcess.errors, control: control.errors, hosted: hosted.errors });
const comparisons = inProcess.steps.map((step, index) => ({ step: step.step, stable: step.domDigest === control.steps[index].domDigest,
  identical: control.steps[index].domDigest === hosted.steps[index].domDigest, digests: JSON.stringify(step.digests) === JSON.stringify(hosted.steps[index].digests),
  inProcess: step.screenshot, hosted: hosted.steps[index].screenshot }));
assert('control-stable', 'Each step renders the same DOM when repeated in-process (the comparison is meaningful)', comparisons.every(c => c.stable),
  comparisons.filter(c => !c.stable).map(c => c.step));
assert('dom-identical', 'Each step renders the identical normalized DOM in hosted and in-process modes', comparisons.every(c => c.identical),
  comparisons.filter(c => !c.identical).map(c => c.step));
assert('region-digests-identical', 'The browser-verified region digests are identical in every step', comparisons.every(c => c.digests),
  comparisons.filter(c => !c.digests).map(c => c.step));
const expectedAdmission = { object: 'capability', operation: 'observe', subject: 'request-capability-from-objective-v3', namespace: 'sidefx:capabilities',
  input: { contractId: 'agent-objective-request.v1', payload: { objective: OBJECTIVE } } };
assert('objective-admission', 'The objective composer submits the same universal-capability admission in both modes',
  JSON.stringify(inProcess.admission) === JSON.stringify(hosted.admission) && JSON.stringify(hosted.admission) === JSON.stringify(expectedAdmission), { hosted: hosted.admission });
const replayStep = run => run.steps.find(step => step.step === 'replay-finished');
assert('replay-finished', 'Replay of the retained run finishes with the same final state in both modes',
  replayStep(hosted)?.mode === replayStep(inProcess)?.mode && /finished/.test(replayStep(hosted)?.mode ?? ''), { inProcess: replayStep(inProcess)?.mode, hosted: replayStep(hosted)?.mode });
const [tampered, altered] = faults;
assert('detects-tampering', `A hosted asset changed without its digest is refused by name (${tampered.faultRegion})`,
  Object.values(tampered.regions).some(state => /DIGEST_MISMATCH/.test(state)) && tampered.domDigest !== hosted.steps.find(s => s.step === 'explorer-signed-in').domDigest, tampered.regions);
assert('detects-different-content', `Different but valid hosted content is detected as a DOM difference (${altered.faultRegion})`,
  Object.values(altered.regions).every(state => state === 'declared') && altered.domDigest !== hosted.steps.find(s => s.step === 'explorer-signed-in').domDigest, altered.regions);

const passed = assertions.every(a => a.pass);
const receipt = { contractId: 'explorer-consumption-verification.v1', checkedAt: new Date().toISOString(), result: passed ? 'PASS' : 'FAIL',
  consumer: { repository: 'sfx-platform', commit: consumerCommit, scene: { capabilityId: scene.capabilityId, snapshotDigest: scene.snapshotDigest, digest: sha256(sceneText) }, replayRun: selected.records[0].runId ?? null },
  providers: { repository: 'sfx-providers', commit: providerCommit, uncommittedChanges: providerDirty, hosted: manifests },
  browser: { module: browserModule, executable: process.env.SFX_BROWSER_EXECUTABLE ?? 'playwright default' },
  assertions, comparisons, faults: faults.map(({ fault, faultRegion, regions, screenshot }) => ({ fault, faultRegion, regions, screenshot })) };
fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');

const escape = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
fs.writeFileSync(path.join(out, 'report.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Explorer consumption verification</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><style>
body{font:15px/1.5 system-ui,sans-serif;margin:24px;color:#111;background:#fff}h1{font-size:22px}h2{font-size:18px;margin-top:32px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
.pass{color:#0a6b2f;font-weight:600}.fail{color:#b00020;font-weight:600}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
figure{margin:0}figure img{width:100%;border:1px solid #ccc}figcaption{font-size:13px;color:#555}code{font-size:13px}
</style></head><body><h1>Explorer consumption verification — <span class="${passed ? 'pass' : 'fail'}">${receipt.result}</span></h1>
<p>Consumer <code>sfx-platform@${consumerCommit.slice(0, 12)}</code>; providers <code>sfx-providers@${providerCommit.slice(0, 12)}</code>${providerDirty ? ' with uncommitted provider changes' : ''}; hosted ${manifests.map(m => `<code>${escape(m.providerId)}@${escape(m.version)}</code>`).join(', ')}. Checked ${escape(receipt.checkedAt)}.</p>
<h2>Assertions</h2><table><tr><th>Assertion</th><th>Result</th><th>Observed</th></tr>${assertions.map(a => `<tr><td>${escape(a.statement)}</td><td class="${a.pass ? 'pass' : 'fail'}">${a.pass ? 'PASS' : 'FAIL'}</td><td><code>${escape(JSON.stringify(a.observed))}</code></td></tr>`).join('')}</table>
<h2>Steps: in-process (left) and hosted (right)</h2>${comparisons.map(c => `<h3>${escape(c.step)} — DOM ${c.identical ? 'identical' : 'DIFFERENT'}, repeat ${c.stable ? 'stable' : 'UNSTABLE'}</h3>
<div class="pair"><figure><img src="${c.inProcess}" alt="${escape(c.step)} in-process"><figcaption>in-process</figcaption></figure><figure><img src="${c.hosted}" alt="${escape(c.step)} hosted"><figcaption>hosted</figcaption></figure></div>`).join('')}
<h2>Fault injections (must be detected)</h2>${faults.map(f => `<h3>${escape(f.fault)} (${escape(f.faultRegion)})</h3><figure><img src="${f.screenshot}" alt="${escape(f.fault)}"><figcaption>${escape(JSON.stringify(f.regions))}</figcaption></figure>`).join('')}
</body></html>\n`);
console.log(`\n${receipt.result}: ${assertions.filter(a => a.pass).length}/${assertions.length} assertions · evidence ${out}`);
process.exitCode = passed ? 0 : 1;
