#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { run as runDeck } from './capability-deck.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BOOTSTRAP_ROOT = path.resolve(HERE, '..', 'scenario-driven-architecture', 'languages', 'typescript', 'src', 'kernel', 'bootstrap');
const MAPPING_AUTHORITY_ID = 'blueprint-finding-repair-map.v1';
const MAPPING_AUTHORITY = 'sidefx:authorities/' + MAPPING_AUTHORITY_ID;
const DISPATCH_CONTRACT_ID = 'blueprint-finding-repair.v1';
const RECEIPT_CONTRACT_ID = 'repair-receipt.v1';
const NO_REPAIR_DISPOSITIONS = new Set(['NONE', 'NO_REPAIR_DECLARED', 'NO_INSTALLED_REPAIR']);
const GATE_OBJECTS = [
  ['apply_procedure_installed', 'model.apply_blueprint_finding_repair'],
  ['receipt_procedure_installed', 'model.record_repair_receipt'],
  ['mapping_writer_installed', 'model.declare_blueprint_finding_repair'],
  ['mapping_authority_present', MAPPING_AUTHORITY],
];
const OPTIONS = ['--capability-id', '--namespace-id', '--view', '--context-altitude', '--scenario-id', '--operation-id', '--transformation-id', '--output', '--migration-runner'];

const usage = () => 'node repair-loop.mjs --capability-id ID --output NEW_DIRECTORY [--view capability|scenario|event|mechanic|provider|physical] [--context-altitude all|1..11] [--namespace-id ID] [--scenario-id ID] [--operation-id ID] [--transformation-id ID] [--migration-runner FILE] [--commit]';
const line = (...parts) => console.log(parts.join(' '));
const show = value => value === null || value === undefined || value === '' ? '-' : value;
const truthy = value => value === true || value === 1 || value === '1';
const first = value => Array.isArray(value) ? value[0] : value;
const sqlLiteral = value => "N'" + String(value).replaceAll("'", "''") + "'";
const resultRows = result => result.resultSets.flatMap(set => set.rows);
const countBy = values => values.reduce((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {});

function stringField(entry, keys) {
  for (const key of keys) if (typeof entry?.[key] === 'string' && entry[key].length) return entry[key];
  return null;
}

function resolvePointer(source, binding) {
  const tokens = binding.startsWith('/') ? binding.split('/').slice(1) : binding.split('.').filter(Boolean);
  let value = source;
  for (const token of tokens) {
    if (token.startsWith('$')) continue;
    if (value === null || typeof value !== 'object') return undefined;
    value = value[token];
  }
  return value;
}

function parseRepairs(definitionJson) {
  const document = JSON.parse(definitionJson);
  const repairs = [document?.semantics?.repairs, document?.repairs].find(Array.isArray) ?? [];
  return repairs.map(entry => ({
    findingCode: stringField(entry, ['findingCode', 'code', 'finding_code', 'finding']),
    repairProcedure: stringField(entry, ['repairProcedure', 'procedure', 'repair_procedure']),
    disposition: stringField(entry, ['disposition', 'repairDisposition', 'repair_disposition']),
    parameterContract: stringField(entry, ['parameterContract', 'parameter_contract']),
    requiredParameters: entry?.requiredParameters ?? entry?.required_parameters,
    parameterBindings: entry?.parameterBindings ?? entry?.parameter_bindings,
    parameters: entry?.parameters && !Array.isArray(entry.parameters) ? entry.parameters : undefined,
    nextUnit: stringField(entry, ['nextUnit', 'next_unit']),
  }));
}

function resolveParameters(row, finding, observed) {
  if (row.parameters) return { ...row.parameters };
  const declared = row.requiredParameters;
  if (declared === undefined || declared === null) return {};
  const names = Array.isArray(declared) ? declared : Object.keys(declared);
  const values = {};
  for (const name of names) {
    const key = String(name).replace(/^@+/, '');
    const binding = row.parameterBindings?.[name] ?? row.parameterBindings?.[key];
    const bound = typeof binding === 'string' ? resolvePointer({ finding, observed }, binding) : undefined;
    if (bound !== undefined) { values[key] = bound; continue; }
    if (!Array.isArray(declared) && declared[name] !== undefined) { values[key] = declared[name]; continue; }
    if (finding[key] !== undefined) { values[key] = finding[key]; continue; }
  }
  return values;
}

const isDispatchable = row => Boolean(row.repairProcedure) && row.repairProcedure !== 'NONE' && !NO_REPAIR_DISPOSITIONS.has(row.disposition);

function gateSql() {
  return `SET NOCOUNT ON;
SELECT N'repair_loop_gate' AS result_set,
 CONVERT(bit,CASE WHEN OBJECT_ID(N'model.apply_blueprint_finding_repair') IS NOT NULL THEN 1 ELSE 0 END) AS apply_procedure_installed,
 CONVERT(bit,CASE WHEN OBJECT_ID(N'model.record_repair_receipt') IS NOT NULL THEN 1 ELSE 0 END) AS receipt_procedure_installed,
 CONVERT(bit,CASE WHEN OBJECT_ID(N'model.declare_blueprint_finding_repair') IS NOT NULL THEN 1 ELSE 0 END) AS mapping_writer_installed,
 CONVERT(bit,CASE WHEN EXISTS(SELECT 1 FROM analysis.v_selected_semantic_definition d
  WHERE d.estate_model_pk=(SELECT estate_model_pk FROM source.current_model WHERE singleton_id=1)
   AND d.object_kind=N'AUTHORITY' AND d.namespace_id=N'sidefx:authorities'
   AND d.declared_id=N'blueprint-finding-repair-map.v1' COLLATE Latin1_General_100_BIN2) THEN 1 ELSE 0 END) AS mapping_authority_present;`;
}

function mappingSql() {
  return `SET NOCOUNT ON;
SELECT N'repair_map_authority' AS result_set,d.declared_id,
 LOWER(CONVERT(varchar(64),d.definition_digest,2)) AS definition_digest,d.definition_json
FROM analysis.v_selected_semantic_definition d
WHERE d.estate_model_pk=(SELECT estate_model_pk FROM source.current_model WHERE singleton_id=1)
 AND d.object_kind=N'AUTHORITY' AND d.namespace_id=N'sidefx:authorities'
 AND d.declared_id=N'blueprint-finding-repair-map.v1' COLLATE Latin1_General_100_BIN2;`;
}

function dispatchSql(document, commit) {
  return `SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @document nvarchar(max)=${sqlLiteral(JSON.stringify(document))};
EXEC model.apply_blueprint_finding_repair @document=@document;
${commit ? 'COMMIT TRANSACTION;' : 'ROLLBACK TRANSACTION;'}`;
}

function receiptSql(document, commit) {
  return `SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @document nvarchar(max)=${sqlLiteral(JSON.stringify(document))};
EXEC model.record_repair_receipt @document=@document;
${commit ? 'COMMIT TRANSACTION;' : 'ROLLBACK TRANSACTION;'}`;
}

async function runSql(runMigration, directory, name, text) {
  const file = path.join(directory, name + '.sql');
  await fs.writeFile(file, text.endsWith('\n') ? text : text + '\n');
  const result = await runMigration({ migrationFile: file });
  return { ...result, file };
}

async function readJsonIfPresent(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; }
}

