import { loadEnvFile } from "@backend/core/env";

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getMicrosoftConfig() {
  loadEnvFile();
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim() || "organizations";
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return {
    tenant,
    clientId,
    clientSecret,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
  };
}

async function getAppAccessToken() {
  const config = getMicrosoftConfig();
  if (!config) return null;

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return asString(json.access_token) || null;
}

export async function fetchGraphDisplayNameByOid(oid: string): Promise<string | null> {
  const token = await getAppAccessToken();
  if (!token) return null;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(oid)}?$select=displayName`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;

  const me = (await res.json()) as { displayName?: string | null };
  return asString(me.displayName) || null;
}

export async function resolveUserFullName(input: {
  userId: number;
  sessionFullName?: string | null;
}): Promise<string | null> {
  const fromSession = asString(input.sessionFullName);
  if (fromSession) return fromSession;

  const { query } = await import("@backend/core/db");
  const rows = await query<{ oid: string | null }[]>(
    "SELECT oid FROM users WHERE user_id = ? LIMIT 1",
    [input.userId],
  );
  const oid = asString(rows[0]?.oid);
  if (!oid) return null;

  try {
    const fullName = await fetchGraphDisplayNameByOid(oid);
    if (fullName) {
      const { getAuthSession } = await import("@backend/core/session");
      const session = await getAuthSession();
      if (session.data.user?.userId === input.userId) {
        await session.update({
          user: { ...session.data.user, fullName },
        });
      }
    }
    return fullName;
  } catch {
    return null;
  }
}
