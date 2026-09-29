import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { normalizeSnapshot, digest } from './snapshot.mjs';

export const queryUrl = new URL('./read-estate.sql', import.meta.url);
export function createSqlEstateReader({ openSql }) {
  if (typeof openSql !== 'function') throw new TypeError('openSql host binding is required.');
  return async function readEstate({ capabilityId, namespaceId }) {
    const query = await fs.readFile(queryUrl, 'utf8');
    const { pool, sql } = await openSql();
    const transaction = new sql.Transaction(pool);
    let begun = false;
    try {
      await transaction.begin(sql.ISOLATION_LEVEL.SNAPSHOT);
      begun = true;
      const request = new sql.Request(transaction);
      request.input('capability_id', sql.NVarChar(400), capabilityId);
      request.input('namespace_id', sql.NVarChar(400), namespaceId ?? null);
      const result = await request.query(query);
      const [capabilities, graphs, scenarios, features, fixtures, obligations, altitudeCatalog, functions, conditions, blueprintSources, platformImplementations, inspectionRows, providerLabels] = result.recordsets;
      if (capabilities?.length !== 1 || graphs?.length !== 1) throw new Error('CAPABILITY_ID_NOT_UNIQUE_OR_NOT_FOUND');
      if (Buffer.byteLength(graphs[0].graph_source) > 64 * 1024 * 1024) throw new Error('CAPABILITY_GRAPH_SOURCE_TOO_LARGE');
      const graph=JSON.parse(graphs[0].graph_source);
      const inspection=inspectionRows?.[0]?.inspection_json ? {...JSON.parse(inspectionRows[0].inspection_json),
        sourceGraphDigest:digest(graph),captureBasis:'same SQL snapshot transaction as graph_source'} : null;
      return normalizeSnapshot({
        capability: capabilities[0], graph,
        scenarios, features, fixtures, obligations, altitudeCatalog, conditions, blueprintSources, platformImplementations,
        inspection, providerLabels,
        provenance: { adapter: 'sql-server-snapshot.v1', isolation: 'SNAPSHOT',
          queryDigest: createHash('sha256').update(query.replaceAll('\r\n', '\n')).digest('hex'),
          graphFunctionDigest: functions[0]?.graph_function_digest ?? null },
      });
    } catch (error) {
      // SQL errors may quote data or connection details; expose only stable codes.
      const code = /CAPABILITY_[A-Z_]+/.exec(error.message ?? '')?.[0] ?? 'CAPABILITY_ESTATE_READ_FAILED';
      throw Object.assign(new Error(code), { code });
    } finally {
      if (begun) await transaction.rollback().catch(() => {});
      await pool.close();
    }
  };
}

export async function loadEstateReader() {
  const hostPath = process.env.CAPABILITY_ESTATE_HOST_MODULE;
  if (hostPath) {
    if (!path.isAbsolute(hostPath)) throw new Error('CAPABILITY_ESTATE_HOST_MODULE must be an absolute local module path.');
    const host = await import(pathToFileURL(hostPath).href);
    return createSqlEstateReader({ openSql: host.openSql });
  }
  const configUrl = new URL('../../config/capability-presentation.local.json', import.meta.url);
  let config;
  try { config = JSON.parse(await fs.readFile(configUrl, 'utf8')); }
  catch { throw Object.assign(new Error('Configure the estate host in config/capability-presentation.local.json or CAPABILITY_ESTATE_HOST_MODULE.'), { code: 'CAPABILITY_ESTATE_HOST_REQUIRED' }); }
  const { createSdaVaultHost } = await import('./hosts/sda-vault.mjs');
  return createSqlEstateReader(createSdaVaultHost(config));
}
