// sfx-sqlserver-read-provider.v1 - the host/consumer SQL Server read provider (SDA ADR-0016).
//
// The kernel resolves this provider profile through its generic resolver and invokes it with the
// cell input; the engine, the session and the driver live here, never in the kernel. The consumer's
// port binding carries the operation and the connection as data:
//   { statement, resultColumn, connection: { credentialReference, source, storeLocator } }
// The connection string is held in the host vault under credentialReference. The host releases it
// to this provider for one call and it never leaves this function: no environment variable, no
// observation, no result. The statement runs with @input bound to the cell input as JSON (the
// convention of the estate's declared reads) and returns one row; the value of resultColumn,
// parsed when it is JSON text, is the outcome.
//
// What the host provides (the ADR-0016 boundary):
//   host.releaseCredential(connection) -> the connection string of the named vault entry
//   the SQL Server driver "mssql", installed from this package
export function createSqlServerReadProvider(host = {}) {
  return async function readOnDeclaredConnection(input, context) {
    const configuration = context?.configuration?.binding?.configuration ?? context?.configuration ?? {};
    const { statement, resultColumn, connection } = configuration;
    if (typeof statement !== "string" || statement.length === 0) throw new Error("DECLARED_READ_STATEMENT_MISSING");
    if (typeof connection?.credentialReference !== "string" || connection.credentialReference.length === 0) {
      throw new Error("DECLARED_CONNECTION_MISSING");
    }
    if (typeof host.releaseCredential !== "function") throw new Error("HOST_CREDENTIAL_RELEASE_NOT_PROVIDED");
    const { default: sql } = await import("mssql");
    const pool = new sql.ConnectionPool(await host.releaseCredential(connection));
    pool.on("error", () => {});
    try {
      await pool.connect();
      const result = await pool.request()
        .input("input", sql.NVarChar(sql.MAX), input === undefined ? null : JSON.stringify(input))
        .query(statement);
      const rows = result.recordsets.length === 1 ? result.recordsets[0] : [];
      if (result.recordsets.length !== 1 || rows.length !== 1) throw new Error("DECLARED_READ_RESULT_NOT_COHERENT");
      const value = resultColumn === undefined ? rows[0] : rows[0][resultColumn];
      return { outcomeValue: typeof value === "string" ? JSON.parse(value) : value };
    } finally {
      await pool.close().catch(() => {});
    }
  };
}