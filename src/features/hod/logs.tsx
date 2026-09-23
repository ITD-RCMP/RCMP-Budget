import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Pencil,
  ScrollText,
  Search,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Sidebar } from "./sidebar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  listHodBudgetLogs,
  type BudgetActionLog,
} from "@backend/server-functions/budget-log-fns";
import {
  BudgetLogList,
  filterBudgetLogs,
} from "@/features/budget-action-log-list";

type ActionFilter = "all" | BudgetActionLog["action"];

const actionFilters: { id: ActionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "submit", label: "Submitted" },
  { id: "edit", label: "Edited" },
  { id: "update_budget", label: "Updated" },
  { id: "transfer", label: "Transferred" },
  { id: "approve", label: "Approved" },
  { id: "reject", label: "Rejected" },
  { id: "delete", label: "Deleted" },
];

export function HodLogsPage() {
  const [logs, setLogs] = useState<BudgetActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<ActionFilter>("all");

  useEffect(() => {
    let active = true;
    listHodBudgetLogs()
      .then((rows) => {
        if (active) setLogs(rows);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not load logs. Refresh and try again.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    let updates = 0;
    let edits = 0;
    let transfers = 0;
    for (const row of logs) {
      if (row.action === "update_budget") updates += 1;
      if (row.action === "edit") edits += 1;
      if (row.action === "transfer") transfers += 1;
    }
    return { total: logs.length, updates, edits, transfers };
  }, [logs]);

  const visibleLogs = useMemo(() => {
    const searched = filterBudgetLogs(logs, query);
    if (action === "all") return searched;
    return searched.filter((row) => row.action === action);
  }, [logs, query, action]);

  return (
    <div className="flex h-screen flex-col overflow-hidden app-canvas text-foreground md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 md:p-12">
        <div>
          <h1 className="font-display text-4xl">Logs</h1>
          <p className="mt-2 text-sm text-foreground/60">
            What changed on department budgets, and who changed it.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={ScrollText}
            label="All activity"
            value={String(counts.total)}
            selected={action === "all"}
            onSelect={() => setAction("all")}
          />
          <SummaryCard
            icon={Wallet}
            label="Amount updates"
            value={String(counts.updates)}
            selected={action === "update_budget"}
            onSelect={() => setAction("update_budget")}
          />
          <SummaryCard
            icon={Pencil}
            label="Detail edits"
            value={String(counts.edits)}
            selected={action === "edit"}
            onSelect={() => setAction("edit")}
          />
          <SummaryCard
            icon={ArrowRightLeft}
            label="Transfers"
            value={String(counts.transfers)}
            selected={action === "transfer"}
            onSelect={() => setAction("transfer")}
          />
        </div>

        <div className="mt-6 rounded-[1.5rem] glass-card p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {actionFilters.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAction(option.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition",
                    action === option.id
                      ? "bg-foreground text-background"
                      : "bg-ivory text-foreground/60 hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-64">
              <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ref or email"
                className="h-11 rounded-full pl-11"
              />
            </div>
          </div>

          <div className="mt-6">
            <BudgetLogList
              logs={visibleLogs}
              loading={loading}
              layout="feed"
              emptyMessage={
                logs.length === 0
                  ? "No budget logs yet for this department."
                  : "No logs match your filters."
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  selected,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative overflow-hidden rounded-[1.5rem] p-5 text-left glass-card transition hover:-translate-y-0.5",
        selected ? "bg-lime text-lime-foreground" : "",
      )}
    >
      <Icon
        className={cn(
          "absolute -right-3 -bottom-3 h-16 w-16 -rotate-12",
          selected ? "text-lime-foreground/10" : "text-foreground/5",
        )}
      />
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            selected ? "bg-lime-foreground/10" : "bg-lime text-lime-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <p
          className={cn(
            "text-xs",
            selected ? "text-lime-foreground/70" : "text-foreground/50",
          )}
        >
          {label}
        </p>
      </div>
      <p className="relative mt-3 font-display text-3xl tabular-nums">{value}</p>
    </button>
  );
}
