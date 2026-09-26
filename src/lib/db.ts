import { Pool, type PoolClient } from "pg";
const globalForDb = globalThis as unknown as { idcheckPool?: Pool };
export function pool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DB_UNAVAILABLE");
  if (!globalForDb.idcheckPool) globalForDb.idcheckPool = new Pool({ connectionString, max: 8, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined, application_name: "idcheck" });
  return globalForDb.idcheckPool;
}
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try { await client.query("BEGIN"); const result = await fn(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); }
}
