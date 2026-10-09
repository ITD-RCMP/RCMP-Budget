import { Clock, Receipt, Wallet, type LucideIcon } from "lucide-react";
import { FinanceLayout } from "./sidebar";

const cards: { label: string; hint: string; icon: LucideIcon; iconClass: string }[] = [
  {
    label: "Invoices",
    hint: "Bills in this workspace",
    icon: Receipt,
    iconClass: "bg-sky-100 text-sky-700",
  },
  {
    label: "Waiting",
    hint: "Items still open",
    icon: Clock,
    iconClass: "bg-amber-100 text-amber-700",
  },
  {
    label: "Recorded",
    hint: "Amounts entered",
    icon: Wallet,
    iconClass: "bg-emerald-100 text-emerald-700",
  },
];

function timeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatToday(date = new Date()) {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function FinanceDashboard() {
  return (
    <FinanceLayout>
      <div>
        <h1 className="font-display text-3xl md:text-4xl">{timeGreeting()}</h1>
        <p className="mt-1 text-sm text-foreground/55">{formatToday()}</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {cards.map(({ label, hint, icon: Icon, iconClass }) => (
          <div key={label} className="rounded-[1.75rem] glass-card p-5">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconClass}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="truncate text-xs text-foreground/45">{hint}</p>
              </div>
            </div>
            <p className="mt-6 font-display text-3xl text-foreground/35">—</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[1.75rem] glass-card p-6 md:p-8">
        <h2 className="text-lg font-medium">Overview</h2>
        <p className="mt-8 py-10 text-center text-sm text-foreground/50">Nothing to show yet.</p>
      </div>
    </FinanceLayout>
  );
}
