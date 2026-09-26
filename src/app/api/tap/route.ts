import { NextRequest, NextResponse } from "next/server";
import { getDemoConfig } from "@/lib/config";
import { finishAttempt } from "@/lib/audit";
import { createOneTimeTap, getUserById, isEligibleForDemo } from "@/lib/graph";
import { pool, transaction } from "@/lib/db";
import { clearSessionCookie, genericFailure, hashForRateLimit, noStore, normalizeNorwegianMobile, requireSameOrigin, safeEqual, SESSION_COOKIE, sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type SessionRow = { token_hash: string; csrf_hash: string; tenant_id: string; user_id: string; attempt_id: string; status: string; expires_at: Date };
const fail = (reference?: string, message = genericFailure) => noStore(NextResponse.json({ ok: false, message, ...(reference ? { reference } : {}) }));

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return fail();
  const config = getDemoConfig(); const rawSession = request.cookies.get(SESSION_COOKIE)?.value; const csrf = request.headers.get("x-csrf-token");
  if (!config || !rawSession || !csrf || csrf.length > 200) return fail();

  let claimed: SessionRow | null = null;
  try {
    claimed = await transaction(async (client) => {
      const found = await client.query<SessionRow>("SELECT * FROM flow_sessions WHERE token_hash=$1 FOR UPDATE", [sha256(rawSession)]);
      const row = found.rows[0];
      if (!row || row.status !== "verified" || row.expires_at.getTime() <= Date.now() || row.tenant_id.toLowerCase() !== config.tenantId.toLowerCase() || !safeEqual(sha256(csrf), row.csrf_hash)) throw new Error("SESSION_INVALID");
      await client.query("UPDATE flow_sessions SET status='issuing' WHERE token_hash=$1", [row.token_hash]);
      return row;
    });
  } catch { return fail(); }

  try {
    const issued = await transaction(async (client) => {
      // Serialize all issuance for this account, including distinct browser sessions.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${config.tenantId}:tap:${claimed!.user_id}`]);
      const user = await getUserById(claimed!.user_id);
      if (!user || !(await isEligibleForDemo(user))) throw new Error("TARGET_NOT_ELIGIBLE");
      const originalAttempt = await client.query<{ phone_hash: string }>("SELECT phone_hash FROM attempts WHERE id=$1", [claimed!.attempt_id]);
      const currentMobile = user.mobilePhone ? normalizeNorwegianMobile(user.mobilePhone) : null;
      if (!currentMobile || !originalAttempt.rows[0] || !safeEqual(hashForRateLimit(currentMobile), originalAttempt.rows[0].phone_hash)) throw new Error("MATCH_ATTRIBUTE_CHANGED");
      const result = await createOneTimeTap(claimed!.user_id);
      await client.query("UPDATE flow_sessions SET status='issued' WHERE token_hash=$1", [claimed!.token_hash]);
      return { ...result, userEmail: user.mail ?? null };
    });
    const emailNoticeQueued = await finishAttempt(claimed.attempt_id, "issued", undefined, issued.userEmail);
    const response = noStore(NextResponse.json({ ok: true, tap: issued.tap, expiresAt: issued.expiresAt, emailNoticeQueued, reference: claimed.attempt_id }));
    clearSessionCookie(response);
    return response;
  } catch (error) {
    // A failed or timed-out Graph POST may have created a pass; never retry it automatically.
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const finalState = ["TARGET_NOT_ELIGIBLE", "MATCH_ATTRIBUTE_CHANGED", "ACTIVE_TAP_EXISTS"].includes(code) ? "rejected" : "unknown";
    await pool().query("UPDATE flow_sessions SET status=$2 WHERE token_hash=$1", [claimed.token_hash, finalState]).catch(() => undefined);
    await finishAttempt(claimed.attempt_id, finalState, code).catch(() => undefined);
    const message = code === "ACTIVE_TAP_EXISTS"
      ? "Det finnes allerede en aktiv engangskode for kontoen. Bruk den hvis du har den. Hvis ikke, kontakt IT for hjelp."
      : genericFailure;
    const response = fail(claimed.attempt_id, message); clearSessionCookie(response); return response;
  }
}
