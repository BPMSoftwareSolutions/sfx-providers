// Operator-owned host module. Adapt the secret-store call to your deployment;
// never put credentials in an HTTP request, command-line argument or this file.
// CAPABILITY_ESTATE_HOST_MODULE selects an absolute path to this module.
import sql from 'mssql';
export async function openSql() {
  throw new Error('Bind openSql to your approved vault and SQL Server connection.');
  // const connectionString = await yourVault.release('DB_CONNECTION_STRING');
  // const pool = await new sql.ConnectionPool(connectionString).connect();
  // return { pool, sql };
}
