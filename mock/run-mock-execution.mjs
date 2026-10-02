#!/usr/bin/env node
// Mock execution harness (Route A of the executable-verification review).
// Runs one declared capability through the Node kernel ground with fixture
// backed physical seams; see mock/README.md. Test tooling only: it reads the
// live estate and writes nothing durably outside its own run directory.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMockFetch, wrapReadQuery } from './providers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { fixture: 'gemini-success', allowLiveFetch: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--allow-live-fetch') { args.allowLiveFetch = true; continue; }
    if (!token.startsWith('--')) throw new Error(`Unknown argument '${token}'`);
    const key = token.slice(2).replaceAll('-', '_');
    const value = argv[++index];
    if (value === undefined) throw new Error(`Missing value for '${token}'`);
    args[key] = value;
  }
  return args;
}

async function resolveSdaRoot(args) {
  const candidates = [
    args.sda_root,
    process.env.SFX_SDA_ROOT,
    path.resolve(here, '..', '..', 'scenario-driven-architecture')
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    try {
      await fs.access(path.join(resolved, 'languages', 'typescript', 'src', 'kernel', 'bootstrap', 'invocation-boot.mjs'));
      return resolved;
    } catch { /* try the next candidate */ }
  }
  throw new Error('SDA_ROOT_NOT_FOUND: pass --sda-root or set SFX_SDA_ROOT');
}

function loadFixture(name) {
  const candidate = name.includes('/') || name.includes('\\') ? name : path.join(here, 'fixtures', `${name}.json`);
  return fs.readFile(path.resolve(candidate), 'utf8').then(JSON.parse);
}

async function importSda(modulePath) {
  return import(pathToFileURL(modulePath).href);
}

