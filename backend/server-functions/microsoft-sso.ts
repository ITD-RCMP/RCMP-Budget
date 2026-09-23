import { createHash, randomBytes } from "node:crypto";
import { getAuthSession } from "@backend/core/session";
import { loadEnvFile } from "@backend/core/env";
import type { AuthUser, RoleName } from "@/lib/auth";

type UserRow = {
  user_id: number;
  staff_id: number | null;
  email: string;
  oid: string | null;
  department_id: number | null;
  department: string | null;
  designation: string | null;
  role_id: number;
  role_name: string;
};

type MicrosoftProfile = {
  oid: string;
  email: string;
  fullName: string | null;
};

const MICROSOFT_SCOPES = "openid profile email User.Read";

const USER_SELECT = `SELECT u.user_id, u.staff_id, u.email, u.oid, u.department_id,
       d.department_name AS department, u.designation, u.role_id, r.role_name
FROM users u
INNER JOIN roles r ON r.role_id = u.role_id
LEFT JOIN departments d ON d.department_id = u.department_id`;

function toAuthUser(row: UserRow, fullName: string | null = null): AuthUser {
  return {
    userId: row.user_id,
    staffId: row.staff_id,
    email: row.email,
    fullName,
    departmentId: row.department_id,
    department: row.department,
    designation: row.designation,
    roleId: row.role_id,
    roleName: row.role_name as RoleName,
  };
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error("Microsoft sign-in isn't set up yet. Ask an admin to finish setup.");
  }
  return value;
}

function getMicrosoftConfig() {
  loadEnvFile();
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim() || "organizations";
  const clientId = requiredEnv("MICROSOFT_CLIENT_ID");
  const clientSecret = requiredEnv("MICROSOFT_CLIENT_SECRET");
  const appUrl = (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI?.trim() || `${appUrl}/auth/microsoft/callback`;
  return {
    tenant,
    clientId,
    clientSecret,
    redirectUri,
    authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
  };
}

function randomUrlToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
  error_codes?: number[];
};

function microsoftFailureMessage(token: TokenResponse) {
  const codes = token.error_codes ?? [];
  const detail = `${token.error ?? ""} ${token.error_description ?? ""}`.toLowerCase();
  if (codes.includes(7000215) || detail.includes("invalid_client") || detail.includes("client secret")) {
    return "Microsoft rejected the app secret. Ask an admin to create a new secret and update the server.";
  }
  if (codes.includes(50011) || detail.includes("redirect_uri")) {
    return "The Microsoft return address doesn't match this site. Ask an admin to update it, then try again.";
  }
  if (codes.includes(65001) || codes.includes(70011) || detail.includes("consent")) {
    return "Microsoft needs an admin to approve this app. Ask them to allow it, then try again.";
  }
  if (codes.includes(50148) || detail.includes("invalid_grant") || detail.includes("code_verifier")) {
    return "This sign-in link expired. Start again from the login page.";
  }
  return "Microsoft sign-in failed. Please try again.";
}

function isPublicClientRejection(token: TokenResponse) {
  const codes = token.error_codes ?? [];
  if (codes.includes(700025)) return true;
  const detail = (token.error_description ?? "").toLowerCase();
  return detail.includes("public") && detail.includes("client_secret");
}

async function requestToken(tokenUrl: string, body: URLSearchParams) {
  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  let tokenJson: TokenResponse;
  try {
    tokenJson = (await tokenRes.json()) as TokenResponse;
  } catch {
    throw new Error("Microsoft sign-in failed. Please try again.");
  }
  return { ok: tokenRes.ok, tokenJson };
}

async function fetchMicrosoftProfile(
  tokenUrl: string,
  body: URLSearchParams,
): Promise<MicrosoftProfile> {
  let { ok, tokenJson } = await requestToken(tokenUrl, body);
  if (!ok && isPublicClientRejection(tokenJson)) {
    body.delete("client_secret");
    ({ ok, tokenJson } = await requestToken(tokenUrl, body));
  }
  if (!ok || !tokenJson.id_token) {
    console.error("Microsoft token error", tokenJson.error, tokenJson.error_codes);
    throw new Error(microsoftFailureMessage(tokenJson));
  }

  const claims = decodeJwtPayload(tokenJson.id_token);
  let oid = asString(claims?.oid);
  let email =
    asString(claims?.email) ||
    asString(claims?.preferred_username) ||
    asString(claims?.upn) ||
    asString(claims?.unique_name);
  let fullName = asString(claims?.name) || null;

  if (tokenJson.access_token) {
    const meRes = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName",
      { headers: { authorization: `Bearer ${tokenJson.access_token}` } },
    );
    if (meRes.ok) {
      const me = (await meRes.json()) as {
        id?: string;
        displayName?: string | null;
        mail?: string | null;
        userPrincipalName?: string | null;
      };
      oid = asString(me.id) || oid;
      email = asString(me.mail) || asString(me.userPrincipalName) || email;
      fullName = asString(me.displayName) || fullName;
    }
  }

  if (!oid || !email) {
    throw new Error("Microsoft did not return your account details. Try again.");
  }

  return { oid, email, fullName };
}

export async function startMicrosoftSso() {
  const config = getMicrosoftConfig();
  const state = randomUrlToken();
  const verifier = randomUrlToken();
  const session = await getAuthSession();
  await session.update({
    user: session.data.user,
    msOAuth: { state, verifier },
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    response_mode: "query",
    scope: MICROSOFT_SCOPES,
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  return { url: `${config.authorizeUrl}?${params.toString()}` };
}

export async function completeMicrosoftSso(input: { code: string; state: string }) {
  const session = await getAuthSession();
  const pending = session.data.msOAuth;
  if (!pending || pending.state !== input.state) {
    throw new Error("This sign-in link expired. Start again from the login page.");
  }

  const config = getMicrosoftConfig();
  const profile = await fetchMicrosoftProfile(
    config.tokenUrl,
    new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: config.redirectUri,
      scope: MICROSOFT_SCOPES,
      code_verifier: pending.verifier,
    }),
  );

  const { query } = await import("@backend/core/db");
  const rows = await query<UserRow[]>(
    `${USER_SELECT} WHERE LOWER(u.email) = LOWER(?) LIMIT 1`,
    [profile.email],
  );
  const row = rows[0];
  if (!row) {
    throw new Error("This email is not allowed to sign in. Ask an admin to add it first.");
  }
  if (row.oid && row.oid !== profile.oid) {
    throw new Error("This Microsoft account doesn't match your staff record. Contact support.");
  }

  await query(
    "UPDATE users SET oid = ?, last_login = CURRENT_TIMESTAMP WHERE user_id = ?",
    [profile.oid, row.user_id],
  );

  const user = toAuthUser(row, profile.fullName);
  await session.update({ user, msOAuth: undefined });
  return user;
}
