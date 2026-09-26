import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Optional operator-selected host realization. The provider does not import an
// estate checkout or embed credentials; only the configured database ground runs.
export function createSdaVaultHost({ bootstrapRoot } = {}) {
  if (!path.isAbsolute(bootstrapRoot ?? '')) throw new Error('An absolute installed SDA bootstrapRoot is required.');
  return { async openSql() {
    const base = pathToFileURL(path.join(bootstrapRoot, '/')).href;
    const [{ readKernelBootConfiguration }, { createDatabaseConnectBoundary, connectionString, sql }] = await Promise.all([
      import(new URL('runtime-configuration.mjs', base).href),
      import(new URL('database-connect-boundary.mjs', base).href),
    ]);
    const config = readKernelBootConfiguration();
    const pool = await createDatabaseConnectBoundary({ sql,
      connectionString: await connectionString(config),
      connectionName: config.connectionCredentialReference, requestTimeoutMs: 120000 })();
    return { pool, sql };
  } };
}
