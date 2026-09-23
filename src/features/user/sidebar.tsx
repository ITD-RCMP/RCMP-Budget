import { useEffect, useState } from "react";
import { Link, useNavigate, type LinkProps } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  LogOut,
  Menu,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/landing/Nav";
import { cn } from "@/lib/utils";
import { getCurrentUser, logout } from "@backend/server-functions/auth-fns";
import type { AuthUser } from "@/lib/auth";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const items: { label: string; icon: LucideIcon; to?: LinkProps["to"] }[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/user" },
  { label: "My Department", icon: Building2, to: "/user/department" },
  { label: "History", icon: FileText, to: "/user/history" },
];

const itemClass =
  "inline-flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition";
const inactiveClass = "text-foreground/60 hover:bg-ivory hover:text-foreground";

function SidebarNav({
  user,
  onNavigate,
}: {
  user: AuthUser | null;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const initial =
    user?.email?.trim()?.charAt(0)?.toUpperCase() ||
    user?.roleName?.charAt(0) ||
    "?";
  const subtitle = [
    user?.roleName,
    user?.designation || user?.department,
  ]
    .filter(Boolean)
    .join(" · ");

  const onLogout = async () => {
    onNavigate?.();
    try {
      await logout();
    } catch {
      toast.error("Could not sign out. Please try again.");
      return;
    }
    await navigate({ to: "/login" });
  };

  return (
    <>
      <Wordmark />

      <nav className="mt-10 flex flex-1 flex-col gap-1">
        {items.map(({ label, icon: Icon, to }) =>
          to ? (
            <Link
              key={label}
              to={to}
              activeOptions={{ exact: to !== "/user/history" }}
              activeProps={{ className: "bg-lime text-lime-foreground" }}
              inactiveProps={{ className: inactiveClass }}
              className={itemClass}
              onClick={onNavigate}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ) : (
            <button
              key={label}
              type="button"
              className={cn(itemClass, inactiveClass)}
              onClick={onNavigate}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ),
        )}
      </nav>

      <div className="border-t border-foreground/10 pt-4">
        <div className="flex items-center gap-3 px-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime font-display text-base text-lime-foreground">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user?.email ?? "Signed out"}
            </p>
            <p className="truncate text-xs text-foreground/50">
              {subtitle || "—"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Log out"
            title="Log out"
            onClick={() => void onLogout()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/60 transition hover:bg-ivory hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((row) => {
        if (active) setUser(row);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-foreground/10 bg-background px-4 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 transition hover:bg-ivory hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Wordmark />
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-6 sm:max-w-sm">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Main navigation menu</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <SidebarNav user={user} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-foreground/10 bg-background p-6 md:flex">
        <SidebarNav user={user} />
      </aside>
    </>
  );
}
