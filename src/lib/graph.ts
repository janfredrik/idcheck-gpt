import { ConfidentialClientApplication } from "@azure/msal-node";
import { getDemoConfig, LIFETIME_MINUTES } from "@/lib/config";

type GraphUser = { id: string; userPrincipalName?: string; mobilePhone?: string | null; accountEnabled?: boolean; userType?: string };
type GraphPage<T> = { value?: T[]; "@odata.nextLink"?: string };
let msalApp: ConfidentialClientApplication | undefined;

function client(): ConfidentialClientApplication {
  const config = getDemoConfig(); if (!config) throw new Error("CONFIG_INVALID");
  if (!msalApp) msalApp = new ConfidentialClientApplication({ auth: { clientId: config.appClientId, authority: `https://login.microsoftonline.com/${config.tenantId}`, clientSecret: config.appClientSecret } });
  return msalApp;
}
async function token(): Promise<string> {
  const result = await client().acquireTokenByClientCredential({ scopes: ["https://graph.microsoft.com/.default"] });
  if (!result?.accessToken) throw new Error("GRAPH_AUTH_FAILED"); return result.accessToken;
}
async function throwGraphError(response: Response, operation: string): Promise<never> {
  let code = "";
  try {
    const body = await response.json() as { error?: { code?: unknown } };
    if (typeof body.error?.code === "string") code = body.error.code.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 20);
  } catch { /* Keep diagnostics to the HTTP status if Graph returned no JSON body. */ }
  throw new Error(`GRAPH_${operation}_${response.status}${code ? `_${code}` : ""}`);
}

async function getJson<T>(url: string, accessToken: string, operation = "REQUEST", eventualConsistency = false): Promise<T> {
  const parsed = new URL(url);
  if (parsed.origin !== "https://graph.microsoft.com" || !parsed.pathname.startsWith("/v1.0/")) throw new Error("GRAPH_URL_REJECTED");
  const headers = new Headers({ Authorization: `Bearer ${accessToken}`, Accept: "application/json" });
  if (eventualConsistency) headers.set("ConsistencyLevel", "eventual");
  const response = await fetch(parsed, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) await throwGraphError(response, operation);
  return response.json() as Promise<T>;
}
async function collect<T>(url: string, accessToken: string, maximumPages = 50, operation = "LIST", eventualConsistency = false): Promise<T[]> {
  const results: T[] = []; let next: string | undefined = url; let pages = 0;
  while (next) {
    if (++pages > maximumPages) throw new Error("GRAPH_RESULT_LIMIT");
    const page: GraphPage<T> = await getJson<GraphPage<T>>(next, accessToken, operation, eventualConsistency);
    if (!Array.isArray(page.value)) throw new Error("GRAPH_RESULT_INVALID");
    results.push(...page.value); if (results.length > 10000) throw new Error("GRAPH_RESULT_LIMIT");
    next = page["@odata.nextLink"];
  }
  return results;
}
function graphUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(`https://graph.microsoft.com/v1.0/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
  return url.toString();
}

export async function findUniqueMobileMatch(mobile: string): Promise<{ user: GraphUser | null; reason: string }> {
  const config = getDemoConfig(); if (!config) throw new Error("CONFIG_INVALID");
  const accessToken = await token(); const escaped = mobile.replaceAll("'", "''");
  const users = await collect<GraphUser>(graphUrl("users", { "$filter": `mobilePhone eq '${escaped}'`, "$select": "id,userPrincipalName,mobilePhone,accountEnabled,userType", "$top": "100", "$count": "true" }), accessToken, 3, "USER_LOOKUP", true);
  const exactMatches = users.filter((user) => user.mobilePhone === mobile);
  return exactMatches.length === 1 ? { user: exactMatches[0], reason: "MATCHED" } : { user: null, reason: exactMatches.length ? "AMBIGUOUS_MATCH" : "NO_MATCH" };
}

export async function getUserById(userId: string): Promise<GraphUser | null> {
  const config = getDemoConfig(); if (!config || !config.allowedUserIds.has(userId.toLowerCase())) return null;
  const accessToken = await token();
  return getJson<GraphUser>(graphUrl(`users/${encodeURIComponent(userId)}`, { "$select": "id,userPrincipalName,mobilePhone,accountEnabled,userType" }), accessToken, "USER_BY_ID");
}

export async function checkRequiredDemoPermissions(): Promise<void> {
  const config = getDemoConfig(); if (!config) throw new Error("CONFIG_INVALID");
  const freshClient = new ConfidentialClientApplication({ auth: { clientId: config.appClientId, authority: `https://login.microsoftonline.com/${config.tenantId}`, clientSecret: config.appClientSecret } });
  const result = await freshClient.acquireTokenByClientCredential({ scopes: ["https://graph.microsoft.com/.default"] });
  if (!result?.accessToken) throw new Error("GRAPH_AUTH_FAILED");
  const parts = result.accessToken.split(".");
  if (parts.length !== 3) throw new Error("GRAPH_TOKEN_INVALID");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { tid?: string; aud?: string; exp?: number; roles?: string[] };
  const graphAudiences = new Set(["https://graph.microsoft.com", "00000003-0000-0000-c000-000000000000"]);
  const requiredRoles = ["User.Read.All", "UserAuthMethod-TAP.ReadWrite.All", "Policy.Read.AuthenticationMethod", "RoleManagement.Read.Directory"];
  if (claims.tid?.toLowerCase() !== config.tenantId.toLowerCase() || !claims.aud || !graphAudiences.has(claims.aud) || !claims.exp || claims.exp * 1000 <= Date.now() || !requiredRoles.every((role) => claims.roles?.includes(role))) throw new Error("GRAPH_PERMISSION_MISSING");
  const userId = [...config.allowedUserIds][0];
  const user = await getJson<GraphUser>(graphUrl(`users/${encodeURIComponent(userId)}`, { "$select": "id" }), result.accessToken, "CONSENT_USER_CHECK");
  if (user.id.toLowerCase() !== userId.toLowerCase()) throw new Error("GRAPH_USER_CHECK_FAILED");
}

