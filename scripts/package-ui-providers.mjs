#!/usr/bin/env node
// Builds the deployable UI provider host bundle:
//   node scripts/package-ui-providers.mjs <fresh-output-directory>
// It contains ui-providers-host.mjs, src/ui-providers/, a minimal package.json,
// and exactly the provider packages the host would serve (those declaring the
// ui-runtime-provider.v1 module contract), discovered rather than named. No
// altitude, audio, presentation or login provider is copied. deployment.json
// records the source commit, whether the working tree was clean, and every
// hosted provider's version and manifest digest; the host reports it on /health.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadUiProviders } from '../src/ui-providers/registry.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!output) throw new Error('Supply a fresh output directory');
if (existsSync(output)) throw new Error(`FRESH_OUTPUT_DIRECTORY_REQUIRED: ${output}`);

const providers = await loadUiProviders(path.join(root, 'providers'));
if (providers.size === 0) throw new Error('UI_PROVIDERS_REQUIRED: no ui-runtime-provider.v1 package was found');
mkdirSync(path.join(output, 'providers'), { recursive: true });
cpSync(path.join(root, 'ui-providers-host.mjs'), path.join(output, 'ui-providers-host.mjs'));
cpSync(path.join(root, 'src', 'ui-providers'), path.join(output, 'src', 'ui-providers'), { recursive: true });
for (const entry of providers.values()) cpSync(entry.packageRoot, path.join(output, 'providers', entry.name), { recursive: true });
const source = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
writeFileSync(path.join(output, 'package.json'), JSON.stringify({ name: 'sfx-ui-providers', version: source.version, private: true, type: 'module',
  engines: source.engines, scripts: { start: 'node ui-providers-host.mjs' } }, null, 2) + '\n');

const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const dirty = git('status', '--porcelain', '--untracked-files=all', '--', 'ui-providers-host.mjs', 'src/ui-providers',
  ...[...providers.values()].map((entry) => `providers/${entry.name}`)) !== '';
const deployment = { contractId: 'ui-provider-deployment.v1', builtAt: new Date().toISOString(), sourceCommit: git('rev-parse', 'HEAD'), dirty,
  providers: [...providers.values()].map(({ manifest }) => ({ providerId: manifest.identity.providerId, version: manifest.version.version, manifestDigest: manifest.digest })) };
writeFileSync(path.join(output, 'deployment.json'), JSON.stringify(deployment, null, 2) + '\n');

// The bundle must host exactly what was discovered here.
const bundled = await loadUiProviders(path.join(output, 'providers'));
for (const [providerId, entry] of providers)
  if (bundled.get(providerId)?.manifest.digest !== entry.manifest.digest) throw new Error(`UI_PROVIDER_BUNDLE_MISMATCH: ${providerId}`);
console.log(JSON.stringify(deployment));
