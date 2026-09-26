import { NextRequest, NextResponse } from "next/server";
import { getDemoConfig } from "@/lib/config";
import { transaction } from "@/lib/db";
import { checkRequiredDemoPermissions } from "@/lib/graph";
import { noStore, sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const result = (status: number, ok: boolean, message: string) => noStore(NextResponse.json({ ok, message }, { status }));

export async function GET(request: NextRequest) {
  const config = getDemoConfig(); const params = request.nextUrl.searchParams;
  const state = params.get("state"); const tenantId = params.get("tenant");
  if (!config || !state || state.length > 100 || !tenantId) return result(400, false, "Lenken er ugyldig eller utløpt. Opprett en ny consent-lenke.");
  try {
    const valid = await transaction(async (client) => {
      const found = await client.query<{ tenant_id: string; expires_at: Date; consumed_at: Date | null }>("SELECT tenant_id,expires_at,consumed_at FROM admin_consent_states WHERE state_hash=$1 FOR UPDATE", [sha256(state)]);
      const saved = found.rows[0];
      if (!saved || saved.consumed_at || saved.expires_at.getTime() <= Date.now() || saved.tenant_id.toLowerCase() !== config.tenantId.toLowerCase() || tenantId.toLowerCase() !== config.tenantId.toLowerCase()) return false;
      await client.query("UPDATE admin_consent_states SET consumed_at=now() WHERE state_hash=$1", [sha256(state)]);
      return true;
    });
    if (!valid) return result(400, false, "Lenken er ugyldig eller utløpt. Opprett en ny consent-lenke.");
    if (params.get("admin_consent")?.toLowerCase() !== "true") return result(403, false, "Administrator ga ikke admin consent.");
    await checkRequiredDemoPermissions();
    return result(200, true, "Admin consent ble bekreftet. Kjør deretter den lesende Entra-kontrollen før en TAP opprettes.");
  } catch {
    return result(403, false, "Tilgangen kunne ikke kontrolleres. Kontroller admin consent og opprett en ny engangslenke.");
  }
}
