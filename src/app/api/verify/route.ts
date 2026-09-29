import { NextRequest, NextResponse } from "next/server";
import { getDemoConfig, SESSION_MINUTES } from "@/lib/config";
import { consumeSimulation, finishAttempt } from "@/lib/audit";
import { findUniqueMobileMatch, isEligibleForDemo } from "@/lib/graph";
import { pool } from "@/lib/db";
import { genericFailure, hashForRateLimit, maskUpn, noStore, normalizeNorwegianMobile, randomToken, readJsonLimited, requireSameOrigin, setSessionCookie, sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const fail = (message = genericFailure, reference?: string) => noStore(NextResponse.json({ ok: false, message, ...(reference ? { reference } : {}) }));

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return fail();
  const config = getDemoConfig();
  if (!config) return fail("Demomiljøet er ikke konfigurert ennå.");
  const body = await readJsonLimited<{ tenantId?: unknown; mobile?: unknown; decision?: unknown; attemptToken?: unknown }>(request, 4096);
  if (!body || typeof body.tenantId !== "string" || typeof body.mobile !== "string" || body.mobile.length > 80 || typeof body.attemptToken !== "string" || body.attemptToken.length > 100) return fail();
  const mobile = normalizeNorwegianMobile(body.mobile);
  let attemptId: string | undefined;
  try {
    const attempt = await consumeSimulation({ tokenHash: sha256(body.attemptToken), tenantId: body.tenantId, phoneHash: hashForRateLimit(mobile ?? body.mobile.trim()), decision: String(body.decision), recipient: config.alertEmail });
    if (!attempt) return fail();
    attemptId = attempt.id;
    if (!attempt.approved) return fail(genericFailure, attemptId);
    if (!mobile || body.tenantId.toLowerCase() !== config.tenantId.toLowerCase()) { await finishAttempt(attemptId, "rejected", "INVALID_FLOW_INPUT"); return fail(genericFailure, attemptId); }

    const match = await findUniqueMobileMatch(mobile);
    const user = match.user;
    if (!user) { await finishAttempt(attemptId, "rejected", match.reason); return fail(genericFailure, attemptId); }
    if (!(await isEligibleForDemo(user))) { await finishAttempt(attemptId, "rejected", "ACCOUNT_NOT_ELIGIBLE"); return fail(genericFailure, attemptId); }
    const sessionToken = randomToken(); const csrf = randomToken();
    await pool().query("INSERT INTO flow_sessions (token_hash,csrf_hash,tenant_id,user_id,attempt_id,status,expires_at) VALUES ($1,$2,$3,$4,$5,'verified',now()+($6 * interval '1 minute'))", [sha256(sessionToken), sha256(csrf), config.tenantId, user.id, attemptId, SESSION_MINUTES]);
    await finishAttempt(attemptId, "verified");
    const response = noStore(NextResponse.json({ ok: true, account: maskUpn(user.userPrincipalName!), csrf, expiresInSeconds: SESSION_MINUTES * 60, reference: attemptId }));
    setSessionCookie(response, sessionToken, SESSION_MINUTES * 60);
    return response;
  } catch (error) {
    if (attemptId) await finishAttempt(attemptId, "unknown", error instanceof Error ? error.message : "INTERNAL_ERROR").catch(() => undefined);
    return fail(genericFailure, attemptId);
  }
}
