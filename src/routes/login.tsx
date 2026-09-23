import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Wordmark } from "@/components/landing/Nav";
import { toast } from "sonner";
import { devLoginAsRole, login, startMicrosoftLogin } from "@backend/server-functions/auth-fns";
import { homeForRole, type RoleName } from "@/lib/auth";

function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

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
        content:
          "Sign in to your Budget Tracker workspace with your staff ID or UniKL Microsoft account.",
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
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"staff" | "microsoft" | null>(null);
  const [devRole, setDevRole] = useState<RoleName | null>(null);
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const goHome = async (user: { roleId: number; roleName: RoleName }) => {
    const to = homeForRole(user);
    if (!to) {
      toast.error("Your account role has no workspace yet. Contact support for help.");
      return;
    }
    await navigate({ to });
  };

  const signInWithStaff = async (event: FormEvent) => {
    event.preventDefault();
    setMode("staff");
    setBusy(true);
    try {
      const user = await login({ data: { staffId, password } });
      await goHome(user);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed. Check your details and try again.");
    } finally {
      setBusy(false);
      setMode(null);
    }
  };

  const signInWithMicrosoft = async () => {
    setMode("microsoft");
    setBusy(true);
    try {
      await redirectToMicrosoft();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Microsoft sign-in failed. Please try again.",
      );
      setBusy(false);
      setMode(null);
    }
  };

  const loginAs = async (role: RoleName) => {
    setDevRole(role);
    setBusy(true);
    try {
      const user = await devLoginAsRole({ data: { role } });
      await goHome(user);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dev sign-in failed. Please try again.");
    } finally {
      setBusy(false);
      setDevRole(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-foreground">
      <Wordmark />
      <div className="mt-10 w-full max-w-sm text-center">
        <h1 className="font-display text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-foreground/60">
          Use your staff ID and password, or your UniKL Microsoft account.
        </p>
        <form onSubmit={signInWithStaff} className="mt-8 space-y-3 text-left">
          <label className="block text-xs font-medium text-foreground/60">
            Staff ID
            <input
              name="staffId"
              inputMode="numeric"
              autoComplete="username"
              value={staffId}
              onChange={(event) => setStaffId(event.target.value)}
              required
              disabled={busy}
              className="mt-1.5 w-full rounded-2xl border border-foreground/15 bg-ivory px-4 py-3 text-base text-foreground outline-none transition focus:border-foreground/40 disabled:opacity-60"
            />
          </label>
          <div className="block text-left text-xs font-medium text-foreground/60">
            <label htmlFor="password">Password</label>
            <div className="relative mt-1.5">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={busy}
                className="w-full rounded-2xl border border-foreground/15 bg-ivory py-3 pr-12 pl-4 text-base text-foreground outline-none transition focus:border-foreground/40 disabled:opacity-60"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowPassword((open) => !open)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-3 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-foreground/45 transition hover:text-foreground disabled:opacity-60"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-full bg-lime py-4 text-base font-medium text-lime-foreground transition hover:brightness-95 disabled:opacity-60"
          >
            {mode === "staff" ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="my-6 flex items-center gap-3 text-xs text-foreground/40">
          <span className="h-px flex-1 bg-foreground/10" />
          or
          <span className="h-px flex-1 bg-foreground/10" />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={signInWithMicrosoft}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-foreground/15 bg-ivory py-4 text-base font-medium transition hover:bg-ivory/70 disabled:opacity-60"
        >
          <MicrosoftLogo className="h-5 w-5 shrink-0" />
          {mode === "microsoft" ? "Redirecting…" : "Continue with Microsoft"}
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