export async function isEligibleForDemo(user: GraphUser): Promise<boolean> {
  const config = getDemoConfig();
  if (!config || !config.allowedUserIds.has(user.id.toLowerCase())) return false;
  if (user.accountEnabled !== true || user.userType !== "Member" || !user.userPrincipalName) return false;
  const accessToken = await token();
  const groups = await collect<{ id?: string }>(graphUrl(`users/${encodeURIComponent(user.id)}/transitiveMemberOf/microsoft.graph.group`, { "$select": "id", "$top": "999", "$count": "true" }), accessToken, 50, "GROUP_MEMBERSHIP", true);
  const groupIds = new Set(groups.flatMap(({ id }) => id ? [id.toLowerCase()] : []));
  if (!groupIds.has(config.allowedGroupId.toLowerCase())) return false;

  const policy = await getJson<{
    state?: string; minimumLifetimeInMinutes?: number; maximumLifetimeInMinutes?: number;
    includeTargets?: Array<{ id?: string; targetType?: string }>;
    excludeTargets?: Array<{ id?: string; targetType?: string }>;
  }>(graphUrl("policies/authenticationMethodsPolicy/authenticationMethodConfigurations/temporaryAccessPass"), accessToken, "TAP_POLICY");
  if (policy.state !== "enabled" || policy.minimumLifetimeInMinutes == null || policy.maximumLifetimeInMinutes == null) return false;
  if (LIFETIME_MINUTES < policy.minimumLifetimeInMinutes || LIFETIME_MINUTES > policy.maximumLifetimeInMinutes) return false;
  const principals = new Set([user.id.toLowerCase(), ...groupIds]);
  const includes = policy.includeTargets ?? []; const excludes = policy.excludeTargets ?? [];
  const isIncluded = includes.some((target) => target.id === "all_users" || (!!target.id && principals.has(target.id.toLowerCase())));
  const isExcluded = excludes.some((target) => target.id === "all_users" || (!!target.id && principals.has(target.id.toLowerCase())));
  if (!isIncluded || isExcluded) return false;

  // Fail closed for active directory roles, whether assigned directly or through a transitive group.
  const assignments = await collect<{ principalId?: string }>(graphUrl("roleManagement/directory/roleAssignments", { "$select": "principalId" }), accessToken, 50, "ROLE_ASSIGNMENTS");
  if (assignments.some((role) => role.principalId && principals.has(role.principalId.toLowerCase()))) return false;
  return true;
}

export async function createOneTimeTap(userId: string): Promise<{ tap: string; expiresAt: string }> {
  const config = getDemoConfig(); if (!config || !config.allowedUserIds.has(userId.toLowerCase())) throw new Error("TARGET_NOT_ALLOWED");
  const accessToken = await token();
  const existing = await getJson<{ value?: Array<{ startDateTime?: string; lifetimeInMinutes?: number }> }>(graphUrl(`users/${encodeURIComponent(userId)}/authentication/temporaryAccessPassMethods`), accessToken, "TAP_LIST");
  const now = Date.now();
  const hasLivePass = (existing.value ?? []).some((pass) => {
    const start = Date.parse(pass.startDateTime ?? ""); const life = pass.lifetimeInMinutes;
    return Number.isFinite(start) && Number.isFinite(life) && start + life! * 60000 > now;
  });
  if (hasLivePass) throw new Error("ACTIVE_TAP_EXISTS");

  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}/authentication/temporaryAccessPassMethods`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ lifetimeInMinutes: LIFETIME_MINUTES, isUsableOnce: true }), cache: "no-store", signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) await throwGraphError(response, "TAP_CREATE");
  const method = await response.json() as { temporaryAccessPass?: string; startDateTime?: string; lifetimeInMinutes?: number };
  if (typeof method.temporaryAccessPass !== "string" || !method.temporaryAccessPass) throw new Error("GRAPH_TAP_RESPONSE_INVALID");
  const start = Date.parse(method.startDateTime ?? new Date().toISOString()); const lifetime = method.lifetimeInMinutes ?? LIFETIME_MINUTES;
  return { tap: method.temporaryAccessPass, expiresAt: new Date(start + lifetime * 60000).toISOString() };
}
