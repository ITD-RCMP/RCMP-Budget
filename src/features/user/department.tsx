import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  FileDown,
  Maximize2,
  Minimize2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { exportCapexExcel, exportOpexExcel } from "@/lib/report-excel";
import { Sidebar } from "./sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  listDepartmentBudgetReport,
  listDepartmentBudgetYears,
  type DepartmentBudgetDetail,
  type DepartmentBudgetItem,
} from "@backend/server-functions/department-fns";

const CAPEX_CATEGORIES: Record<string, string> = {
  "200-1100": "Renovation",
  "200-1000": "Office Equipment",
  "200-0500": "IT & Audio Visual",
};

const currentYear = new Date().getFullYear();
const defaultYearOptions = [currentYear - 1, currentYear, currentYear + 1];

function buildYearOptions(yearsWithData: number[]) {
  return [...new Set([...defaultYearOptions, ...yearsWithData])].sort(
    (a, b) => b - a,
  );
}

type ReportView = "opex" | "capex";

function formatRm(value: number) {
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMonth(value: string | null) {
  if (!value) return "—";
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function statusTone(status: string) {
  if (status === "Approved") return "bg-emerald-100 text-emerald-700";
  if (status === "Rejected") return "bg-red-100 text-red-600";
  return "bg-amber-100 text-amber-700";
}

function fallbackItems(row: DepartmentBudgetDetail): DepartmentBudgetItem[] {
  if (row.items.length > 0) return row.items;
  return [
    {
      id: row.id,
      itemName: row.itemName,
      quantity: row.quantity ?? 1,
      costPerUnit: row.costPerUnit ?? row.amount,
      amount: row.amount,
    },
  ];
}

export function DepartmentPage() {
  const [view, setView] = useState<ReportView>("opex");
  const [budgetYear, setBudgetYear] = useState(String(currentYear));
  const [yearChoices, setYearChoices] = useState(defaultYearOptions);
  const [yearReady, setYearReady] = useState(false);
  const [budgets, setBudgets] = useState<DepartmentBudgetDetail[]>([]);
  const [loadingBudgets, setLoadingBudgets] = useState(true);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!maximized) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMaximized(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [maximized]);

  useEffect(() => {
    let active = true;
    listDepartmentBudgetYears()
      .then((years) => {
        if (!active) return;
        setYearChoices(buildYearOptions(years));
        const selected = Number(budgetYear);
        if (years.length > 0 && !years.includes(selected)) {
          setBudgetYear(String(Math.max(...years)));
        }
      })
      .catch(() => {
        if (!active) return;
      })
      .finally(() => {
        if (active) setYearReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!yearReady) return;
    let active = true;
    setLoadingBudgets(true);
    listDepartmentBudgetReport({ data: { budgetYear: Number(budgetYear) } })
      .then((rows) => {
        if (active) setBudgets(rows);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not load the budget ledger. Try again.",
        );
      })
      .finally(() => {
        if (active) setLoadingBudgets(false);
      });
    return () => {
      active = false;
    };
  }, [budgetYear, yearReady]);

  const opexRows = useMemo(
    () =>
      budgets.filter(
        (row) => row.budgetType === "OPEX" && row.status !== "Rejected",
      ),
    [budgets],
  );
  const capexRows = useMemo(
    () =>
      budgets.filter(
        (row) => row.budgetType === "CAPEX" && row.status !== "Rejected",
      ),
    [budgets],
  );

  const handleExport = async (type: "opex" | "capex") => {
    try {
      if (type === "opex") {
        await exportOpexExcel(opexRows, Number(budgetYear));
      } else {
        await exportCapexExcel(capexRows, Number(budgetYear), CAPEX_CATEGORIES);
      }
      toast.success("Excel file downloaded.");
    } catch {
      toast.error("Could not export the file. Try again.");
    }
  };

  const opexItemCount = opexRows.reduce(
    (sum, row) => sum + Math.max(row.items.length, 1),
    0,
  );
  const capexItemCount = capexRows.reduce(
    (sum, row) => sum + Math.max(row.items.length, 1),
    0,
  );
  const opexTotal = opexRows.reduce((sum, row) => sum + row.amount, 0);
  const capexTotal = capexRows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="flex h-screen flex-col overflow-hidden app-canvas text-foreground md:flex-row">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8 md:p-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">My Department</h1>
            <p className="mt-2 text-sm text-foreground/60">
              Department OPEX and CAPEX in one view.
            </p>
          </div>
          <div className="w-40">
            <Select value={budgetYear} onValueChange={setBudgetYear}>
              <SelectTrigger className="h-11 rounded-full">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yearChoices.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    FY {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] glass-card px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime text-lime-foreground">
              <Clock className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Need to update a budget?</p>
              <p className="mt-0.5 text-xs text-foreground/50">
                Change amounts from History. This page is for viewing only.
              </p>
            </div>
          </div>
          <Link
            to="/user/history"
            className="inline-flex shrink-0 items-center rounded-full bg-lime px-4 py-2 text-sm font-medium text-lime-foreground transition hover:opacity-90"
          >
            Open History
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <SummaryStat
            label={`OPEX FY ${budgetYear}`}
            value={`RM ${formatRm(opexTotal)}`}
            hint={`${opexItemCount} item${opexItemCount === 1 ? "" : "s"} · ${opexRows.length} line${opexRows.length === 1 ? "" : "s"}`}
            icon={ArrowDownLeft}
            active={view === "opex"}
            onClick={() => setView("opex")}
          />
          <SummaryStat
            label={`CAPEX FY ${budgetYear}`}
            value={`RM ${formatRm(capexTotal)}`}
            hint={`${capexItemCount} item${capexItemCount === 1 ? "" : "s"} · ${capexRows.length} line${capexRows.length === 1 ? "" : "s"}`}
            icon={ArrowUpRight}
            active={view === "capex"}
            onClick={() => setView("capex")}
          />
        </div>

        <div
          className={cn(
            "mt-6 rounded-[1.5rem] glass-card p-6 md:p-8",
            maximized &&
              "fixed inset-0 z-50 mt-0 flex h-screen w-screen flex-col overflow-hidden rounded-none p-6 md:p-8",
          )}
        >
          {view === "opex" && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <ReportSectionTitle>
                  Operating Expenditure {budgetYear} (OPEX)
                </ReportSectionTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <MaximizeButton
                    maximized={maximized}
                    onClick={() => setMaximized((value) => !value)}
                  />
                  <ExportButton
                    disabled={loadingBudgets || opexRows.length === 0}
                    onClick={() => handleExport("opex")}
                  />
                </div>
              </div>
              <div className={cn(maximized && "min-h-0 flex-1 overflow-auto")}>
                {loadingBudgets ? (
                  <LoadingState message="Loading OPEX ledger…" />
                ) : opexRows.length === 0 ? (
                  <EmptyState
                    message="No OPEX lines for this year. Check the FY selector matches the year you used when submitting."
                    maximized={maximized}
                  />
                ) : (
                  <OpexTable rows={opexRows} total={opexTotal} />
                )}
              </div>
            </>
          )}

          {view === "capex" && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <ReportSectionTitle>
                  Capital Expenditure {budgetYear} (CAPEX)
                </ReportSectionTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <MaximizeButton
                    maximized={maximized}
                    onClick={() => setMaximized((value) => !value)}
                  />
                  <ExportButton
                    disabled={loadingBudgets || capexRows.length === 0}
                    onClick={() => handleExport("capex")}
                  />
                </div>
              </div>
              <div className={cn(maximized && "min-h-0 flex-1 overflow-auto")}>
                {loadingBudgets ? (
                  <LoadingState message="Loading CAPEX ledger…" />
                ) : capexRows.length === 0 ? (
                  <EmptyState
                    message="No CAPEX lines for this year. Check the FY selector matches the year you used when submitting."
                    maximized={maximized}
                  />
                ) : (
                  <CapexTable
                    rows={capexRows}
                    year={Number(budgetYear)}
                    total={capexTotal}
                  />
                )}
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  hint,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-[1.5rem] p-6 text-left glass-card transition hover:-translate-y-0.5",
        active ? "bg-lime text-lime-foreground" : "",
      )}
    >
      <Icon
        className={cn(
          "absolute -right-4 -bottom-4 h-24 w-24 -rotate-12 transition group-hover:rotate-0",
          active ? "text-lime-foreground/10" : "text-foreground/5",
        )}
      />

      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            active
              ? "bg-lime-foreground/10"
              : "bg-lime text-lime-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <p
          className={cn(
            "text-sm font-medium",
            active ? "text-lime-foreground/70" : "text-foreground/60",
          )}
        >
          {label}
        </p>
      </div>

      <p className="relative mt-4 font-display text-4xl tabular-nums">{value}</p>
      <p
        className={cn(
          "relative mt-1.5 text-xs",
          active ? "text-lime-foreground/60" : "text-foreground/50",
        )}
      >
        {hint}
      </p>
    </button>
  );
}

function ExportButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Export to Excel"
      title="Export to Excel"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-foreground/15 text-foreground/70 transition hover:bg-foreground/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      <FileDown className="h-4 w-4" />
    </button>
  );
}

function MaximizeButton({
  maximized,
  onClick,
}: {
  maximized: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={maximized ? "Exit fullscreen" : "Maximize screen"}
      title={maximized ? "Exit fullscreen" : "Maximize screen"}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-foreground/15 text-foreground/70 transition hover:bg-foreground/5 hover:text-foreground"
    >
      {maximized ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </button>
  );
}

function ReportSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-2xl tracking-normal text-foreground">
      {children}
    </h2>
  );
}

function LoadingState({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-foreground/50">{message}</p>;
}

function EmptyState({
  message,
  maximized,
}: {
  message: string;
  maximized?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-foreground/15 text-center",
        maximized
          ? "flex h-full min-h-[calc(100vh-8rem)] items-center justify-center py-14"
          : "py-14",
      )}
    >
      <p className="text-sm text-foreground/50">{message}</p>
    </div>
  );
}

function OpexCostBreakdown({ items }: { items: DepartmentBudgetItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-2 space-y-2 border-t border-foreground/10 pt-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-lg bg-ivory/80 px-2.5 py-2"
        >
          <p className="text-xs font-medium text-foreground">
            {item.itemName?.trim() || "Item"}
          </p>
          <dl className="mt-1.5 space-y-0.5 text-[11px] leading-snug">
            <div className="flex justify-between gap-3">
              <dt className="text-foreground/45">Qty</dt>
              <dd className="tabular-nums text-foreground/80">{item.quantity}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-foreground/45">Each</dt>
              <dd className="tabular-nums text-foreground/80">
                RM {formatRm(item.costPerUnit)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-foreground/45">Total</dt>
              <dd className="font-medium tabular-nums">
                RM {formatRm(item.amount)}
              </dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
}

function OpexTable({
  rows,
  total,
}: {
  rows: DepartmentBudgetDetail[];
  total: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/15">
      <table className="min-w-[1100px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#ebe6dc] text-center text-xs font-semibold uppercase tracking-wide text-foreground">
            <th className="border border-foreground/20 px-3 py-3">No.</th>
            <th className="border border-foreground/20 px-3 py-3">
              Code (AutoCount)
            </th>
            <th className="border border-foreground/20 px-3 py-3 text-left">
              Activities / Programme / Event
            </th>
            <th className="border border-foreground/20 px-3 py-3">
              Target month/s to spend
            </th>
            <th className="border border-foreground/20 px-3 py-3 text-left">
              Objectives
            </th>
            <th className="border border-foreground/20 px-3 py-3 text-left">
              Justifications (calculation)
            </th>
            <th className="border border-foreground/20 px-3 py-3">
              OPEX budget (RM)
            </th>
            <th className="border border-foreground/20 px-3 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const items = fallbackItems(row);

            return (
              <tr
                key={row.id}
                className="align-top odd:bg-background even:bg-ivory/40"
              >
                <td className="border border-foreground/15 px-3 py-3 text-center tabular-nums">
                  {index + 1}
                </td>
                <td className="border border-foreground/15 px-3 py-3 text-center font-medium tabular-nums">
                  {row.code}
                </td>
                <td className="border border-foreground/15 px-3 py-3">
                  {row.activity || "—"}
                </td>
                <td className="border border-foreground/15 px-3 py-3 text-center">
                  {formatMonth(row.targetMonths)}
                </td>
                <td className="border border-foreground/15 px-3 py-3 whitespace-pre-wrap">
                  {row.objective || "—"}
                </td>
                <td className="min-w-[220px] border border-foreground/15 px-3 py-3 whitespace-pre-wrap">
                  <p>{row.justification}</p>
                  <OpexCostBreakdown items={items} />
                </td>
                <td className="border border-foreground/15 px-3 py-3 text-right font-medium tabular-nums">
                  {formatRm(row.amount)}
                </td>
                <td className="border border-foreground/15 px-3 py-3 text-center">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                      statusTone(row.status),
                    )}
                  >
                    {row.status}
                  </span>
                  <p className="mt-1.5 text-[11px] font-normal leading-snug text-foreground/50">
                    {row.requester || "—"}
                  </p>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-[#ebe6dc] font-medium">
            <td
              colSpan={6}
              className="border border-foreground/15 px-3 py-3 text-right"
            >
              Total OPEX
            </td>
            <td className="border border-foreground/15 px-3 py-3 text-right tabular-nums">
              {formatRm(total)}
            </td>
            <td className="border border-foreground/15 px-3 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CapexTable({
  rows,
  year,
  total,
}: {
  rows: DepartmentBudgetDetail[];
  year: number;
  total: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/15">
      <table className="min-w-[1400px] w-full border-collapse text-sm">
        <thead>
          <tr>
            <th
              colSpan={5}
              className="border border-foreground/20 bg-[#ebe6dc] px-3 py-2 text-xs font-semibold uppercase tracking-wide"
            >
              Item details
            </th>
            <th
              colSpan={3}
              className="border border-foreground/20 bg-amber-100 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide"
            >
              Budget {year}
            </th>
            <th
              colSpan={3}
              className="border border-foreground/20 bg-stone-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide"
            >
              Impact & alternatives
            </th>
          </tr>
          <tr className="bg-[#ebe6dc] text-center text-xs font-semibold uppercase tracking-wide">
            <th className="border border-foreground/20 px-3 py-3">No.</th>
            <th className="border border-foreground/20 px-3 py-3">Category</th>
            <th className="border border-foreground/20 px-3 py-3 text-left">
              Item
            </th>
            <th className="border border-foreground/20 px-3 py-3 text-left">
              Justification
            </th>
            <th className="border border-foreground/20 px-3 py-3">
              Target month/s to spend
            </th>
            <th className="border border-foreground/20 bg-amber-50 px-3 py-3">
              Quantity
            </th>
            <th className="border border-foreground/20 bg-amber-50 px-3 py-3">
              Estimated cost p/unit
            </th>
            <th className="border border-foreground/20 bg-amber-50 px-3 py-3">
              Estimated price
            </th>
            <th className="border border-foreground/20 bg-stone-100 px-3 py-3 text-left">
              Effect if budget not approved
            </th>
            <th className="border border-foreground/20 bg-stone-100 px-3 py-3 text-left">
              Alternative more cost-effective
            </th>
            <th className="border border-foreground/20 px-3 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .flatMap((row) => fallbackItems(row).map((item) => ({ row, item })))
            .map(({ row, item }, index) => (
              <tr
                key={`${row.id}-${item.id}`}
                className="align-top odd:bg-background even:bg-ivory/40"
              >
                <td className="border border-foreground/15 px-3 py-3 text-center tabular-nums">
                  {index + 1}
                </td>
                <td className="border border-foreground/15 px-3 py-3 text-center">
                  {CAPEX_CATEGORIES[row.code] || row.code}
                  <p className="mt-1 text-xs font-normal text-foreground/50">
                    {row.code}
                  </p>
                </td>
                <td className="border border-foreground/15 px-3 py-3 font-medium">
                  {item.itemName || "—"}
                </td>
                <td className="border border-foreground/15 px-3 py-3 whitespace-pre-wrap">
                  {row.justification}
                </td>
                <td className="border border-foreground/15 px-3 py-3 text-center">
                  {formatMonth(row.targetMonths)}
                </td>
                <td className="border border-foreground/15 bg-amber-50/60 px-3 py-3 text-center tabular-nums">
                  {item.quantity}
                </td>
                <td className="border border-foreground/15 bg-amber-50/60 px-3 py-3 text-right tabular-nums">
                  {formatRm(item.costPerUnit)}
                </td>
                <td className="border border-foreground/15 bg-amber-50/60 px-3 py-3 text-right font-medium tabular-nums">
                  {formatRm(item.amount)}
                </td>
                <td className="border border-foreground/15 bg-stone-50 px-3 py-3 whitespace-pre-wrap">
                  {row.effectIfNotApproved || "—"}
                </td>
                <td className="border border-foreground/15 bg-stone-50 px-3 py-3 whitespace-pre-wrap">
                  {row.alternative || "—"}
                </td>
                <td className="border border-foreground/15 px-3 py-3 text-center">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                      statusTone(row.status),
                    )}
                  >
                    {row.status}
                  </span>
                  <p className="mt-1.5 text-[11px] font-normal leading-snug text-foreground/50">
                    {row.requester || "—"}
                  </p>
                </td>
              </tr>
            ))}
        </tbody>
        <tfoot>
          <tr className="bg-amber-50 font-medium">
            <td
              colSpan={7}
              className="border border-foreground/15 px-3 py-3 text-right"
            >
              Total CAPEX
            </td>
            <td className="border border-foreground/15 px-3 py-3 text-right tabular-nums">
              {formatRm(total)}
            </td>
            <td
              colSpan={3}
              className="border border-foreground/15 px-3 py-3"
            />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
