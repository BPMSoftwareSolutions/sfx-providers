#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// The landing declaration is one authored base plus the retained closure of the
// objective capability selected by the landing's objective action. This
// extractor copies the already-normalized rows for that named scenario out of a
// capability-presentation snapshot into the declaration's import block, so deck
// generation never needs a database or another repository. The login entry
// circuit is declared in the base from the sfx-embody declaration and private
// host migration pair; no snapshot is needed for it.
// Usage:
//   node extract-closures.mjs --objective-snapshot FILE [--output declaration.json]
const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i++) {
  if (!['--objective-snapshot', '--output'].includes(args[i]) || !args[i + 1]) throw new Error(`Unknown or incomplete option: ${args[i]}`);
  options[args[i]] = args[++i];
}
if (!options['--objective-snapshot']) throw new Error('Provide --objective-snapshot.');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const sha256 = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const scenarioId = 'request-capability-from-objective-v3';

const base = await read(path.join(dir, 'landing-circuit.base.json'));
const file = path.resolve(options['--objective-snapshot']), snapshot = await read(file);
const scenario = snapshot.scenarios.find(s => s.id === scenarioId);
if (!scenario) throw new Error(`${file} does not retain scenario ${scenarioId}.`);
const authority = snapshot.authorities.find(a => a.scenarioId === scenarioId);
if (!authority) throw new Error(`${file} does not retain an authority for ${scenarioId}.`);
const ports = new Set(authority.operations.map(o => o.portId).filter(Boolean));
const bindings = snapshot.bindings.filter(b => ports.has(b.portId));
const transformations = new Set(bindings.map(b => b.transformationId).filter(Boolean));
const contracts = [scenario.inputContractId, scenario.outcomeContractId].filter(Boolean);
const importBlock = { id: scenarioId, capabilityId: snapshot.identity.capabilityId, source: file,
  snapshotDigest: snapshot.snapshotDigest, scenarioIds: [scenarioId],
  authorities: [authority], bindings,
  contracts: snapshot.contracts.filter(c => contracts.includes(c.id)),
  transformations: snapshot.transformations.filter(t => transformations.has(t.id)),
  interfaces: snapshot.interfaces };
const output = path.resolve(options['--output'] ?? path.join(dir, 'declaration.json'));
const declaration = { ...base, imports: [importBlock],
  provenance: { ...base.provenance, imports: [{ file, sha256: await sha256(file) }] } };
await fs.writeFile(output, JSON.stringify(declaration, null, 2) + '\n');
console.log(JSON.stringify({ output, imports: [{ id: importBlock.id, scenarioIds: importBlock.scenarioIds,
  bindings: importBlock.bindings.length, contracts: importBlock.contracts.length,
  transformations: importBlock.transformations.length, authorities: importBlock.authorities.length }] }));
