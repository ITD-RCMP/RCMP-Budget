import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Plus,
  Search,
  SlidersHorizontal,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  CreditCard,
  Wifi,
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  History,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";
import { useAutoHideReveal } from "@/lib/use-auto-hide";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listMyBudgets } from "@backend/server-functions/budget-fns";
import { isYearlyBudgetFormEnabled } from "@backend/server-functions/settings-fns";
import {
  getUserDashboardStats,
  type UserDashboardStats,
} from "@backend/server-functions/user-dashboard-fns";

type ActivityStatus = "Pending" | "Approved" | "Rejected";
type TableTab = "all" | "budgets" | "history";
type StatusFilter = "All" | ActivityStatus;
type DateFilter = "month" | "year" | "all";

type DashboardRow = {
  key: string;
  kind: "budget";
  title: string;
  ref: string;
  amount: number;
  status: ActivityStatus;
  createdAt: string;
  date: string;
  budgetType?: "OPEX" | "CAPEX";
  budgetYear?: number;
};

const statusConfig: Record<
  ActivityStatus,
  { icon: LucideIcon; tone: string }
> = {
  Pending: { icon: Clock, tone: "text-amber-700 bg-amber-100" },
  Approved: { icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-100" },
  Rejected: { icon: XCircle, tone: "text-red-600 bg-red-100" },
};

const PAGE_SIZE = 5;

const tabs: { id: TableTab; label: string }[] = [
  { id: "all", label: "All Transaction" },
  { id: "budgets", label: "Yearly Budget" },
  { id: "history", label: "Transaction History" },
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

function formatRm(value: number) {
  return `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function compactRm(value: number) {
  if (value >= 1000) {
    const thousands = value / 1000;
    return `RM ${thousands.toLocaleString("en-MY", {
      maximumFractionDigits: thousands >= 10 ? 0 : 1,
    })}k`;
  }
  return `RM ${Math.round(value)}`;
}

function niceMax(value: number) {
  if (value <= 0) return 1000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function inDateRange(iso: string, filter: DateFilter) {
  if (filter === "all") return true;
  const created = new Date(iso);
  const now = new Date();
  if (filter === "year") return created.getFullYear() === now.getFullYear();
  return (
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth()
  );
}

function pageItems(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "…", total] as const;
  if (current >= total - 2) {
    return [1, "…", total - 2, total - 1, total] as const;
  }
  return [1, "…", current, "…", total] as const;
}

function StatusPill({ status }: { status: ActivityStatus }) {
  const { icon: Icon, tone } = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex min-w-24 items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        tone,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}

function ChangePill({
  value,
  invert,
}: {
  value: number | null;
  invert?: boolean;
}) {
  if (value == null) return null;
  const up = value >= 0;
  const positive = invert ? !up : up;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
        positive
          ? "bg-emerald-100 text-emerald-700"
          : invert
            ? "bg-amber-100 text-amber-700"
            : "bg-red-100 text-red-600",
      )}
    >
      {up ? "+" : ""}
      {value}%
    </span>
  );
}

function MaskedAmount({
  revealed,
  value,
  loading,
  className,
}: {
  revealed: boolean;
  value: string;
  loading: boolean;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      {loading ? "…" : revealed ? value : "RM ••••••"}
    </span>
  );
}

export function UserDashboard() {
  const navigate = useNavigate();
  const { revealed, toggle } = useAutoHideReveal();
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] =
    useState<UserDashboardStats | null>(null);
  const [budgetFormEnabled, setBudgetFormEnabled] = useState(true);
  const [tab, setTab] = useState<TableTab>("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [page, setPage] = useState(1);
  const moneyRevealed = revealed.money ?? false;

  useEffect(() => {
    let active = true;
    listMyBudgets()
      .then((budgets) => {
        if (!active) return;
        const merged: DashboardRow[] = [
          ...budgets.map((row) => ({
            key: `yb-${row.id}`,
            kind: "budget" as const,
            title: row.title,
            ref: row.budgetRef,
            amount: row.amount,
            status: row.status,
            createdAt: row.createdAt,
            date: row.date,
            budgetType: row.budgetType,
            budgetYear: row.budgetYear,
          })),
        ].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setRows(merged);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not load your requests. Refresh the page to try again.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getUserDashboardStats()
      .then((data) => {
        if (active) setDashboardStats(data);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not load dashboard figures. Refresh the page to try again.",
        );
      })
      .finally(() => {
        if (active) setStatsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    isYearlyBudgetFormEnabled()
      .then((enabled) => {
        if (active) setBudgetFormEnabled(enabled);
      })
      .catch(() => {
        if (active) setBudgetFormEnabled(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const allocation = dashboardStats?.allocation ?? 0;
  const spent = dashboardStats?.spent ?? 0;
  const remaining = dashboardStats?.remaining ?? 0;
  const spentPercent =
    allocation > 0 ? Math.min(100, Math.round((spent / allocation) * 100)) : 0;
  const remainingPercent =
    allocation > 0
      ? Math.max(0, Math.round((remaining / allocation) * 100))
      : 0;
  const allocationChange = dashboardStats
    ? percentChange(allocation, dashboardStats.lastYearAllocation)
    : null;
  const spendChange = dashboardStats
    ? percentChange(dashboardStats.thisMonthSpent, dashboardStats.lastMonthSpent)
    : null;

  const codeBudgets = dashboardStats?.codeBudgets ?? [];
  const previewCodeBudgets = codeBudgets.slice(0, 5);
  const totalCodeBudget = dashboardStats?.totalCodeBudget ?? 0;
  const budgetYear = dashboardStats?.budgetYear ?? new Date().getFullYear();

  const cashflowHint = statsLoading
    ? "Loading this year’s budget…"
    : remaining >= 0
      ? `You still have ${formatRm(remaining)} unspent this year`
      : `Spending is over allocation by ${formatRm(Math.abs(remaining))}`;

  const filteredRows = useMemo(() => {
    const needle = query.toLowerCase().trim();
    return rows.filter((row) => {
      if (tab === "budgets" && row.kind !== "budget") return false;
      if (tab === "history" && row.status === "Pending") return false;
      if (statusFilter !== "All" && row.status !== statusFilter) return false;
      if (!inDateRange(row.createdAt, dateFilter)) return false;
      if (!needle) return true;
      return `${row.title} ${row.ref} ${row.budgetType ?? ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, tab, statusFilter, dateFilter, query]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [tab, statusFilter, dateFilter, query]);

  const openBudgetForm = () => {
    if (!budgetFormEnabled) {
      toast.error("Yearly budget submissions are closed. Try again later.");
      return;
    }
    void navigate({ to: "/user/budget" });
  };

  const staffSuffix =
    dashboardStats?.staffId != null
      ? String(dashboardStats.staffId).padStart(4, "0").slice(-4)
      : "0000";

  const chartMax = niceMax(
    Math.max(...previewCodeBudgets.map((item) => item.amount), 0),
  );
  const chartTicks = [0, 0.25, 0.5, 0.75, 1].map((part) => chartMax * part);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ivory text-foreground md:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-3xl md:text-4xl">
              {timeGreeting()}
            </h1>
            <p className="mt-1 text-sm text-foreground/55">{formatToday()}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-medium text-lime-foreground transition hover:brightness-95 sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Make Request
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!budgetFormEnabled}
                onSelect={openBudgetForm}
              >
                Yearly Budget
                {!budgetFormEnabled ? " (Closed)" : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)]">
          <div className="relative min-w-0 overflow-hidden rounded-[1.75rem] bg-foreground p-5 text-background shadow-card sm:p-6">
            <div className="pointer-events-none absolute -top-10 -right-8 h-40 w-40 rounded-full bg-lime/25" />
            <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-lime/10" />
            <div className="relative flex items-start justify-between">
              <div className="flex min-w-0 items-center gap-2 text-background/70">
                <CreditCard className="h-5 w-5 shrink-0" />
                <p className="truncate text-sm tracking-[0.18em]">
                  •••• •••• {staffSuffix}
                </p>
              </div>
              <Wifi className="h-5 w-5 shrink-0 rotate-90 text-lime" />
            </div>
            <p className="relative mt-8 text-xs text-background/55">
              Remaining budget
            </p>
            <div className="relative mt-1 flex min-w-0 items-center gap-2">
              <p className="min-w-0 break-all font-display text-3xl sm:text-4xl">
                <MaskedAmount
                  loading={statsLoading}
                  revealed={moneyRevealed}
                  value={formatRm(remaining)}
                />
              </p>
              <button
                type="button"
                onClick={() => toggle("money")}
                aria-label={moneyRevealed ? "Hide amounts" : "Show amounts"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-background/60 transition hover:bg-background/10 hover:text-background"
              >
                {moneyRevealed ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="relative mt-8 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {dashboardStats?.displayName ?? "Staff"}
                </p>
                <p className="mt-0.5 truncate text-xs text-background/55">
                  {dashboardStats?.departmentName ?? "No department"}
                  {" · "}
                  FY {dashboardStats?.budgetYear ?? new Date().getFullYear()}
                </p>
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-[1.75rem] bg-background p-4 shadow-card sm:p-5 md:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-lime-foreground">
                  <Wallet className="h-4 w-4" />
                </span>
                <h2 className="text-lg font-medium">My Budget</h2>
              </div>
              <p className="text-sm text-foreground/55">{cashflowHint}</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <CashflowCard
                icon={ArrowDownLeft}
                iconClass="bg-sky-100 text-sky-700"
                label="Allocation"
                amount={formatRm(allocation)}
                hint="Money in this year"
                change={allocationChange}
                revealed={moneyRevealed}
                loading={statsLoading}
              />
              <CashflowCard
                icon={ArrowUpRight}
                iconClass="bg-amber-100 text-amber-700"
                label="Spent to date"
                amount={formatRm(spent)}
                hint={
                  allocation > 0
                    ? `${spentPercent}% of allocation`
                    : "Approved spend"
                }
                change={spendChange}
                invertChange
                revealed={moneyRevealed}
                loading={statsLoading}
              />
              <CashflowCard
                icon={Wallet}
                iconClass="bg-emerald-100 text-emerald-700"
                label="Remaining"
                amount={formatRm(remaining)}
                hint={
                  allocation > 0
                    ? `${remainingPercent}% still available`
                    : "Left in your department"
                }
                revealed={moneyRevealed}
                loading={statsLoading}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="min-w-0 rounded-[1.75rem] bg-background p-4 shadow-card sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-medium">Money Analytics</h2>
                  <p className="mt-1 break-all font-display text-2xl tabular-nums sm:text-3xl">
                    <MaskedAmount
                      loading={statsLoading}
                      revealed={moneyRevealed}
                      value={formatRm(totalCodeBudget)}
                    />
                  </p>
                  <p className="mt-1 text-xs text-foreground/50">
                    {statsLoading
                      ? "Loading budget by account code…"
                      : codeBudgets.length === 0
                        ? `No department budget for FY ${budgetYear} yet`
                        : `FY ${budgetYear} · ${codeBudgets.length} account code${codeBudgets.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <Link
                  to="/user/department"
                  className="shrink-0 rounded-full bg-ivory px-3 py-1.5 text-xs font-medium text-foreground/60 transition hover:text-foreground"
                >
                  Full Stats
                </Link>
              </div>

              <div className="mt-5 min-w-0">
                <div className="mb-2 flex justify-between gap-1 overflow-hidden text-[10px] text-foreground/35">
                  {chartTicks.map((tick, index) => (
                    <span
                      key={tick}
                      className={cn(
                        "shrink-0",
                        index > 0 && index < chartTicks.length - 1
                          ? "hidden sm:inline"
                          : "",
                      )}
                    >
                      {compactRm(tick)}
                    </span>
                  ))}
                </div>
                <div className="space-y-3">
                  {previewCodeBudgets.length === 0 ? (
                    <p className="text-sm text-foreground/45">
                      Submit a yearly budget or open Full Stats to see the
                      department breakdown.
                    </p>
                  ) : (
                    previewCodeBudgets.map((item) => {
                      const width =
                        chartMax > 0
                          ? Math.max(4, (item.amount / chartMax) * 100)
                          : 4;
                      return (
                        <div
                          key={`${item.budgetType}-${item.code}`}
                          className="flex min-w-0 items-center gap-2 sm:gap-3"
                        >
                          <span
                            className="w-14 shrink-0 truncate text-xs font-medium tabular-nums text-foreground/70 sm:w-20"
                            title={item.code}
                          >
                            {item.code}
                          </span>
                          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ivory">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                item.budgetType === "CAPEX"
                                  ? "bg-amber-400"
                                  : "bg-lime",
                              )}
                              style={{
                                width: statsLoading ? "30%" : `${width}%`,
                              }}
                            />
                          </div>
                          <span className="w-14 shrink-0 text-right text-xs tabular-nums text-foreground/55 sm:w-16">
                            {moneyRevealed ? compactRm(item.amount) : "••••"}
                          </span>
                        </div>
                      );
                    })
                  )}
                  {codeBudgets.length > previewCodeBudgets.length && (
                    <p className="text-xs text-foreground/40">
                      +{codeBudgets.length - previewCodeBudgets.length} more in
                      Full Stats
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-[1.75rem] bg-background p-4 shadow-card sm:p-5">
              <h2 className="text-lg font-medium">Shortcuts</h2>
              <p className="mt-1 text-xs text-foreground/50">
                Click to navigate to the page
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex flex-col items-center gap-2 text-center transition hover:opacity-90"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime text-lime-foreground">
                        <Plus className="h-5 w-5" />
                      </span>
                      <span className="text-[11px] font-medium leading-tight text-foreground/70">
                        Make Request
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      disabled={!budgetFormEnabled}
                      onSelect={openBudgetForm}
                    >
                      Yearly Budget
                      {!budgetFormEnabled ? " (Closed)" : ""}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  type="button"
                  onClick={() => void navigate({ to: "/user/rfq" })}
                  className="flex flex-col items-center gap-2 text-center transition hover:opacity-90"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ivory text-foreground/70">
                    <FileText className="h-5 w-5" />
                  </span>
                  <span className="text-[11px] font-medium leading-tight text-foreground/70">
                    Generate RFQ
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void navigate({ to: "/user/history" })}
                  className="flex flex-col items-center gap-2 text-center transition hover:opacity-90"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ivory text-foreground/70">
                    <History className="h-5 w-5" />
                  </span>
                  <span className="text-[11px] font-medium leading-tight text-foreground/70">
                    History
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-[1.75rem] bg-background p-4 shadow-card sm:p-5 md:p-6">
            <div className="-mx-1 flex gap-4 overflow-x-auto border-b border-foreground/10 px-1 sm:gap-5">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "shrink-0 border-b-2 pb-3 text-sm transition",
                    tab === item.id
                      ? "border-lime font-medium text-foreground"
                      : "border-transparent text-foreground/45 hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-4">
              <div className="min-w-0">
                <h2 className="font-display text-2xl sm:text-3xl">
                  {tabs.find((item) => item.id === tab)?.label}
                </h2>
                <p className="mt-1 text-sm text-foreground/50">
                  All your yearly budgets are recorded
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1 basis-40">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-foreground/35" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search"
                    className="h-10 w-full rounded-full bg-ivory pl-9"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Filter by status"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ivory text-foreground/60 transition hover:text-foreground"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(["All", "Pending", "Approved", "Rejected"] as const).map(
                      (option) => (
                        <DropdownMenuItem
                          key={option}
                          onSelect={() => setStatusFilter(option)}
                        >
                          {option}
                          {statusFilter === option ? " ✓" : ""}
                        </DropdownMenuItem>
                      ),
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-ivory px-3 text-sm text-foreground/70 transition hover:text-foreground"
                    >
                      <CalendarDays className="h-4 w-4" />
                      {dateFilter === "month"
                        ? "This Month"
                        : dateFilter === "year"
                          ? "This Year"
                          : "All Time"}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setDateFilter("month")}>
                      This Month
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDateFilter("year")}>
                      This Year
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDateFilter("all")}>
                      All Time
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="mt-4 md:hidden">
              {loading ? (
                <p className="py-10 text-center text-sm text-foreground/45">
                  Loading your transactions…
                </p>
              ) : pagedRows.length === 0 ? (
                <p className="py-10 text-center text-sm text-foreground/45">
                  No transactions match these filters.
                </p>
              ) : (
                <ul className="space-y-3">
                  {pagedRows.map((row) => {
                    const initial =
                      row.title.trim().charAt(0).toUpperCase() || "?";
                    return (
                      <li
                        key={row.key}
                        className="flex flex-col gap-3 rounded-2xl bg-ivory p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background font-medium">
                            {initial}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{row.title}</p>
                            <p className="mt-0.5 truncate text-xs text-foreground/45">
                              {row.ref}
                              {" · "}
                              {row.budgetType}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium tabular-nums">
                              {formatRm(row.amount)}
                            </p>
                            <p className="mt-0.5 text-xs text-foreground/45">
                              {row.date}
                            </p>
                          </div>
                          <StatusPill status={row.status} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-foreground/40">
                    <th className="py-3 font-medium">Request</th>
                    <th className="py-3 font-medium">ID</th>
                    <th className="py-3 font-medium">Amount</th>
                    <th className="py-3 font-medium">Date</th>
                    <th className="py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 text-center text-foreground/45"
                      >
                        Loading your transactions…
                      </td>
                    </tr>
                  ) : pagedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 text-center text-foreground/45"
                      >
                        No transactions match these filters.
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((row) => {
                      const initial =
                        row.title.trim().charAt(0).toUpperCase() || "?";
                      return (
                        <tr key={row.key} className="hover:bg-ivory/60">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ivory font-medium">
                                {initial}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {row.title}
                                </p>
                                <p className="text-xs text-foreground/45">
                                  {row.budgetType}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 text-foreground/60">{row.ref}</td>
                          <td className="py-4 font-medium tabular-nums">
                            {formatRm(row.amount)}
                          </td>
                          <td className="py-4 text-foreground/60">{row.date}</td>
                          <td className="py-4">
                            <StatusPill status={row.status} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-foreground/45">
                {filteredRows.length} record
                {filteredRows.length === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-foreground/60 transition hover:bg-ivory disabled:opacity-40 sm:px-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </button>
                {pageItems(currentPage, pageCount).map((item, index) =>
                  item === "…" ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-2 text-sm text-foreground/35"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      className={cn(
                        "h-8 w-8 rounded-full text-sm transition",
                        item === currentPage
                          ? "bg-foreground text-background"
                          : "text-foreground/60 hover:bg-ivory",
                      )}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={currentPage >= pageCount}
                  onClick={() =>
                    setPage((value) => Math.min(pageCount, value + 1))
                  }
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-foreground/60 transition hover:bg-ivory disabled:opacity-40 sm:px-3"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function CashflowCard({
  icon: Icon,
  iconClass,
  label,
  amount,
  hint,
  change,
  invertChange,
  revealed,
  loading,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  amount: string;
  hint: string;
  change?: number | null;
  invertChange?: boolean;
  revealed: boolean;
  loading: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-ivory p-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            iconClass,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <ChangePill value={change ?? null} invert={invertChange} />
      </div>
      <p className="mt-4 break-all font-display text-xl sm:text-2xl">
        <MaskedAmount loading={loading} revealed={revealed} value={amount} />
      </p>
      <p className="mt-1 text-xs font-medium">{label}</p>
      <p className="mt-0.5 text-[11px] text-foreground/45">{hint}</p>
    </div>
  );
}
