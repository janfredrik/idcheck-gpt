import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();
  const username = process.env.APP_ACCESS_USER;
  const password = process.env.APP_ACCESS_PASSWORD;
  if (!username || !password || username.length < 3 || password.length < 20) return new NextResponse("Application access is not configured.", { status: 503 });
  const [scheme, encoded] = (request.headers.get("authorization") ?? "").split(" ");
  if (scheme?.toLowerCase() === "basic" && encoded) {
    try {
      const decoded = Buffer.from(encoded, "base64").toString("utf8"); const separator = decoded.indexOf(":");
      if (separator > 0 && equalSecret(decoded.slice(0, separator), username) && equalSecret(decoded.slice(separator + 1), password)) return NextResponse.next();
    } catch { /* Return the same challenge for malformed credentials. */ }
  }
  return new NextResponse("Authentication required.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="idcheck demo", charset="UTF-8"', "Cache-Control": "no-store" } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