const args = parseArgs(process.argv.slice(2));
if (!args.capability_id || !args.input) {
  console.error('usage: node mock/run-mock-execution.mjs --capability-id <id> --input <file> [--fixture name] [--sda-root path] [--allow-live-fetch]');
  process.exitCode = 2;
} else {
  const startedAt = new Date().toISOString();
  const outcome = { fixture: args.fixture, capabilityId: args.capability_id, startedAt };
  try {
    const sdaRoot = await resolveSdaRoot(args);
    const fixture = await loadFixture(args.fixture);
    const input = JSON.parse(await fs.readFile(path.resolve(args.input), 'utf8'));
    const hits = { fetch: [], read: [] };
    const mockFetch = createMockFetch(fixture, hits);
    const liveFetch = globalThis.fetch;
    const effectiveFetch = args.allow_live_fetch
      ? async (url, options) => {
        const href = typeof url === 'string' ? url : url?.url ?? String(url);
        const matched = (fixture.fetch ?? []).some(entry => href.includes(entry.match));
        return matched ? mockFetch(url, options) : liveFetch(url, options);
      }
      : mockFetch;

    const { readKernelBootConfiguration } = await importSda(path.join(sdaRoot, 'languages/typescript/src/kernel/bootstrap/runtime-configuration.mjs'));
    const { createDatabaseConnectBoundary, connectionString, sql } = await importSda(path.join(sdaRoot, 'languages/typescript/src/kernel/bootstrap/database-connect-boundary.mjs'));
    const { withDatabaseReadSession, pinModel, normalizeSql, stable, hash, digest } = await importSda(path.join(sdaRoot, 'languages/typescript/src/kernel/bootstrap/database-read-session.mjs'));
    const { invokeDeclaredCapabilityInSession } = await importSda(path.join(sdaRoot, 'languages/typescript/src/kernel/bootstrap/invocation-boot.mjs'));

    const config = readKernelBootConfiguration();
    const connect = createDatabaseConnectBoundary({
      sql,
      connectionString: await connectionString(config),
      connectionName: config.connectionCredentialReference,
      requestTimeoutMs: config.requestTimeoutMs
    });
    const observations = { phases: 0, testimony: 0, cellTestimony: 0, edgeTestimony: 0 };
    const execution = await withDatabaseReadSession(
      { connect, sql, pinModel, normalizeSql, stable, hash, digest, queryRowLimit: config.queryRowLimit },
      (readQuery, sessionEvidence) => invokeDeclaredCapabilityInSession({
        request: { subject: args.capability_id, input },
        sdaRoot: config.sdaRoot,
        credentialVault: config.credentialVault,
        readQuery: wrapReadQuery(readQuery, fixture, hits),
        sessionEvidence,
        effectContextOverrides: { fetch: effectiveFetch },
        onObservation: () => { observations.phases += 1; },
        onTestimony: testimony => {
          observations.testimony += 1;
          if (testimony?.testimonyType === 'cell-execution-testimony.v1') observations.cellTestimony += 1;
          if (testimony?.testimonyType === 'edge-execution-testimony.v1') observations.edgeTestimony += 1;
        }
      }));

    const result = execution.outcome.result;
    const serialized = JSON.stringify(result);
    const expect = fixture.expect ?? {};
    const checks = [];
    if (expect.disposition !== undefined) checks.push({ check: 'disposition', expected: expect.disposition, actual: result?.disposition, passed: result?.disposition === expect.disposition });
    for (const needle of expect.outcomeContains ?? []) {
      checks.push({ check: 'outcomeContains', expected: needle, passed: serialized.includes(needle) });
    }
    for (const [seam, minimum] of Object.entries(expect.mockHits ?? {})) {
      checks.push({ check: `mockHits.${seam}`, expected: minimum, actual: hits[seam].length, passed: hits[seam].length >= minimum });
    }
    outcome.disposition = result?.disposition;
    outcome.mockHits = { fetch: hits.fetch, read: hits.read, unmatched: hits.unmatched ?? [] };
    outcome.observations = observations;
    outcome.checks = checks;
    outcome.result = result;
    outcome.sessionEvidence = execution.outcome.evidence?.readSession ?? null;
    outcome.passed = checks.every(entry => entry.passed);
    if (fixture.finding) outcome.finding = fixture.finding;
    outcome.completedAt = new Date().toISOString();
  } catch (error) {
    outcome.error = { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : null };
    outcome.passed = false;
    outcome.completedAt = new Date().toISOString();
  }
  const outputDir = path.resolve(args.output ?? path.join(here, 'runs'));
  await fs.mkdir(outputDir, { recursive: true });
  const resultFile = path.join(outputDir, `${String(args.fixture).replaceAll(/[^a-zA-Z0-9._-]/g, '_')}-${startedAt.replaceAll(/[:.]/g, '-')}.json`);
  await fs.writeFile(resultFile, `${JSON.stringify(outcome, null, 2)}\n`, 'utf8');

  console.log(`MOCK fixture=${outcome.fixture} capability=${outcome.capabilityId}`);
  console.log(`MOCK hits fetch=${outcome.mockHits?.fetch.length ?? 0} read=${outcome.mockHits?.read.length ?? 0} unmatched=${outcome.mockHits?.unmatched?.length ?? 0} observations=${JSON.stringify(outcome.observations ?? {})}`);
  if (outcome.finding) console.log(`MOCK finding ${outcome.finding}`);
  if (outcome.error) console.error(`MOCK error ${outcome.error.message}`);
  if (outcome.disposition) console.log(`MOCK disposition ${outcome.disposition}`);
  for (const entry of outcome.checks ?? []) {
    console.log(`MOCK check ${entry.check} expected=${JSON.stringify(entry.expected)} actual=${JSON.stringify(entry.actual)} ${entry.passed ? 'PASS' : 'FAIL'}`);
  }
  console.log(`MOCK evidence ${resultFile}`);
  console.log(outcome.passed ? 'OK' : 'FAILED');
  if (!outcome.passed) process.exitCode = 1;
}
