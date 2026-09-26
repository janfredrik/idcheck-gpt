import { NextRequest, NextResponse } from "next/server";
import { getDemoConfig } from "@/lib/config";
import { beginAttempt, finishAttempt } from "@/lib/audit";
import { hashForRateLimit, genericFailure, noStore, normalizeNorwegianMobile, randomToken, readJsonLimited, requestIp, requireSameOrigin, sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const fail = (reference?: string) => noStore(NextResponse.json({ ok: false, message: genericFailure, ...(reference ? { reference } : {}) }));

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return fail();
  const config = getDemoConfig(); if (!config) return fail();
  const body = await readJsonLimited<{ tenantId?: unknown; mobile?: unknown }>(request, 4096);
  if (!body || typeof body.tenantId !== "string" || typeof body.mobile !== "string" || body.mobile.length > 80) return fail();
  const normalized = normalizeNorwegianMobile(body.mobile);
  const token = randomToken(); let attemptId: string | undefined;
  try {
    const attempt = await beginAttempt({ tenantId: config.tenantId, phoneHash: hashForRateLimit(normalized ?? body.mobile.trim()), ipHash: hashForRateLimit(`ip:${requestIp(request)}`), simulationTokenHash: sha256(token), recipient: config.alertEmail });
    attemptId = attempt.id;
    if (!attempt.allowed) return fail(attempt.id);
    if (body.tenantId.toLowerCase() !== config.tenantId.toLowerCase()) {
      await finishAttempt(attempt.id, "rejected", "TENANT_MISMATCH"); return fail(attempt.id);
    }
    if (!normalized) { await finishAttempt(attempt.id, "rejected", "INVALID_MOBILE"); return fail(attempt.id); }
    return noStore(NextResponse.json({ ok: true, attemptToken: token, expiresInSeconds: 300, reference: attempt.id }));
  } catch {
    if (attemptId) await finishAttempt(attemptId, "unknown", "START_FAILED").catch(() => undefined);
    return fail(attemptId);
  }
}
