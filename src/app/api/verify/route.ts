import { NextRequest, NextResponse } from "next/server";
import { getDemoConfig, SESSION_MINUTES } from "@/lib/config";
import { beginAttempt, finishAttempt } from "@/lib/audit";
import { findUniqueMobileMatch, isEligibleForDemo } from "@/lib/graph";
import { pool } from "@/lib/db";
import { genericFailure, hashForRateLimit, maskUpn, noStore, normalizeNorwegianMobile, randomToken, requestIp, requireSameOrigin, SESSION_COOKIE, setSessionCookie, sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const fail = (message = genericFailure) => noStore(NextResponse.json({ ok: false, message }));

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return fail();
  const config = getDemoConfig();
  if (!config) return fail("Demomiljøet er ikke konfigurert ennå.");
  let body: { tenantId?: unknown; mobile?: unknown; decision?: unknown };
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 4096) return fail();
    body = await request.json();
  } catch { return fail(); }
  if (typeof body.tenantId !== "string" || body.tenantId.toLowerCase() !== config.tenantId.toLowerCase() || typeof body.mobile !== "string" || body.mobile.length > 40 || !["approved", "denied"].includes(String(body.decision))) return fail();
  const mobile = normalizeNorwegianMobile(body.mobile);
  if (!mobile) return fail();

  let attemptId: string | undefined;
  try {
    const started = await beginAttempt({ tenantId: config.tenantId, phoneHash: hashForRateLimit(mobile), ipHash: hashForRateLimit(`ip:${requestIp(request)}`), recipient: config.alertEmail });
    attemptId = started.id;
    if (!started.allowed) return fail();
    if (body.decision === "denied") {
      await finishAttempt(attemptId, "rejected");
      return fail();
    }

    const user = await findUniqueMobileMatch(mobile);
    if (!user || !config.allowedUserIds.has(user.id.toLowerCase()) || !(await isEligibleForDemo(user))) {
      await finishAttempt(attemptId, "rejected");
      return fail();
    }
    const sessionToken = randomToken(); const csrf = randomToken();
    await pool().query("INSERT INTO flow_sessions (token_hash,csrf_hash,tenant_id,user_id,attempt_id,status,expires_at) VALUES ($1,$2,$3,$4,$5,'verified',now()+($6 * interval '1 minute'))", [sha256(sessionToken), sha256(csrf), config.tenantId, user.id, attemptId, SESSION_MINUTES]);
    await finishAttempt(attemptId, "verified");
    const response = noStore(NextResponse.json({ ok: true, account: maskUpn(user.userPrincipalName!), csrf, expiresInSeconds: SESSION_MINUTES * 60 }));
    setSessionCookie(response, sessionToken, SESSION_MINUTES * 60);
    return response;
  } catch (error) {
    if (attemptId) await finishAttempt(attemptId, error instanceof Error && error.message === "RATE_LIMITED" ? "rejected" : "unknown").catch(() => undefined);
    return fail();
  }
}
