import { NextRequest, NextResponse } from "next/server";
import { getDemoConfig } from "@/lib/config";
import { finishAttempt } from "@/lib/audit";
import { createOneTimeTap, getUserById, isEligibleForDemo } from "@/lib/graph";
import { pool, transaction } from "@/lib/db";
import { clearSessionCookie, genericFailure, noStore, requireSameOrigin, safeEqual, SESSION_COOKIE, sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type SessionRow = { token_hash: string; csrf_hash: string; tenant_id: string; user_id: string; attempt_id: string; status: string; expires_at: Date };
const fail = () => noStore(NextResponse.json({ ok: false, message: genericFailure }));

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
    const user = await getUserById(claimed.user_id);
    if (!user || !(await isEligibleForDemo(user))) throw new Error("TARGET_NOT_ELIGIBLE");
    const issued = await createOneTimeTap(claimed.user_id);
    await pool().query("UPDATE flow_sessions SET status='issued' WHERE token_hash=$1", [claimed.token_hash]);
    await finishAttempt(claimed.attempt_id, "issued");
    const response = noStore(NextResponse.json({ ok: true, tap: issued.tap, expiresAt: issued.expiresAt }));
    clearSessionCookie(response);
    return response;
  } catch (error) {
    // A failed or timed-out Graph POST may have created a pass; never retry it automatically.
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const finalState = code === "TARGET_NOT_ELIGIBLE" || code === "ACTIVE_TAP_EXISTS" ? "rejected" : "unknown";
    await pool().query("UPDATE flow_sessions SET status=$2 WHERE token_hash=$1", [claimed.token_hash, finalState]).catch(() => undefined);
    await finishAttempt(claimed.attempt_id, finalState).catch(() => undefined);
    const response = fail(); clearSessionCookie(response); return response;
  }
}