async function readReview(deckDirectory) {
  const receipt = await readJsonIfPresent(path.join(deckDirectory, 'receipt.json'));
  const circuit = await readJsonIfPresent(path.join(deckDirectory, 'circuit-review.json'));
  const review = receipt?.review ?? circuit;
  if (!review || !Array.isArray(review.issues)) throw Object.assign(new Error('DECK_REVIEW_NOT_FOUND'), { code: 'DECK_REVIEW_NOT_FOUND' });
  return { review, snapshotDigest: receipt?.snapshotDigest ?? null };
}

async function assertAbsent(directory) {
  try { await fs.access(directory); throw Object.assign(new Error('OUTPUT_DIRECTORY_EXISTS: ' + directory), { code: 'OUTPUT_DIRECTORY_EXISTS' }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export async function loadMigrationRunner(explicit) {
  let address = explicit ?? process.env.SDA_BOOTSTRAP_ROOT;
  if (!address) {
    const config = await readJsonIfPresent(path.join(HERE, 'config', 'capability-presentation.local.json'));
    if (typeof config?.bootstrapRoot === 'string' && config.bootstrapRoot.length) address = config.bootstrapRoot;
  }
  address = address ?? DEFAULT_BOOTSTRAP_ROOT;
  const runnerFile = address.endsWith('.mjs') ? path.resolve(address) : path.resolve(address, 'run-migration.mjs');
  const { runMigration } = await import(pathToFileURL(runnerFile).href);
  if (typeof runMigration !== 'function') throw new Error('MIGRATION_RUNNER_NOT_FOUND: ' + runnerFile);
  return runMigration;
}

export async function runRepairLoop(options) {
  const capabilityId = options.capabilityId;
  const output = path.resolve(options.output);
  const commit = options.commit === true;
  const mode = commit ? 'commit' : 'dry-run';
  const runMigration = await loadMigrationRunner(options.migrationRunner);
  await fs.mkdir(output, { recursive: true });
  const sqlDirectory = path.join(output, 'sql');
  await fs.mkdir(sqlDirectory, { recursive: true });
  line('REPAIR_LOOP', `capability=${capabilityId}`, `mode=${mode}`, `output=${output}`);

  const gate = await runSql(runMigration, sqlDirectory, '00-gate', gateSql());
  const gateRow = first(resultRows(gate));
  const missing = GATE_OBJECTS.filter(([key]) => !truthy(gateRow?.[key])).map(([, object]) => object);
  line('GATE', `sql=${gate.file}`, ...GATE_OBJECTS.map(([key, object]) => `${object}=${truthy(gateRow?.[key]) ? 'installed' : 'missing'}`));
  if (missing.length) {
    line('REPAIR_LOOP', 'PENDING', 'reason=REPAIR_MACHINERY_NOT_INSTALLED', `missing=${missing.join(',')}`);
    return { status: 'PENDING', capabilityId, mode, output, gateSql: gate.file, missing };
  }

  const mappingRun = await runSql(runMigration, sqlDirectory, '01-mapping', mappingSql());
  const mappingRow = first(resultRows(mappingRun));
  const repairs = mappingRow?.definition_json ? parseRepairs(mappingRow.definition_json) : [];
  line('MAPPING', `sql=${mappingRun.file}`, `authority=${MAPPING_AUTHORITY}`, `digest=${show(mappingRow?.definition_digest)}`, `repairs=${repairs.length}`);

  const deckBefore = path.join(output, 'deck-before');
  const deckAfter = path.join(output, 'deck-after');
  await assertAbsent(deckBefore);
  await assertAbsent(deckAfter);
  const deckArguments = directory => {
    const args = ['--capability-id', capabilityId, '--output', directory, '--view', options.view ?? 'capability'];
    if (options.contextAltitude) args.push('--context-altitude', String(options.contextAltitude));
    if (options.namespaceId) args.push('--namespace-id', options.namespaceId);
    if (options.scenarioId) args.push('--scenario-id', options.scenarioId);
    if (options.operationId) args.push('--operation-id', options.operationId);
    if (options.transformationId) args.push('--transformation-id', options.transformationId);
    return args;
  };
  await runDeck(deckArguments(deckBefore));
  const before = await readReview(deckBefore);
  const reviewDigest = createHash('sha256').update(JSON.stringify(before.review)).digest('hex');
  const observed = { snapshotDigest: before.snapshotDigest, reviewDigest };
  line('DECK', 'before', `output=${deckBefore}`, `warnings=${before.review.warnings}`, `errors=${before.review.errors}`, `codes=${before.review.issues.map(issue => issue.code).join(',') || '-'}`);

  const resolutions = [];
  let applied = 0, skipped = 0, unmapped = 0, sequence = 0;
  for (const issue of before.review.issues) {
    const row = repairs.find(repair => repair.findingCode === issue.code) ?? null;
    if (!row) {
      unmapped++;
      resolutions.push({ id: issue.id, code: issue.code, action: 'unmapped', procedure: null });
      line('FINDING', `id=${show(issue.id)}`, `code=${show(issue.code)}`, `severity=${show(issue.severity)}`, 'procedure=-', 'disposition=-', 'action=unmapped');
      continue;
    }
    if (!isDispatchable(row)) {
      skipped++;
      resolutions.push({ id: issue.id, code: issue.code, action: 'skipped-no-repair', procedure: row.repairProcedure, disposition: row.disposition, nextUnit: row.nextUnit });
      line('FINDING', `id=${show(issue.id)}`, `code=${show(issue.code)}`, `severity=${show(issue.severity)}`, `procedure=${show(row.repairProcedure)}`, `disposition=${show(row.disposition)}`, 'action=skipped-no-repair', `next_unit=${show(row.nextUnit)}`);
      continue;
    }
    applied++;
    sequence++;
    const tag = String(sequence).padStart(2, '0');
    const dispatchDocument = {
      contractId: DISPATCH_CONTRACT_ID,
      capabilityId,
      ...(options.namespaceId ? { namespaceId: options.namespaceId } : {}),
      finding: { code: issue.code, severity: issue.severity, nodeIds: issue.nodeIds ?? [], sourceRefs: issue.sourceRefs ?? [], reviewContractId: before.review.contractId ?? null },
      parameters: resolveParameters(row, issue, observed),
      observed,
    };
    const applyRun = await runSql(runMigration, sqlDirectory, `dispatch-${tag}-apply`, dispatchSql(dispatchDocument, commit));
    const applyRows = resultRows(applyRun);
    const outcomeRow = applyRows.find(entry => entry && typeof entry === 'object' && 'outcome' in entry) ?? {};
    line('FINDING', `id=${show(issue.id)}`, `code=${show(issue.code)}`, `severity=${show(issue.severity)}`, `procedure=${show(row.repairProcedure)}`, `disposition=${show(row.disposition)}`, 'action=applied', `next_unit=${show(row.nextUnit)}`);
    line('PREFLIGHT', `finding=${show(issue.id)}`, `sql=${applyRun.file}`, `transaction=${applyRun.disposition === 'COMMIT' ? 'COMMITTED' : 'ROLLED_BACK'}`, `outcome=${show(outcomeRow.outcome)}`, `before=${show(outcomeRow.before_digest)}`, `after=${show(outcomeRow.after_digest)}`, `reason=${show(outcomeRow.reason)}`);
    const receiptDocument = {
      contractId: RECEIPT_CONTRACT_ID,
      capabilityId,
      finding: { code: issue.code, severity: issue.severity },
      procedure: outcomeRow.repair_procedure ?? row.repairProcedure,
      outcome: outcomeRow.outcome ?? 'UNKNOWN',
      reason: outcomeRow.reason ?? null,
      beforeGraphDigest: outcomeRow.before_digest ?? null,
      afterGraphDigest: outcomeRow.after_digest ?? null,
      observed,
      nextUnit: row.nextUnit ?? null,
    };
    const receiptRun = await runSql(runMigration, sqlDirectory, `dispatch-${tag}-receipt`, receiptSql(receiptDocument, commit));
    const receiptRow = first(resultRows(receiptRun));
    line('RECEIPT', `finding=${show(issue.id)}`, `sql=${receiptRun.file}`, `transaction=${receiptRun.disposition === 'COMMIT' ? 'COMMITTED' : 'ROLLED_BACK'}`, `result=${show(receiptRow?.result_set ?? receiptRow?.outcome)}`, `id=${show(receiptRow?.receipt_id)}`);
    resolutions.push({ id: issue.id, code: issue.code, action: 'applied', procedure: row.repairProcedure, disposition: row.disposition, outcome: outcomeRow.outcome ?? 'UNKNOWN', receipt: receiptRow?.result_set ?? receiptRow?.outcome ?? null });
  }

  await runDeck(deckArguments(deckAfter));
  const after = await readReview(deckAfter);
  const beforeCodes = before.review.issues.map(issue => issue.code);
  const afterCodes = after.review.issues.map(issue => issue.code);
  const beforeCounts = countBy(beforeCodes);
  const afterCounts = countBy(afterCodes);
  const added = [...new Set(afterCodes.filter(code => (afterCounts[code] ?? 0) > (beforeCounts[code] ?? 0)))];
  const removed = [...new Set(beforeCodes.filter(code => (beforeCounts[code] ?? 0) > (afterCounts[code] ?? 0)))];
  line('DECK', 'after', `output=${deckAfter}`, `warnings=${after.review.warnings}`, `errors=${after.review.errors}`, `codes=${afterCodes.join(',') || '-'}`);
  line('WARNINGS', `before=${before.review.warnings}`, `after=${after.review.warnings}`, `errors_before=${before.review.errors}`, `errors_after=${after.review.errors}`);
  line('DIFF', `added=${added.join(',') || '-'}`, `removed=${removed.join(',') || '-'}`);
  line('SUMMARY', `mode=${mode}`, `findings=${before.review.issues.length}`, `applied=${applied}`, `skipped=${skipped}`, `unmapped=${unmapped}`, `mapped_repairs=${repairs.length}`);
  return { status: 'COMPLETE', capabilityId, mode, output, before: before.review, after: after.review, resolutions, added, removed, mapping: { authority: MAPPING_AUTHORITY, digest: mappingRow?.definition_digest ?? null, repairs: repairs.length } };
}

export async function run(args = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') { line(usage()); return { status: 'HELP' }; }
    if (arg === '--commit') { options.commit = true; continue; }
    if (!OPTIONS.includes(arg) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Unknown or incomplete option: ' + arg);
    if (arg in options) throw new Error('Repeated option: ' + arg);
    options[arg] = args[++i];
  }
  if (!options['--output'] || !options['--capability-id']) throw new Error('Provide --capability-id and --output.');
  return runRepairLoop({
    capabilityId: options['--capability-id'],
    output: path.resolve(options['--output']),
    commit: options.commit === true,
    view: options['--view'],
    contextAltitude: options['--context-altitude'],
    namespaceId: options['--namespace-id'],
    scenarioId: options['--scenario-id'],
    operationId: options['--operation-id'],
    transformationId: options['--transformation-id'],
    migrationRunner: options['--migration-runner'],
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  run().catch(error => { console.error('REPAIR_LOOP FAILED:', error.message); process.exitCode = 1; });
}
