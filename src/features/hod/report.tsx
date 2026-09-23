import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Check,
  FileDown,
  Maximize2,
  Minimize2,
  Minus,
  Pencil,
  Plus,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { exportCapexExcel, exportOpexExcel } from "@/lib/report-excel";
import { Sidebar } from "./sidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  createHodBudget,
  listHodBudgetReport,
  listHodBudgetYears,
  reviewHodBudget,
  transferHodBudget,
  updateHodBudget,
  updateHodApprovedBudget,
  type HodBudgetDetail,
  type HodBudgetItem,
} from "@backend/server-functions/hod-budget-fns";
import {
  UpdateApprovedBudgetForm,
  type UpdateApprovedBudgetPayload,
} from "@/features/budget-action-log-list";

const CAPEX_CATEGORIES: Record<string, string> = {
  "200-1100": "Renovation",
  "200-1000": "Office Equipment",
  "200-0500": "IT & Audio Visual",
};

const CAPEX_CODES = [
  { value: "200-1100", label: "200-1100 : Renovation" },
  { value: "200-1000", label: "200-1000 : Office equipment" },
  { value: "200-0500", label: "200-0500 : IT & audio visual" },
] as const;

const OPEX_CODES = [
  { value: "926-0000", label: "926-0000 Lease line for IT system" },
  { value: "916-0000", label: "916-0000 Equip. rental" },
  { value: "918-0001", label: "918-0001 Rental - laptop/PC" },
  { value: "999-1003", label: "999-1003 Printing exp-meter reading" },
  { value: "992-0000", label: "992-0000 IT & audio visual - expenses" },
  { value: "923-0000", label: "923-0000 IT & audio-repair & maintenance" },
  { value: "945-0000", label: "945-0000 Professional fees" },
] as const;

type OpexPayloadItem = {
  itemName: string;
  quantity: number;
  costPerUnit: number;
  budgetAmount: number;
};

type OpexCostRow = {
  id: number;
  itemName: string;
  quantity: number;
  costPerUnit: string;
};

type TransferBudgetInput =
  | {
      targetType: "CAPEX";
      code: (typeof CAPEX_CODES)[number]["value"];
      itemName: string;
      justification: string;
      targetMonths?: string;
      quantity: number;
      costPerUnit: number;
      budgetAmount: number;
      effectIfNotApproved?: string;
      alternative?: string;
      remarks?: string;
    }
  | {
      targetType: "OPEX";
      code: (typeof OPEX_CODES)[number]["value"];
      activity: string;
      objective: string;
      justification: string;
      targetMonths?: string;
      items: OpexPayloadItem[];
      remarks?: string;
    };

