const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type DemoConfig = { tenantId: string; tenantName: string; allowedGroupId: string; appClientId: string; appClientSecret: string; rateLimitKey: string; alertEmail: string };

export function getDemoConfig(): DemoConfig | null {
  const keys = ["IDCHECK_MODE", "DEMO_ENABLED", "DEMO_TAP_ENABLED", "DEMO_TENANT_ID", "DEMO_TENANT_NAME", "DEMO_ALLOWED_GROUP_ID", "ENTRA_CLIENT_ID", "ENTRA_CLIENT_SECRET", "RATE_LIMIT_HMAC_KEY", "ALERT_EMAIL", "DATABASE_URL"];
  if (keys.some((key) => !process.env[key]) || process.env.IDCHECK_MODE !== "demo" || process.env.DEMO_ENABLED !== "true" || process.env.DEMO_TAP_ENABLED !== "true") return null;
  const tenantId = process.env.DEMO_TENANT_ID!; const allowedGroupId = process.env.DEMO_ALLOWED_GROUP_ID!;
  if (!GUID.test(tenantId) || !GUID.test(allowedGroupId) || !GUID.test(process.env.ENTRA_CLIENT_ID!)) return null;
  if (Buffer.byteLength(process.env.RATE_LIMIT_HMAC_KEY!, "utf8") < 32 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.ALERT_EMAIL!)) return null;
  return { tenantId, tenantName: process.env.DEMO_TENANT_NAME!, allowedGroupId, appClientId: process.env.ENTRA_CLIENT_ID!, appClientSecret: process.env.ENTRA_CLIENT_SECRET!, rateLimitKey: process.env.RATE_LIMIT_HMAC_KEY!, alertEmail: process.env.ALERT_EMAIL! };
}

export const LIFETIME_MINUTES = 60;
export const SESSION_MINUTES = 5;
