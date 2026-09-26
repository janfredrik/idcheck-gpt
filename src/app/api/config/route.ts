import { NextResponse } from "next/server";
import { getDemoConfig } from "@/lib/config";
import { noStore } from "@/lib/security";

export const dynamic = "force-dynamic";
export async function GET() {
  const config = getDemoConfig();
  if (!config) return noStore(NextResponse.json({ enabled: false }));
  return noStore(NextResponse.json({ enabled: true, tenants: [{ id: config.tenantId, name: config.tenantName }], mode: "simulated-vipps-real-tap" }));
}
