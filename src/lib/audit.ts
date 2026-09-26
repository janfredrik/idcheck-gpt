import { randomUUID } from "node:crypto";
import { pool, transaction } from "@/lib/db";

export async function beginAttempt(input: { tenantId: string; phoneHash: string; ipHash: string; simulationTokenHash: string; recipient: string }): Promise<{ id: string; allowed: boolean }> {
  return transaction(async (client) => {
    const lockKeys = [`${input.tenantId}:phone:${input.phoneHash}`, `${input.tenantId}:ip:${input.ipHash}`].sort();
    for (const key of lockKeys) await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
    const recent = await client.query("SELECT COUNT(*)::int AS count FROM attempts WHERE tenant_id=$1 AND (phone_hash=$2 OR ip_hash=$3) AND created_at > now() - interval '15 minutes'", [input.tenantId, input.phoneHash, input.ipHash]);
    const id = randomUUID();
    const allowed = recent.rows[0].count < 5;
    await client.query("INSERT INTO attempts (id,tenant_id,phone_hash,ip_hash,simulation_token_hash,outcome,finished_at) VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $6='started' THEN NULL ELSE now() END)", [id, input.tenantId, input.phoneHash, input.ipHash, input.simulationTokenHash, allowed ? "started" : "rejected"]);
    await client.query("INSERT INTO notification_outbox (attempt_id,event_type,recipient) VALUES ($1,$2,$3)", [id, allowed ? "attempt_started" : "attempt_rate_limited", input.recipient]);
    return { id, allowed };
  });
}

export async function consumeSimulation(input: { tokenHash: string; tenantId: string; phoneHash: string; decision: string; recipient: string }): Promise<{ id: string; approved: boolean; reason?: string } | null> {
  return transaction(async (client) => {
    const result = await client.query<{ id: string; tenant_id: string; phone_hash: string; outcome: string; created_at: Date }>("SELECT id,tenant_id,phone_hash,outcome,created_at FROM attempts WHERE simulation_token_hash=$1 FOR UPDATE", [input.tokenHash]);
    const attempt = result.rows[0];
    if (!attempt || attempt.outcome !== "started") return null;
    if (attempt.created_at.getTime() <= Date.now() - 5 * 60 * 1000) {
      await client.query("UPDATE attempts SET outcome='expired',reason_code='FLOW_EXPIRED',finished_at=now() WHERE id=$1", [attempt.id]);
      await client.query("INSERT INTO notification_outbox (attempt_id,event_type,recipient) VALUES ($1,'attempt_expired',$2)", [attempt.id, input.recipient]);
      return { id: attempt.id, approved: false, reason: "FLOW_EXPIRED" };
    }
    let reason: string | undefined;
    if (attempt.tenant_id.toLowerCase() !== input.tenantId.toLowerCase()) reason = "TENANT_MISMATCH";
    else if (attempt.phone_hash !== input.phoneHash) reason = "MOBILE_MISMATCH";
    else if (input.decision === "denied") reason = "SIMULATED_DENIAL";
    else if (input.decision !== "approved") reason = "INVALID_SIMULATION_DECISION";
    const approved = !reason;
    await client.query("UPDATE attempts SET outcome=$2,reason_code=$3,finished_at=CASE WHEN $2='verifying' THEN NULL ELSE now() END WHERE id=$1", [attempt.id, approved ? "verifying" : "rejected", reason ?? null]);
    if (!approved) await client.query("INSERT INTO notification_outbox (attempt_id,event_type,recipient) VALUES ($1,'attempt_rejected',$2)", [attempt.id, input.recipient]);
    return { id: attempt.id, approved, reason };
  });
}

function validMailbox(value?: string | null): value is string {
  return typeof value === "string" && value.length <= 320 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

export async function finishAttempt(id: string, outcome: "rejected" | "verified" | "issued" | "expired" | "unknown", reasonCode?: string, userEmail?: string | null): Promise<boolean> {
  const client = await pool().connect();
  try {
    const safeReason = reasonCode && /^[A-Z0-9_:-]{1,60}$/.test(reasonCode) ? reasonCode : null;
    await client.query("UPDATE attempts SET outcome=$2,reason_code=$3,finished_at=now() WHERE id=$1", [id, outcome, safeReason]);
    await client.query("INSERT INTO notification_outbox (attempt_id,event_type,recipient) VALUES ($1,$2,$3)", [id, `attempt_${outcome}`, process.env.ALERT_EMAIL]);
    if (outcome === "issued" && validMailbox(userEmail)) {
      await client.query("INSERT INTO notification_outbox (attempt_id,event_type,recipient) VALUES ($1,'user_tap_notice',$2)", [id, userEmail]);
      return true;
    }
    return false;
  } finally { client.release(); }
}
