import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/landing/Nav";
import { toast } from "sonner";
import { devLoginAsRole, startMicrosoftLogin } from "@backend/server-functions/auth-fns";
import { homeForRole, type RoleName } from "@/lib/auth";

type LoginSearch = {
  error?: string;
};

const isDev = import.meta.env.DEV;

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Budget Tracker" },
      {
        name: "description",
        content: "Sign in to your Budget Tracker workspace with your UniKL Microsoft account.",
      },
    ],
  }),
  component: LoginPage,
});

async function redirectToMicrosoft() {
  const { url } = await startMicrosoftLogin();
  window.location.assign(url);
}

function LoginPage() {
  const navigate = useNavigate();
  const { error } = Route.useSearch();
  const started = useRef(false);
  const [failed, setFailed] = useState(Boolean(error));
  const [busy, setBusy] = useState(false);
  const [devRole, setDevRole] = useState<RoleName | null>(null);

  useEffect(() => {
    if (error) {
      toast.error(error);
      setFailed(true);
      return;
    }
    if (isDev) return;
    if (started.current) return;
    started.current = true;
    setBusy(true);
    redirectToMicrosoft().catch((err) => {
      toast.error(
        err instanceof Error ? err.message : "Microsoft sign-in failed. Please try again.",
      );
      setFailed(true);
      setBusy(false);
    });
  }, [error]);

  const retry = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await redirectToMicrosoft();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Microsoft sign-in failed. Please try again.",
      );
      setFailed(true);
      setBusy(false);
    }
  };

  const loginAs = async (role: RoleName) => {
    setDevRole(role);
    setBusy(true);
    try {
      const user = await devLoginAsRole({ data: { role } });
      const to = homeForRole(user);
      if (!to) {
        toast.error("Your account role has no workspace yet. Contact support for help.");
        return;
      }
      await navigate({ to });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dev sign-in failed. Please try again.");
    } finally {
      setBusy(false);
      setDevRole(null);
    }
  };

  if (!failed && !isDev) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-foreground">
        <Wordmark />
        <p className="mt-10 text-sm text-foreground/60">
          {busy ? "Signing you in…" : "Redirecting to Microsoft…"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-foreground">
      <Wordmark />
      <div className="mt-10 w-full max-w-sm text-center">
        <h1 className="font-display text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-foreground/60">
          Use your UniKL Microsoft account to continue.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={retry}
          className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-lime py-4 text-base font-medium text-lime-foreground transition hover:brightness-95 disabled:opacity-60"
        >
          {busy ? "Redirecting…" : "Continue with Microsoft"}
        </button>
        {isDev ? (
          <div className="mt-8 space-y-3">
            <p className="text-xs font-medium tracking-wide text-foreground/40 uppercase">
              Development only
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => loginAs("User")}
              className="inline-flex w-full items-center justify-center rounded-full border border-foreground/10 py-3 text-sm text-foreground/70 transition hover:text-foreground disabled:opacity-60"
            >
              {devRole === "User" ? "Signing in…" : "Login as User"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => loginAs("HOD")}
              className="inline-flex w-full items-center justify-center rounded-full border border-foreground/10 py-3 text-sm text-foreground/70 transition hover:text-foreground disabled:opacity-60"
            >
              {devRole === "HOD" ? "Signing in…" : "Login as HOD"}
            </button>
          </div>
        ) : null}
        <p className="mt-8 text-xs text-foreground/50">
          <Link to="/" className="hover:text-foreground">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
