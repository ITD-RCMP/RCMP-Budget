import { getRequestProtocol, useSession } from "@tanstack/react-start/server";
import type { AuthUser } from "@/lib/auth";

export type SessionUser = {
  user?: AuthUser;
  msOAuth?: {
    state: string;
    verifier: string;
  };
};

const SESSION_PASSWORD = "budget_tracker-dev-session-secret-32";

export function getAuthSession() {
  const secure = getRequestProtocol() === "https";
  return useSession<SessionUser>({
    password: SESSION_PASSWORD,
    name: "budget_tracker",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure,
    },
  });
}
