import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { finishAttempt } from "@/lib/audit";
import { noStore, readJsonLimited, requireSameOrigin, SESSION_COOKIE, sha256 } from "@/lib/security";
export const dynamic = "force-dynamic";
export async function DELETE(request: NextRequest) {
  if (!requireSameOrigin(request)) return noStore(NextResponse.json({ ok: false }, { status: 403 }));
  const body = await readJsonLimited<{ attemptToken?: unknown }>(request, 1024);
  const client = await pool().connect();
  let attemptId: string | undefined;
  try {
    await client.query("BEGIN");
    if (typeof body?.attemptToken === "string" && body.attemptToken.length <= 100) {
      const cancelled = await client.query<{ id: string }>("UPDATE attempts SET outcome='expired',reason_code='USER_CANCELLED',finished_at=now() WHERE simulation_token_hash=$1 AND outcome='started' RETURNING id", [sha256(body.attemptToken)]);
      attemptId = cancelled.rows[0]?.id;
    }
    const value = request.cookies.get(SESSION_COOKIE)?.value;
    if (value) {
      const expired = await client.query<{ attempt_id: string }>("UPDATE flow_sessions SET status='expired' WHERE token_hash=$1 AND status='verified' RETURNING attempt_id", [sha256(value)]);
      attemptId = expired.rows[0]?.attempt_id ?? attemptId;
    }
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
  } finally { client.release(); }
  if (attemptId) await finishAttempt(attemptId, "expired", "USER_CANCELLED").catch(() => undefined);
  const response = noStore(NextResponse.json({ ok: true }));
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
