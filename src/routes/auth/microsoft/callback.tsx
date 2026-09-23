import { createFileRoute } from "@tanstack/react-router";
import { completeMicrosoftLogin } from "@backend/server-functions/auth-fns";
import { homeForRole } from "@/lib/auth";

function callbackMessage(error: string) {
  if (error === "access_denied") return "Microsoft sign-in was cancelled. Try again.";
  if (error === "consent_required" || error === "interaction_required") {
    return "Microsoft needs an admin to approve this app. Ask them to allow it, then try again.";
  }
  return "Microsoft sign-in failed. Please try again.";
}

function redirectWithSession(href: string, headers: Headers) {
  const responseHeaders = new Headers();
  const cookies = headers.getSetCookie();
  if (cookies.length > 0) {
    for (const cookie of cookies) responseHeaders.append("set-cookie", cookie);
  } else {
    const raw = headers.get("set-cookie");
    if (raw) responseHeaders.append("set-cookie", raw);
  }
  responseHeaders.set("location", href);
  return new Response(null, { status: 303, headers: responseHeaders });
}

export const Route = createFileRoute("/auth/microsoft/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getResponseHeaders } = await import("@tanstack/react-start/server");
        const url = new URL(request.url);
        const send = (pathname: string, message?: string) => {
          const target = new URL(pathname, url.origin);
          if (message) target.searchParams.set("error", message);
          return redirectWithSession(target.toString(), getResponseHeaders());
        };

        const microsoftError = url.searchParams.get("error");
        if (microsoftError) return send("/login", callbackMessage(microsoftError));

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) {
          return send("/login", "Microsoft sign-in was incomplete. Try signing in again.");
        }

        try {
          const user = await completeMicrosoftLogin({ data: { code, state } });
          const to = homeForRole(user);
          if (!to) {
            return send("/login", "Your account role has no workspace yet. Contact support for help.");
          }
          return send(to);
        } catch (error) {
          return send(
            "/login",
            error instanceof Error
              ? error.message
              : "Microsoft sign-in failed. Please try again.",
          );
        }
      },
    },
  },
  component: MicrosoftCallbackPage,
});

function MicrosoftCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-foreground/60">Signing you in</p>
    </div>
  );
}