type EditBudgetInput =
  | {
      budgetType: "CAPEX";
      code: (typeof CAPEX_CODES)[number]["value"];
      itemName: string;
      justification: string;
      targetMonths?: string;
      quantity: number;
      costPerUnit: number;
      budgetAmount: number;
      effectIfNotApproved?: string;
      alternative?: string;
      remarks?: string;
    }
  | {
      budgetType: "OPEX";
      code: (typeof OPEX_CODES)[number]["value"];
      activity: string;
      objective: string;
      justification: string;
      targetMonths?: string;
      items: OpexPayloadItem[];
      remarks?: string;
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

function fallbackHodItems(row: HodBudgetDetail): HodBudgetItem[] {
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

function OpexCostBreakdown({ items }: { items: HodBudgetItem[] }) {
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

let hodOpexRowId = 1;

function createOpexCostRow(source?: Partial<OpexCostRow>): OpexCostRow {
  return {
    id: hodOpexRowId++,
    itemName: source?.itemName ?? "",
    quantity: source?.quantity ?? 1,
    costPerUnit: source?.costPerUnit ?? "",
  };
}

function opexCostRowsFromDetail(detail: HodBudgetDetail): OpexCostRow[] {
  const items = fallbackHodItems(detail);
  if (items.length === 0) return [createOpexCostRow()];
  return items.map((item) =>
    createOpexCostRow({
      itemName: item.itemName ?? "",
      quantity: item.quantity,
      costPerUnit: String(item.costPerUnit),
    }),
  );
}

function opexCostRowAmount(row: OpexCostRow) {
  return row.quantity * (Number(row.costPerUnit) || 0);
}

function opexCostRowsTotal(rows: OpexCostRow[]) {
  return rows.reduce((sum, row) => sum + opexCostRowAmount(row), 0);
}

function readyOpexPayloadItems(rows: OpexCostRow[]): OpexPayloadItem[] {
  return rows
    .filter(
      (row) =>
        row.itemName.trim() &&
        row.quantity > 0 &&
        Number(row.costPerUnit) > 0,
    )
    .map((row) => ({
      itemName: row.itemName.trim(),
      quantity: row.quantity,
      costPerUnit: Number(row.costPerUnit),
      budgetAmount: opexCostRowAmount(row),
    }));
}

function HodOpexItemsEditor({
  rows,
  onChange,
  disabled,
  lockAmounts,
}: {
  rows: OpexCostRow[];
  onChange: (rows: OpexCostRow[]) => void;
  disabled?: boolean;
  lockAmounts?: boolean;
}) {
  const updateRow = (id: number, patch: Partial<OpexCostRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-foreground/10 bg-background">
        <div className="hidden grid-cols-[minmax(0,1fr)_100px_120px_100px_36px] gap-3 border-b border-foreground/10 bg-ivory/60 px-4 py-2.5 text-xs font-medium tracking-wide text-foreground/50 uppercase sm:grid">
          <span>Item name</span>
          <span className="text-center">Qty</span>
          <span>Unit cost (RM)</span>
          <span className="text-right">Line total</span>
          <span />
        </div>
        <div className="divide-y divide-foreground/8">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_100px_120px_100px_36px] sm:items-center sm:px-4 sm:py-3"
            >
              <div className="space-y-1">
                <span className="text-xs text-foreground/50 sm:hidden">
                  Item {index + 1}
                </span>
                <Input
                  value={row.itemName}
                  onChange={(e) => updateRow(row.id, { itemName: e.target.value })}
                  placeholder="e.g. Toner cartridge"
                  disabled={disabled}
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="flex items-center justify-between gap-2 sm:justify-center">
                <span className="text-xs text-foreground/50 sm:hidden">Qty</span>
                <div className="flex items-center gap-0.5 rounded-full border border-foreground/10 p-0.5">
                  <button
                    type="button"
                    disabled={disabled || lockAmounts}
                    onClick={() =>
                      updateRow(row.id, {
                        quantity: Math.max(1, row.quantity - 1),
                      })
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-ivory disabled:opacity-50"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium tabular-nums">
                    {row.quantity}
                  </span>
                  <button
                    type="button"
                    disabled={disabled || lockAmounts}
                    onClick={() =>
                      updateRow(row.id, { quantity: row.quantity + 1 })
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-ivory disabled:opacity-50"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-foreground/50 sm:hidden">
                  Unit cost (RM)
                </span>
                <Input
                  inputMode="decimal"
                  value={row.costPerUnit}
                  onChange={(e) =>
                    updateRow(row.id, {
                      costPerUnit: e.target.value.replace(/[^\d.]/g, ""),
                    })
                  }
                  placeholder="0.00"
                  disabled={disabled || lockAmounts}
                  className="h-10 rounded-lg tabular-nums"
                />
              </div>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <span className="text-xs text-foreground/50 sm:hidden">Total</span>
                <span className="text-sm font-medium tabular-nums">
                  RM {formatRm(opexCostRowAmount(row))}
                </span>
              </div>
              <div className="flex justify-end sm:justify-center">
                {rows.length > 1 && !lockAmounts && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(rows.filter((entry) => entry.id !== row.id))}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/40 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label="Remove item"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {!lockAmounts && (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...rows, createOpexCostRow()])}
        className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-4 py-2 text-sm text-foreground/70 transition hover:bg-ivory disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        Add item
      </button>
      )}
      <div className="rounded-2xl bg-ivory px-4 py-3">
        <p className="text-xs text-foreground/50">Total OPEX budget</p>
        <p className="mt-1 font-display text-2xl tabular-nums">
          RM {formatRm(opexCostRowsTotal(rows))}
        </p>
      </div>
    </div>
  );
}

export function HodReportPage() {
  const [view, setView] = useState<ReportView>("opex");
  const [budgetYear, setBudgetYear] = useState(String(currentYear));
  const [yearChoices, setYearChoices] = useState(defaultYearOptions);
  const [yearReady, setYearReady] = useState(false);
  const [budgets, setBudgets] = useState<HodBudgetDetail[]>([]);
  const [loadingBudgets, setLoadingBudgets] = useState(true);
  const [maximized, setMaximized] = useState(false);
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const [rejectBudget, setRejectBudget] = useState<HodBudgetDetail | null>(
    null,
  );
  const [transferBudgetRow, setTransferBudgetRow] =
    useState<HodBudgetDetail | null>(null);
  const [editBudgetRow, setEditBudgetRow] = useState<HodBudgetDetail | null>(
    null,
  );
  const [updateBudgetRow, setUpdateBudgetRow] =
    useState<HodBudgetDetail | null>(null);
  const [addBudgetType, setAddBudgetType] = useState<"OPEX" | "CAPEX" | null>(
    null,
  );

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
    listHodBudgetYears()
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
    listHodBudgetReport({ data: { budgetYear: Number(budgetYear) } })
      .then((rows) => {
        if (active) setBudgets(rows);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not load budget report. Try again.",
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

  const budgetLabel = (id: number) =>
    budgets.find((row) => row.id === id)?.budgetRef ?? "this budget";

  const reviewBudget = async (
    id: number,
    decision: "Approved" | "Rejected",
    rejectRemarks?: string,
  ) => {
    const key = `yb-${id}`;
    if (reviewingKey != null) return;
    setReviewingKey(key);
    const toastId = toast.loading(
      decision === "Approved"
        ? `Approving ${budgetLabel(id)}…`
        : `Rejecting ${budgetLabel(id)}…`,
    );
    try {
      const updated = await reviewHodBudget({
        data: { budgetId: id, decision, rejectRemarks },
      });
      setBudgets((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                status: updated.status,
                statusName: updated.statusName,
                rejectRemarks:
                  decision === "Rejected"
                    ? rejectRemarks?.trim() || null
                    : row.rejectRemarks,
              }
            : row,
        ),
      );
      setRejectBudget(null);
      toast.success(`${budgetLabel(id)} ${decision.toLowerCase()}`, {
        id: toastId,
        description:
          decision === "Approved"
            ? "This budget line is marked as approved."
            : "The requester can see this rejection in their history.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Could not update ${budgetLabel(id)}. Try again.`,
        { id: toastId },
      );
    } finally {
      setReviewingKey(null);
    }
  };

  const transferBudget = async (id: number, payload: TransferBudgetInput) => {
    const key = `yb-${id}`;
    if (reviewingKey != null) return;
    setReviewingKey(key);
    const toastId = toast.loading(
      `Transferring ${budgetLabel(id)} to ${payload.targetType}…`,
    );
    try {
      const updated = await transferHodBudget({
        data: { budgetId: id, ...payload },
      });
      setBudgets((prev) =>
        prev.map((row) => (row.id === id ? updated : row)),
      );
      setTransferBudgetRow(null);
      toast.success(`${budgetLabel(id)} transferred to ${payload.targetType}`, {
        id: toastId,
        description: `This budget is now approved under ${payload.targetType}.`,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Could not transfer ${budgetLabel(id)}. Try again.`,
        { id: toastId },
      );
    } finally {
      setReviewingKey(null);
    }
  };

  const editBudget = async (id: number, payload: EditBudgetInput) => {
    const key = `yb-${id}`;
    if (reviewingKey != null) return;
    setReviewingKey(key);
    const toastId = toast.loading(`Saving ${budgetLabel(id)}…`);
    try {
      const updated = await updateHodBudget({
        data: { budgetId: id, ...payload },
      });
      setBudgets((prev) =>
        prev.map((row) => (row.id === id ? updated : row)),
      );
      setEditBudgetRow(null);
      toast.success(`${budgetLabel(id)} updated`, {
        id: toastId,
        description: "Budget details were saved.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Could not save ${budgetLabel(id)}. Try again.`,
        { id: toastId },
      );
    } finally {
      setReviewingKey(null);
    }
  };

  const updateApprovedAmount = async (
    id: number,
    payload: UpdateApprovedBudgetPayload,
  ) => {
    const key = `yb-${id}`;
    if (reviewingKey != null) return;
    setReviewingKey(key);
    const toastId = toast.loading(`Updating ${budgetLabel(id)}…`);
    try {
      const updated = await updateHodApprovedBudget({
        data: { budgetId: id, ...payload },
      });
      setBudgets((prev) =>
        prev.map((row) => (row.id === id ? updated : row)),
      );
      setUpdateBudgetRow(null);
      toast.success(`${budgetLabel(id)} amount updated`, {
        id: toastId,
        description: "The amount was saved. Status did not change.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Could not update ${budgetLabel(id)}. Try again.`,
        { id: toastId },
      );
    } finally {
      setReviewingKey(null);
    }
  };

  const addBudget = async (payload: EditBudgetInput) => {
    if (reviewingKey != null) return;
    setReviewingKey("add-budget");
    const toastId = toast.loading(`Adding ${payload.budgetType} line…`);
    try {
      const created = await createHodBudget({
        data: { budgetYear: Number(budgetYear), ...payload },
      });
      setBudgets((prev) => [...prev, created]);
      setAddBudgetType(null);
      toast.success(`${payload.budgetType} line added`, {
        id: toastId,
        description: `${created.budgetRef} is now on this year's report.`,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not add this budget line. Try again.",
        { id: toastId },
      );
    } finally {
      setReviewingKey(null);
    }
  };

  const opexItemCount = opexRows.reduce(
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
            <h1 className="font-display text-4xl">Reports</h1>
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
            hint={`${capexRows.length} line${capexRows.length === 1 ? "" : "s"}`}
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
                  <AddBudgetButton
                    budgetType="OPEX"
                    onClick={() => setAddBudgetType("OPEX")}
                  />
                  <ExportButton
                    disabled={loadingBudgets || opexRows.length === 0}
                    onClick={() => handleExport("opex")}
                  />
                </div>
              </div>
              <div
                className={cn(
                  maximized && "min-h-0 flex-1 overflow-auto",
                )}
              >
                {loadingBudgets ? (
                  <LoadingState message="Loading OPEX report…" />
                ) : opexRows.length === 0 ? (
                  <EmptyState
                    message="No OPEX lines for this year. Check the FY selector matches the year you used when submitting."
                    maximized={maximized}
                  />
                ) : (
                  <OpexTable
                    rows={opexRows}
                    total={opexTotal}
                    reviewingKey={reviewingKey}
                    onApprove={(id) => void reviewBudget(id, "Approved")}
                    onReject={setRejectBudget}
                    onTransfer={setTransferBudgetRow}
                    onEdit={setEditBudgetRow}
                    onUpdateBudget={setUpdateBudgetRow}
                  />
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
                  <AddBudgetButton
                    budgetType="CAPEX"
                    onClick={() => setAddBudgetType("CAPEX")}
                  />
                  <ExportButton
                    disabled={loadingBudgets || capexRows.length === 0}
                    onClick={() => handleExport("capex")}
                  />
                </div>
              </div>
              <div
                className={cn(
                  maximized && "min-h-0 flex-1 overflow-auto",
                )}
              >
                {loadingBudgets ? (
                  <LoadingState message="Loading CAPEX report…" />
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
                    reviewingKey={reviewingKey}
                    onApprove={(id) => void reviewBudget(id, "Approved")}
                    onReject={setRejectBudget}
                    onTransfer={setTransferBudgetRow}
                    onEdit={setEditBudgetRow}
                    onUpdateBudget={setUpdateBudgetRow}
                  />
                )}
              </div>
            </>
          )}

        </div>
      </main>

      {rejectBudget &&
        createPortal(
          <DetailOverlay
            onClose={() => {
              if (reviewingKey != null) return;
              setRejectBudget(null);
            }}
          >
            <RejectBudgetCard
              detail={rejectBudget}
              reviewing={reviewingKey === `yb-${rejectBudget.id}`}
              onClose={() => setRejectBudget(null)}
              onReject={(remarks) =>
                void reviewBudget(rejectBudget.id, "Rejected", remarks)
              }
            />
          </DetailOverlay>,
          document.body,
        )}

      {transferBudgetRow &&
        createPortal(
          <DetailOverlay
            onClose={() => {
              if (reviewingKey != null) return;
              setTransferBudgetRow(null);
            }}
          >
            <TransferBudgetCard
              detail={transferBudgetRow}
              reviewing={reviewingKey === `yb-${transferBudgetRow.id}`}
              onClose={() => setTransferBudgetRow(null)}
              onTransfer={(payload) =>
                void transferBudget(transferBudgetRow.id, payload)
              }
            />
          </DetailOverlay>,
          document.body,
        )}

      {editBudgetRow &&
        createPortal(
          <DetailOverlay
            onClose={() => {
              if (reviewingKey != null) return;
              setEditBudgetRow(null);
            }}
          >
            <EditBudgetCard
              detail={editBudgetRow}
              reviewing={reviewingKey === `yb-${editBudgetRow.id}`}
              onClose={() => setEditBudgetRow(null)}
              onSave={(payload) => void editBudget(editBudgetRow.id, payload)}
            />
          </DetailOverlay>,
          document.body,
        )}

      {updateBudgetRow &&
        createPortal(
          <DetailOverlay
            onClose={() => {
              if (reviewingKey != null) return;
              setUpdateBudgetRow(null);
            }}
          >
            <UpdateApprovedBudgetForm
              budgetId={updateBudgetRow.id}
              budgetRef={updateBudgetRow.budgetRef}
              budgetType={updateBudgetRow.budgetType}
              amount={updateBudgetRow.amount}
              quantity={updateBudgetRow.quantity}
              costPerUnit={updateBudgetRow.costPerUnit}
              items={updateBudgetRow.items}
              saving={reviewingKey === `yb-${updateBudgetRow.id}`}
              onClose={() => setUpdateBudgetRow(null)}
              onSave={(payload) =>
                void updateApprovedAmount(updateBudgetRow.id, payload)
              }
            />
          </DetailOverlay>,
          document.body,
        )}

      {addBudgetType &&
        createPortal(
          <DetailOverlay
            onClose={() => {
              if (reviewingKey != null) return;
              setAddBudgetType(null);
            }}
          >
            <AddBudgetCard
              budgetType={addBudgetType}
              reviewing={reviewingKey === "add-budget"}
              onClose={() => setAddBudgetType(null)}
              onSave={(payload) => void addBudget(payload)}
            />
          </DetailOverlay>,
          document.body,
        )}
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

function AddBudgetButton({
  budgetType,
  onClick,
}: {
  budgetType: "OPEX" | "CAPEX";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Add ${budgetType} line`}
      title={`Add ${budgetType}`}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-foreground/15 text-foreground/70 transition hover:bg-foreground/5 hover:text-foreground"
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}

function ReportSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-lg tracking-normal text-foreground">
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

function DetailOverlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] glass-card p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ActionIconButton({
  label,
  description,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:brightness-95 disabled:opacity-50",
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[60]">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

function BudgetActions({
  row,
  reviewing,
  onApprove,
  onReject,
  onTransfer,
  onEdit,
  onUpdateBudget,
}: {
  row: HodBudgetDetail;
  reviewing: boolean;
  onApprove: () => void;
  onReject: () => void;
  onTransfer: () => void;
  onEdit: () => void;
  onUpdateBudget: () => void;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center justify-center gap-1.5">
        {row.status === "Pending" && (
          <>
            <ActionIconButton
              label="Approve"
              description="Approve — accept this budget request"
              disabled={reviewing}
              onClick={onApprove}
              className="bg-emerald-100 text-emerald-700"
            >
              <Check className="h-3.5 w-3.5" />
            </ActionIconButton>
            <ActionIconButton
              label="Reject"
              description="Reject — send this budget back"
              disabled={reviewing}
              onClick={onReject}
              className="bg-red-100 text-red-600"
            >
              <X className="h-3.5 w-3.5" />
            </ActionIconButton>
            <ActionIconButton
              label="Transfer"
              description="Transfer — move this budget to another type"
              disabled={reviewing}
              onClick={onTransfer}
              className="bg-sky-100 text-sky-800"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </ActionIconButton>
          </>
        )}
        <ActionIconButton
          label="Update budget"
          description="Update budget — change the approved amount"
          disabled={reviewing}
          onClick={onUpdateBudget}
          className="bg-lime/70 text-lime-foreground"
        >
          <Wallet className="h-3.5 w-3.5" />
        </ActionIconButton>
        <ActionIconButton
          label="Edit"
          description="Edit — change the budget details"
          disabled={reviewing}
          onClick={onEdit}
          className="bg-amber-100 text-amber-800"
        >
          <Pencil className="h-3.5 w-3.5" />
        </ActionIconButton>
      </div>
    </TooltipProvider>
  );
}

function RejectBudgetCard({
  detail,
  reviewing,
  onClose,
  onReject,
}: {
  detail: HodBudgetDetail;
  reviewing: boolean;
  onClose: () => void;
  onReject: (remarks: string) => void;
}) {
  const [remarks, setRemarks] = useState("");
  const rejectId = `report-reject-${detail.id}`;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-foreground/40 uppercase">
            Reject budget
          </p>
          <h2 className="mt-1 font-display text-3xl">{detail.budgetRef}</h2>
          <p className="mt-1 text-sm text-foreground/60">
            {detail.budgetType === "CAPEX"
              ? detail.itemName || "Capital expenditure"
              : detail.activity || "Operating expenditure"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={reviewing}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/50 transition hover:bg-ivory hover:text-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 space-y-2">
        <Label htmlFor={rejectId}>Rejection remarks</Label>
        <Textarea
          id={rejectId}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value.slice(0, 255))}
          placeholder="Explain why this budget is rejected"
          maxLength={255}
          disabled={reviewing}
          autoFocus
          className="min-h-24 rounded-xl"
        />
        <p className="text-xs text-foreground/35">{remarks.length}/255</p>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2.5 border-t border-foreground/10 pt-6">
        <button
          type="button"
          onClick={() => {
            const value = remarks.trim();
            if (!value) {
              toast.error("Add a short reason before rejecting this budget.");
              return;
            }
            onReject(value);
          }}
          disabled={reviewing}
          className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          {reviewing ? "Updating…" : "Confirm reject"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={reviewing}
          className="rounded-full px-4 py-2.5 text-sm text-foreground/50 transition hover:bg-ivory hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TransferBudgetCard({
  detail,
  reviewing,
  onClose,
  onTransfer,
}: {
  detail: HodBudgetDetail;
  reviewing: boolean;
  onClose: () => void;
  onTransfer: (payload: TransferBudgetInput) => void;
}) {
  const targetType = detail.budgetType === "OPEX" ? "CAPEX" : "OPEX";
  const sourceType = detail.budgetType;
  const sourceItems = fallbackHodItems(detail);
  const firstSourceItem = sourceItems[0];

  const [capexCode, setCapexCode] = useState<
    (typeof CAPEX_CODES)[number]["value"] | ""
  >("");
  const [opexCode, setOpexCode] = useState<
    (typeof OPEX_CODES)[number]["value"] | ""
  >("");
  const [itemName, setItemName] = useState(
    detail.budgetType === "OPEX"
      ? (firstSourceItem?.itemName ?? detail.activity ?? "")
      : (detail.itemName ?? ""),
  );
  const [activity, setActivity] = useState(
    detail.budgetType === "CAPEX"
      ? (detail.itemName ?? "")
      : (detail.activity ?? ""),
  );
  const [objective, setObjective] = useState(detail.objective ?? "");
  const [justification, setJustification] = useState(detail.justification);
  const [targetMonths, setTargetMonths] = useState(detail.targetMonths ?? "");
  const [quantity, setQuantity] = useState(firstSourceItem?.quantity ?? 1);
  const [costPerUnit, setCostPerUnit] = useState(
    firstSourceItem?.costPerUnit != null
      ? String(firstSourceItem.costPerUnit)
      : detail.amount > 0
        ? String(detail.amount)
        : "",
  );
  const [opexCostRows, setOpexCostRows] = useState<OpexCostRow[]>(() =>
    detail.budgetType === "CAPEX"
      ? [
          createOpexCostRow({
            itemName: detail.itemName ?? "",
            quantity: detail.quantity ?? 1,
            costPerUnit:
              detail.costPerUnit != null
                ? String(detail.costPerUnit)
                : detail.amount > 0
                  ? String(detail.amount)
                  : "",
          }),
        ]
      : opexCostRowsFromDetail(detail),
  );
  const [effectIfNotApproved, setEffectIfNotApproved] = useState("");
  const [alternative, setAlternative] = useState("");
  const [remarks, setRemarks] = useState(detail.remarks ?? "");

  const unitValue = Number(costPerUnit) || 0;
  const estimatedPrice = quantity * unitValue;

  const submitTransfer = () => {
    if (targetType === "CAPEX") {
      if (!capexCode) {
        toast.error("Choose a CAPEX code to continue.");
        return;
      }
      if (!itemName.trim()) {
        toast.error("Enter the item name to continue.");
        return;
      }
      if (!justification.trim()) {
        toast.error("Add a justification to continue.");
        return;
      }
      if (unitValue <= 0) {
        toast.error("Enter a cost per unit above zero.");
        return;
      }
      onTransfer({
        targetType: "CAPEX",
        code: capexCode,
        itemName: itemName.trim(),
        justification: justification.trim(),
        targetMonths: targetMonths || undefined,
        quantity,
        costPerUnit: unitValue,
        budgetAmount: estimatedPrice,
        effectIfNotApproved: effectIfNotApproved.trim() || undefined,
        alternative: alternative.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      return;
    }

    if (!opexCode) {
      toast.error("Choose an OPEX code to continue.");
      return;
    }
    if (!activity.trim()) {
      toast.error("Enter the activity to continue.");
      return;
    }
    if (!objective.trim()) {
      toast.error("Add the objectives to continue.");
      return;
    }
    if (!justification.trim()) {
      toast.error("Add a justification to continue.");
      return;
    }
    const items = readyOpexPayloadItems(opexCostRows);
    if (items.length === 0) {
      toast.error("Add at least one item with name, qty, and unit cost.");
      return;
    }
    onTransfer({
      targetType: "OPEX",
      code: opexCode,
      activity: activity.trim(),
      objective: objective.trim(),
      justification: justification.trim(),
      targetMonths: targetMonths || undefined,
      items,
      remarks: remarks.trim() || undefined,
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-foreground/40 uppercase">
            Transfer to {targetType}
          </p>
          <h2 className="mt-1 font-display text-3xl">{detail.budgetRef}</h2>
          <p className="mt-1 text-sm text-foreground/60">
            From {sourceType} · RM {formatRm(detail.amount)} · {detail.requester}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={reviewing}
          aria-label="Close transfer form"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/50 transition hover:bg-ivory hover:text-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {targetType === "CAPEX" ? (
          <>
            <div className="space-y-2">
              <Label>CAPEX code</Label>
              <Select
                value={capexCode}
                onValueChange={(value) =>
                  setCapexCode(value as (typeof CAPEX_CODES)[number]["value"])
                }
                disabled={reviewing}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select CAPEX code" />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  {CAPEX_CODES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`transfer-item-${detail.id}`}>Item</Label>
              <Input
                id={`transfer-item-${detail.id}`}
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Laboratory microscope"
                disabled={reviewing}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`transfer-justification-${detail.id}`}>
                Justification
              </Label>
              <Textarea
                id={`transfer-justification-${detail.id}`}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Why this item is needed"
                disabled={reviewing}
                className="min-h-20 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`transfer-target-${detail.id}`}>
                Target months
              </Label>
              <Input
                id={`transfer-target-${detail.id}`}
                type="month"
                value={targetMonths}
                onChange={(e) => setTargetMonths(e.target.value)}
                disabled={reviewing}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`transfer-qty-${detail.id}`}>Quantity</Label>
                <Input
                  id={`transfer-qty-${detail.id}`}
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value) || 1))
                  }
                  disabled={reviewing}
                  className="h-11 rounded-xl tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`transfer-unit-${detail.id}`}>
                  Cost per unit (RM)
                </Label>
                <Input
                  id={`transfer-unit-${detail.id}`}
                  inputMode="decimal"
                  value={costPerUnit}
                  onChange={(e) =>
                    setCostPerUnit(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  placeholder="0.00"
                  disabled={reviewing}
                  className="h-11 rounded-xl tabular-nums"
                />
              </div>
            </div>
            <div className="rounded-2xl bg-ivory px-4 py-3">
              <p className="text-xs text-foreground/50">Estimated price</p>
              <p className="mt-1 font-display text-2xl tabular-nums">
                RM {formatRm(estimatedPrice)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`transfer-effect-${detail.id}`}>
                Effect if not approved
              </Label>
              <Textarea
                id={`transfer-effect-${detail.id}`}
                value={effectIfNotApproved}
                onChange={(e) => setEffectIfNotApproved(e.target.value)}
                placeholder="Optional"
                disabled={reviewing}
                className="min-h-16 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`transfer-alt-${detail.id}`}>Alternative</Label>
              <Textarea
                id={`transfer-alt-${detail.id}`}
                value={alternative}
                onChange={(e) => setAlternative(e.target.value)}
                placeholder="Optional"
                disabled={reviewing}
                className="min-h-16 rounded-xl"
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>OPEX code</Label>
              <Select
                value={opexCode}
                onValueChange={(value) =>
                  setOpexCode(value as (typeof OPEX_CODES)[number]["value"])
                }
                disabled={reviewing}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select OPEX code" />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  {OPEX_CODES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`transfer-activity-${detail.id}`}>
                Activities / Programme / Event
              </Label>
              <Input
                id={`transfer-activity-${detail.id}`}
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                placeholder="e.g. Annual maintenance"
                disabled={reviewing}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`transfer-objective-${detail.id}`}>
                Objectives
              </Label>
              <Textarea
                id={`transfer-objective-${detail.id}`}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="What this budget aims to achieve"
                disabled={reviewing}
                className="min-h-20 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`transfer-justification-${detail.id}`}>
                Justification
              </Label>
              <Textarea
                id={`transfer-justification-${detail.id}`}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Why this budget is needed"
                disabled={reviewing}
                className="min-h-20 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`transfer-target-${detail.id}`}>
                Target months
              </Label>
              <Input
                id={`transfer-target-${detail.id}`}
                type="month"
                value={targetMonths}
                onChange={(e) => setTargetMonths(e.target.value)}
                disabled={reviewing}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Cost items</Label>
              <HodOpexItemsEditor
                rows={opexCostRows}
                onChange={setOpexCostRows}
                disabled={reviewing}
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor={`transfer-remarks-${detail.id}`}>Remarks</Label>
          <Input
            id={`transfer-remarks-${detail.id}`}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional"
            disabled={reviewing}
            className="h-11 rounded-xl"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2.5 border-t border-foreground/10 pt-6">
        <button
          type="button"
          onClick={submitTransfer}
          disabled={reviewing}
          className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
        >
          <ArrowRightLeft className="h-4 w-4" />
          {reviewing ? "Transferring…" : `Confirm transfer to ${targetType}`}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={reviewing}
          className="rounded-full px-4 py-2.5 text-sm text-foreground/50 transition hover:bg-ivory hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EditBudgetCard({
  detail,
  reviewing,
  onClose,
  onSave,
}: {
  detail: HodBudgetDetail;
  reviewing: boolean;
  onClose: () => void;
  onSave: (payload: EditBudgetInput) => void;
}) {
  const isCapex = detail.budgetType === "CAPEX";
  const lockAmounts = true;
  const [capexCode, setCapexCode] = useState<
    (typeof CAPEX_CODES)[number]["value"] | ""
  >(
    CAPEX_CODES.some((entry) => entry.value === detail.code)
      ? (detail.code as (typeof CAPEX_CODES)[number]["value"])
      : "",
  );
  const [opexCode, setOpexCode] = useState<
    (typeof OPEX_CODES)[number]["value"] | ""
  >(
    OPEX_CODES.some((entry) => entry.value === detail.code)
      ? (detail.code as (typeof OPEX_CODES)[number]["value"])
      : "",
  );
  const [itemName, setItemName] = useState(detail.itemName ?? "");
  const [activity, setActivity] = useState(detail.activity ?? "");
  const [objective, setObjective] = useState(detail.objective ?? "");
  const [justification, setJustification] = useState(detail.justification);
  const [targetMonths, setTargetMonths] = useState(detail.targetMonths ?? "");
  const [quantity, setQuantity] = useState(detail.quantity ?? 1);
  const [costPerUnit, setCostPerUnit] = useState(
    detail.costPerUnit == null ? "" : String(detail.costPerUnit),
  );
  const [opexCostRows, setOpexCostRows] = useState<OpexCostRow[]>(() =>
    opexCostRowsFromDetail(detail),
  );
  const [effectIfNotApproved, setEffectIfNotApproved] = useState(
    detail.effectIfNotApproved ?? "",
  );
  const [alternative, setAlternative] = useState(detail.alternative ?? "");
  const [remarks, setRemarks] = useState(detail.remarks ?? "");

  const unitValue = Number(costPerUnit) || 0;
  const estimatedPrice = quantity * unitValue;

  const submitEdit = () => {
    if (isCapex) {
      if (!capexCode) {
        toast.error("Choose a CAPEX code to continue.");
        return;
      }
      if (!itemName.trim()) {
        toast.error("Enter the item name to continue.");
        return;
      }
      if (!justification.trim()) {
        toast.error("Add a justification to continue.");
        return;
      }
      if (!lockAmounts && unitValue <= 0) {
        toast.error("Enter a cost per unit above zero.");
        return;
      }
      onSave({
        budgetType: "CAPEX",
        code: capexCode,
        itemName: itemName.trim(),
        justification: justification.trim(),
        targetMonths: targetMonths || undefined,
        quantity: lockAmounts ? (detail.quantity ?? 1) : quantity,
        costPerUnit: lockAmounts ? (detail.costPerUnit ?? unitValue) : unitValue,
        budgetAmount: lockAmounts ? detail.amount : estimatedPrice,
        effectIfNotApproved: effectIfNotApproved.trim() || undefined,
        alternative: alternative.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      return;
    }

    if (!opexCode) {
      toast.error("Choose an OPEX code to continue.");
      return;
    }
    if (!activity.trim()) {
      toast.error("Enter the activity to continue.");
      return;
    }
    if (!objective.trim()) {
      toast.error("Add the objectives to continue.");
      return;
    }
    if (!justification.trim()) {
      toast.error("Add a justification to continue.");
      return;
    }
    const items = readyOpexPayloadItems(opexCostRows);
    if (items.length === 0) {
      toast.error("Add at least one item with name, qty, and unit cost.");
      return;
    }
    onSave({
      budgetType: "OPEX",
      code: opexCode,
      activity: activity.trim(),
      objective: objective.trim(),
      justification: justification.trim(),
      targetMonths: targetMonths || undefined,
      items,
      remarks: remarks.trim() || undefined,
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-foreground/40 uppercase">
            Edit {detail.budgetType}
          </p>
          <h2 className="mt-1 font-display text-3xl">{detail.budgetRef}</h2>
          <p className="mt-1 text-sm text-foreground/60">
            RM {formatRm(detail.amount)} · {detail.requester}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={reviewing}
          aria-label="Close edit form"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/50 transition hover:bg-ivory hover:text-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {isCapex ? (
          <>
            <div className="space-y-2">
              <Label>CAPEX code</Label>
              <Select
                value={capexCode}
                onValueChange={(value) =>
                  setCapexCode(value as (typeof CAPEX_CODES)[number]["value"])
                }
                disabled={reviewing}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select CAPEX code" />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  {CAPEX_CODES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-item-${detail.id}`}>Item</Label>
              <Input
                id={`edit-item-${detail.id}`}
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Laboratory microscope"
                disabled={reviewing}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-justification-${detail.id}`}>
                Justification
              </Label>
              <Textarea
                id={`edit-justification-${detail.id}`}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Why this item is needed"
                disabled={reviewing}
                className="min-h-20 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-target-${detail.id}`}>Target months</Label>
              <Input
                id={`edit-target-${detail.id}`}
                type="month"
                value={targetMonths}
                onChange={(e) => setTargetMonths(e.target.value)}
                disabled={reviewing}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`edit-qty-${detail.id}`}>Quantity</Label>
                <Input
                  id={`edit-qty-${detail.id}`}
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value) || 1))
                  }
                  disabled={reviewing || lockAmounts}
                  className="h-11 rounded-xl tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`edit-unit-${detail.id}`}>
                  Cost per unit (RM)
                </Label>
                <Input
                  id={`edit-unit-${detail.id}`}
                  inputMode="decimal"
                  value={costPerUnit}
                  onChange={(e) =>
                    setCostPerUnit(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  placeholder="0.00"
                  disabled={reviewing || lockAmounts}
                  className="h-11 rounded-xl tabular-nums"
                />
              </div>
            </div>
            <div className="rounded-2xl bg-ivory px-4 py-3">
              <p className="text-xs text-foreground/50">Estimated price</p>
              <p className="mt-1 font-display text-2xl tabular-nums">
                RM {formatRm(lockAmounts ? detail.amount : estimatedPrice)}
              </p>
              <p className="mt-1 text-xs text-foreground/50">
                Use Update budget to change quantity, unit cost, or amount.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-effect-${detail.id}`}>
                Effect if not approved
              </Label>
              <Textarea
                id={`edit-effect-${detail.id}`}
                value={effectIfNotApproved}
                onChange={(e) => setEffectIfNotApproved(e.target.value)}
                placeholder="Optional"
                disabled={reviewing}
                className="min-h-16 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-alt-${detail.id}`}>Alternative</Label>
              <Textarea
                id={`edit-alt-${detail.id}`}
                value={alternative}
                onChange={(e) => setAlternative(e.target.value)}
                placeholder="Optional"
                disabled={reviewing}
                className="min-h-16 rounded-xl"
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>OPEX code</Label>
              <Select
                value={opexCode}
                onValueChange={(value) =>
                  setOpexCode(value as (typeof OPEX_CODES)[number]["value"])
                }
                disabled={reviewing}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select OPEX code" />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  {OPEX_CODES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-activity-${detail.id}`}>
                Activities / Programme / Event
              </Label>
              <Input
                id={`edit-activity-${detail.id}`}
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                placeholder="e.g. Annual maintenance"
                disabled={reviewing}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-objective-${detail.id}`}>Objectives</Label>
              <Textarea
                id={`edit-objective-${detail.id}`}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="What this budget aims to achieve"
                disabled={reviewing}
                className="min-h-20 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-opex-justification-${detail.id}`}>
                Justification
              </Label>
              <Textarea
                id={`edit-opex-justification-${detail.id}`}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Why this budget is needed"
                disabled={reviewing}
                className="min-h-20 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-opex-target-${detail.id}`}>
                Target months
              </Label>
              <Input
                id={`edit-opex-target-${detail.id}`}
                type="month"
                value={targetMonths}
                onChange={(e) => setTargetMonths(e.target.value)}
                disabled={reviewing}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Items</Label>
              <HodOpexItemsEditor
                rows={opexCostRows}
                onChange={setOpexCostRows}
                disabled={reviewing}
                lockAmounts={lockAmounts}
              />
              <p className="text-xs text-foreground/50">
                Item names can be edited here. Use Update budget to change
                quantity, unit cost, or add items.
              </p>
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor={`edit-remarks-${detail.id}`}>Remarks</Label>
          <Input
            id={`edit-remarks-${detail.id}`}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional"
            disabled={reviewing}
            className="h-11 rounded-xl"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2.5 border-t border-foreground/10 pt-6">
        <button
          type="button"
          onClick={submitEdit}
          disabled={reviewing}
          className="inline-flex items-center gap-2 rounded-full bg-amber-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-800 disabled:opacity-50"
        >
          <Pencil className="h-4 w-4" />
          {reviewing ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={reviewing}
          className="rounded-full px-4 py-2.5 text-sm text-foreground/50 transition hover:bg-ivory hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddBudgetCard({
  budgetType,
  reviewing,
  onClose,
  onSave,
}: {
  budgetType: "OPEX" | "CAPEX";
  reviewing: boolean;
  onClose: () => void;
  onSave: (payload: EditBudgetInput) => void;
}) {
  const isCapex = budgetType === "CAPEX";
  const [capexCode, setCapexCode] = useState<
    (typeof CAPEX_CODES)[number]["value"] | ""
  >("");
  const [opexCode, setOpexCode] = useState<
    (typeof OPEX_CODES)[number]["value"] | ""
  >("");
  const [itemName, setItemName] = useState("");
  const [activity, setActivity] = useState("");
  const [objective, setObjective] = useState("");
  const [justification, setJustification] = useState("");
  const [targetMonths, setTargetMonths] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [costPerUnit, setCostPerUnit] = useState("");
  const [opexCostRows, setOpexCostRows] = useState<OpexCostRow[]>([
    createOpexCostRow(),
  ]);
  const [effectIfNotApproved, setEffectIfNotApproved] = useState("");
  const [alternative, setAlternative] = useState("");
  const [remarks, setRemarks] = useState("");

  const unitValue = Number(costPerUnit) || 0;
  const estimatedPrice = quantity * unitValue;

  const submitAdd = () => {
    if (isCapex) {
      if (!capexCode) {
        toast.error("Choose a CAPEX code to continue.");
        return;
      }
      if (!itemName.trim()) {
        toast.error("Enter the item name to continue.");
        return;
      }
      if (!justification.trim()) {
        toast.error("Add a justification to continue.");
        return;
      }
      if (unitValue <= 0) {
        toast.error("Enter a cost per unit above zero.");
        return;
      }
      onSave({
        budgetType: "CAPEX",
        code: capexCode,
        itemName: itemName.trim(),
        justification: justification.trim(),
        targetMonths: targetMonths || undefined,
        quantity,
        costPerUnit: unitValue,
        budgetAmount: estimatedPrice,
        effectIfNotApproved: effectIfNotApproved.trim() || undefined,
        alternative: alternative.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      return;
    }

    if (!opexCode) {
      toast.error("Choose an OPEX code to continue.");
      return;
    }
    if (!activity.trim()) {
      toast.error("Enter the activity to continue.");
      return;
    }
    if (!objective.trim()) {
      toast.error("Add the objectives to continue.");
      return;
    }
    if (!justification.trim()) {
      toast.error("Add a justification to continue.");
      return;
    }
    const items = readyOpexPayloadItems(opexCostRows);
    if (items.length === 0) {
      toast.error("Add at least one item with name, qty, and unit cost.");
      return;
    }
    onSave({
      budgetType: "OPEX",
      code: opexCode,
      activity: activity.trim(),
      objective: objective.trim(),
      justification: justification.trim(),
      targetMonths: targetMonths || undefined,
      items,
      remarks: remarks.trim() || undefined,
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-foreground/40 uppercase">
            Add {budgetType}
          </p>
          <h2 className="mt-1 font-display text-3xl">New budget line</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Fill in the details, then add it to this year's report.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={reviewing}
          aria-label="Close add form"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/50 transition hover:bg-ivory hover:text-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {isCapex ? (
          <>
            <div className="space-y-2">
              <Label>CAPEX code</Label>
              <Select
                value={capexCode}
                onValueChange={(value) =>
                  setCapexCode(value as (typeof CAPEX_CODES)[number]["value"])
                }
                disabled={reviewing}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select CAPEX code" />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  {CAPEX_CODES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-item">Item</Label>
              <Input
                id="add-item"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Laboratory microscope"
                disabled={reviewing}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-justification">Justification</Label>
              <Textarea
                id="add-justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Why this item is needed"
                disabled={reviewing}
                className="min-h-20 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-target">Target months</Label>
              <Input
                id="add-target"
                type="month"
                value={targetMonths}
                onChange={(e) => setTargetMonths(e.target.value)}
                disabled={reviewing}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add-qty">Quantity</Label>
                <Input
                  id="add-qty"
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value) || 1))
                  }
                  disabled={reviewing}
                  className="h-11 rounded-xl tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-unit">Cost per unit (RM)</Label>
                <Input
                  id="add-unit"
                  inputMode="decimal"
                  value={costPerUnit}
                  onChange={(e) =>
                    setCostPerUnit(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  placeholder="0.00"
                  disabled={reviewing}
                  className="h-11 rounded-xl tabular-nums"
                />
              </div>
            </div>
            <div className="rounded-2xl bg-ivory px-4 py-3">
              <p className="text-xs text-foreground/50">Estimated price</p>
              <p className="mt-1 font-display text-2xl tabular-nums">
                RM {formatRm(estimatedPrice)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-effect">Effect if not approved</Label>
              <Textarea
                id="add-effect"
                value={effectIfNotApproved}
                onChange={(e) => setEffectIfNotApproved(e.target.value)}
                placeholder="Optional"
                disabled={reviewing}
                className="min-h-16 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-alt">Alternative</Label>
              <Textarea
                id="add-alt"
                value={alternative}
                onChange={(e) => setAlternative(e.target.value)}
                placeholder="Optional"
                disabled={reviewing}
                className="min-h-16 rounded-xl"
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>OPEX code</Label>
              <Select
                value={opexCode}
                onValueChange={(value) =>
                  setOpexCode(value as (typeof OPEX_CODES)[number]["value"])
                }
                disabled={reviewing}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select OPEX code" />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  {OPEX_CODES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-activity">
                Activities / Programme / Event
              </Label>
              <Input
                id="add-activity"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                placeholder="e.g. Annual maintenance"
                disabled={reviewing}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-objective">Objectives</Label>
              <Textarea
                id="add-objective"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="What this budget aims to achieve"
                disabled={reviewing}
                className="min-h-20 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-opex-justification">Justification</Label>
              <Textarea
                id="add-opex-justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Why this budget is needed"
                disabled={reviewing}
                className="min-h-20 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-opex-target">Target months</Label>
              <Input
                id="add-opex-target"
                type="month"
                value={targetMonths}
                onChange={(e) => setTargetMonths(e.target.value)}
                disabled={reviewing}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Cost items</Label>
              <HodOpexItemsEditor
                rows={opexCostRows}
                onChange={setOpexCostRows}
                disabled={reviewing}
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="add-remarks">Remarks</Label>
          <Input
            id="add-remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional"
            disabled={reviewing}
            className="h-11 rounded-xl"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2.5 border-t border-foreground/10 pt-6">
        <button
          type="button"
          onClick={submitAdd}
          disabled={reviewing}
          className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-medium text-lime-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {reviewing ? "Adding…" : `Add ${budgetType}`}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={reviewing}
          className="rounded-full px-4 py-2.5 text-sm text-foreground/50 transition hover:bg-ivory hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function OpexTable({
  rows,
  total,
  reviewingKey,
  onApprove,
  onReject,
  onTransfer,
  onEdit,
  onUpdateBudget,
}: {
  rows: HodBudgetDetail[];
  total: number;
  reviewingKey: string | null;
  onApprove: (id: number) => void;
  onReject: (row: HodBudgetDetail) => void;
  onTransfer: (row: HodBudgetDetail) => void;
  onEdit: (row: HodBudgetDetail) => void;
  onUpdateBudget: (row: HodBudgetDetail) => void;
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
            <th className="border border-foreground/20 px-3 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const items = fallbackHodItems(row);

            return (
              <tr key={row.id} className="align-top odd:bg-background even:bg-ivory/40">
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
                <td className="border border-foreground/15 px-3 py-3 text-center">
                  <BudgetActions
                    row={row}
                    reviewing={reviewingKey === `yb-${row.id}`}
                    onApprove={() => onApprove(row.id)}
                    onReject={() => onReject(row)}
                    onTransfer={() => onTransfer(row)}
                    onEdit={() => onEdit(row)}
                    onUpdateBudget={() => onUpdateBudget(row)}
                  />
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
            <td
              colSpan={2}
              className="border border-foreground/15 px-3 py-3"
            />
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
  reviewingKey,
  onApprove,
  onReject,
  onTransfer,
  onEdit,
  onUpdateBudget,
}: {
  rows: HodBudgetDetail[];
  year: number;
  total: number;
  reviewingKey: string | null;
  onApprove: (id: number) => void;
  onReject: (row: HodBudgetDetail) => void;
  onTransfer: (row: HodBudgetDetail) => void;
  onEdit: (row: HodBudgetDetail) => void;
  onUpdateBudget: (row: HodBudgetDetail) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/15">
      <table className="min-w-[1600px] w-full border-collapse text-sm">
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
              colSpan={4}
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
            <th className="border border-foreground/20 px-3 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className="align-top odd:bg-background even:bg-ivory/40">
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
                {row.itemName || "—"}
              </td>
              <td className="border border-foreground/15 px-3 py-3 whitespace-pre-wrap">
                {row.justification}
              </td>
              <td className="border border-foreground/15 px-3 py-3 text-center">
                {formatMonth(row.targetMonths)}
              </td>
              <td className="border border-foreground/15 bg-amber-50/60 px-3 py-3 text-center tabular-nums">
                {row.quantity ?? "—"}
              </td>
              <td className="border border-foreground/15 bg-amber-50/60 px-3 py-3 text-right tabular-nums">
                {row.costPerUnit == null ? "—" : formatRm(row.costPerUnit)}
              </td>
              <td className="border border-foreground/15 bg-amber-50/60 px-3 py-3 text-right font-medium tabular-nums">
                {formatRm(row.amount)}
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
              <td className="border border-foreground/15 px-3 py-3 text-center">
                <BudgetActions
                  row={row}
                  reviewing={reviewingKey === `yb-${row.id}`}
                  onApprove={() => onApprove(row.id)}
                  onReject={() => onReject(row)}
                  onTransfer={() => onTransfer(row)}
                  onEdit={() => onEdit(row)}
                  onUpdateBudget={() => onUpdateBudget(row)}
                />
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
              colSpan={4}
              className="border border-foreground/15 px-3 py-3"
            />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
