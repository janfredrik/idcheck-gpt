import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { getDemoConfig } from "@/lib/config";
export const genericFailure = "Vi kunne ikke bekrefte identiteten din automatisk, kontakt IT-avdelingen";
export const SESSION_COOKIE = "__Host-idcheck_session";
export function randomToken(bytes = 32): string { return randomBytes(bytes).toString("base64url"); }
export function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
export function hashForRateLimit(value: string): string { const config = getDemoConfig(); if (!config) throw new Error("CONFIG_INVALID"); return createHmac("sha256", config.rateLimitKey).update(value).digest("hex"); }
export function safeEqual(left: string, right: string): boolean { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
export function requestIp(request: NextRequest): string { return (request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown").slice(0, 80); }
export function requireSameOrigin(request: NextRequest): boolean { const origin = request.headers.get("origin"); return !!origin && origin === request.nextUrl.origin; }
export function setSessionCookie(response: NextResponse, token: string, maxAge: number): void { response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge }); }
export function clearSessionCookie(response: NextResponse): void { response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 }); }
export function normalizeNorwegianMobile(input: string): string | null {
  const digits = input.trim().replace(/[\s().-]/g, ""); let normalized: string;
  if (/^\+\d{8,15}$/.test(digits)) normalized = digits; else if (/^00\d{8,15}$/.test(digits)) normalized = `+${digits.slice(2)}`; else if (/^\d{8}$/.test(digits)) normalized = `+47${digits}`; else return null;
  if (normalized.startsWith("+47") && !/^\+47(?:4|9)\d{7}$/.test(normalized)) return null;
  return normalized;
}
export function maskUpn(upn: string): string { const [local, domain] = upn.split("@"); return local && domain ? `${local[0]}•••@${domain}` : "••••"; }
export function noStore(response: NextResponse): NextResponse { response.headers.set("Cache-Control", "no-store, max-age=0"); response.headers.set("Pragma", "no-cache"); return response; }
