import { randomUUID } from "node:crypto";
import { pool, transaction } from "@/lib/db";

export async function beginAttempt(input: { tenantId: string; phoneHash: string; ipHash: string; recipient: string }): Promise<{ id: string; allowed: boolean }> {
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${input.tenantId}:${input.phoneHash}`]);
    const recent = await client.query("SELECT COUNT(*)::int AS count FROM attempts WHERE tenant_id=$1 AND (phone_hash=$2 OR ip_hash=$3) AND created_at > now() - interval '15 minutes'", [input.tenantId, input.phoneHash, input.ipHash]);
    const id = randomUUID();
    const allowed = recent.rows[0].count < 5;
    await client.query("INSERT INTO attempts (id,tenant_id,phone_hash,ip_hash,outcome) VALUES ($1,$2,$3,$4,$5)", [id, input.tenantId, input.phoneHash, input.ipHash, allowed ? "started" : "rejected"]);
    await client.query("INSERT INTO notification_outbox (attempt_id,event_type,recipient) VALUES ($1,$2,$3)", [id, allowed ? "attempt_started" : "attempt_rate_limited", input.recipient]);
    return { id, allowed };
  });
}

export async function finishAttempt(id: string, outcome: "rejected" | "verified" | "issued" | "expired" | "unknown"): Promise<void> {
  const client = await pool().connect();
  try {
    await client.query("UPDATE attempts SET outcome=$2,finished_at=now() WHERE id=$1", [id, outcome]);
    await client.query("INSERT INTO notification_outbox (attempt_id,event_type,recipient) VALUES ($1,$2,$3)", [id, `attempt_${outcome}`, process.env.ALERT_EMAIL]);
  } finally { client.release(); }
}
