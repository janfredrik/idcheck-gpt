import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { noStore, requireSameOrigin, SESSION_COOKIE, sha256 } from "@/lib/security";
export const dynamic = "force-dynamic";
export async function DELETE(request: NextRequest) {
  if (!requireSameOrigin(request)) return noStore(NextResponse.json({ ok: false }, { status: 403 }));
  const value = request.cookies.get(SESSION_COOKIE)?.value;
  if (value) await pool().query("UPDATE flow_sessions SET status='expired' WHERE token_hash=$1 AND status='verified'", [sha256(value)]).catch(() => undefined);
  const response = noStore(NextResponse.json({ ok: true }));
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
