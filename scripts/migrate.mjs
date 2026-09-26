import { readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined, application_name: "idcheck-migrate" });
try {
  const sql = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  await pool.query(sql);
} finally {
  await pool.end();
}
