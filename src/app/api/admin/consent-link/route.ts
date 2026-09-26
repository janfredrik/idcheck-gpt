import { NextRequest, NextResponse } from "next/server";
import { getDemoConfig } from "@/lib/config";
import { pool } from "@/lib/db";
import { noStore, randomToken, requireSameOrigin, sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return noStore(NextResponse.json({ ok: false }, { status: 403 }));
  const config = getDemoConfig();
  const base = process.env.PUBLIC_BASE_URL;
  if (!config || !base) return noStore(NextResponse.json({ ok: false, message: "Konfigurer demomiljø og offentlig HTTPS-adresse først." }, { status: 503 }));
  let baseUrl: URL;
  try { baseUrl = new URL(base); } catch { return noStore(NextResponse.json({ ok: false, message: "Offentlig adresse er ugyldig." }, { status: 503 })); }
  if (baseUrl.protocol !== "https:" || baseUrl.pathname !== "/" || baseUrl.search || baseUrl.hash || baseUrl.username || baseUrl.password) return noStore(NextResponse.json({ ok: false, message: "Bruk en offentlig HTTPS-origin uten sti." }, { status: 503 }));

  const state = randomToken();
  try {
    await pool().query("DELETE FROM admin_consent_states WHERE expires_at < now()-interval '1 day'");
    await pool().query("INSERT INTO admin_consent_states (state_hash,tenant_id,expires_at) VALUES ($1,$2,now()+interval '15 minutes')", [sha256(state), config.tenantId]);
    const callback = new URL("/api/admin/consent-callback", baseUrl);
    const consent = new URL(`https://login.microsoftonline.com/${config.tenantId}/v2.0/adminconsent`);
    consent.searchParams.set("client_id", config.appClientId);
    consent.searchParams.set("scope", "https://graph.microsoft.com/.default");
    consent.searchParams.set("redirect_uri", callback.toString());
    consent.searchParams.set("state", state);
    return noStore(NextResponse.json({ ok: true, url: consent.toString(), expiresInSeconds: 900 }));
  } catch {
    return noStore(NextResponse.json({ ok: false, message: "Kunne ikke opprette engangslenke." }, { status: 503 }));
  }
}
