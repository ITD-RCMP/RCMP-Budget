import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  ClipboardPen,
  Trash2,
  X,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowLeft,
  CalendarDays,
  Building2,
  Info,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
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
  getMyBudget,
  listMyBudgets,
  resubmitYearlyBudget,
  deleteYearlyBudget,
  transferYearlyBudget,
  updateApprovedYearlyBudget,
  type BudgetDetail,
  type BudgetListItem,
} from "@backend/server-functions/budget-fns";
import { listMyBudgetLogsForBudget, type BudgetActionLog } from "@backend/server-functions/budget-log-fns";
import { isYearlyBudgetFormEnabled } from "@backend/server-functions/settings-fns";
import {
  BudgetLogList,
  UpdateApprovedBudgetForm,
  type UpdateApprovedBudgetPayload,
} from "@/features/budget-action-log-list";

type Status = "Pending" | "Approved" | "Rejected";

const statusConfig: Record<Status, { icon: LucideIcon; tone: string }> = {
  Pending: { icon: Clock, tone: "text-amber-600 bg-amber-100" },
  Approved: { icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-100" },
  Rejected: { icon: XCircle, tone: "text-red-600 bg-red-100" },
};

const filters = ["All", "Pending", "Approved", "Rejected"] as const;

function formatRm(value: number) {
  return `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function StatusPill({ status }: { status: Status }) {
  const { icon: Icon, tone } = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex w-28 items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        tone,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}

export function HistoryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [query, setQuery] = useState("");
  const [budgets, setBudgets] = useState<BudgetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [budgetFormEnabled, setBudgetFormEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    listMyBudgets()
      .then((budgetRows) => {
        if (!active) return;
        setBudgets(budgetRows);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not load your history. Refresh and try again.",
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

  const visibleBudgets = useMemo(
    () =>
      budgets.filter(
        (row) =>
          (filter === "All" || row.status === filter) &&
          `${row.budgetRef} ${row.title} ${row.code} ${row.budgetType} ${row.budgetYear} ${row.createdByEmail}`
            .toLowerCase()
            .includes(query.toLowerCase().trim()),
      ),
    [budgets, filter, query],
  );

  const currentYear = new Date().getFullYear();
  const budgetTotal = budgets.reduce((sum, row) => sum + row.amount, 0);
  const requestedOpex = budgets
    .filter(
      (row) => row.budgetYear === currentYear && row.budgetType === "OPEX",
    )
    .reduce((sum, row) => sum + row.amount, 0);
  const requestedCapex = budgets
    .filter(
      (row) => row.budgetYear === currentYear && row.budgetType === "CAPEX",
    )
    .reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="flex h-screen flex-col overflow-hidden app-canvas text-foreground md:flex-row">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-6 md:p-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">History</h1>
            <p className="mt-2 text-sm text-foreground/60">
              Track your yearly budgets in one place.
            </p>
          </div>
          <button
            type="button"
            disabled={!budgetFormEnabled}
            onClick={() => {
              if (!budgetFormEnabled) {
                toast.error(
                  "Yearly budget submissions are closed. Try again later.",
                );
                return;
              }
              void navigate({ to: "/user/budget" });
            }}
            className="inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-medium text-lime-foreground transition hover:brightness-95 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Yearly budget
            {!budgetFormEnabled ? " (Closed)" : ""}
          </button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            icon={Wallet}
            label="Budget lines"
            value={String(budgets.length)}
            hint={formatRm(budgetTotal)}
            featured
          />
          <SummaryCard
            icon={ArrowDownLeft}
            label="Requested OPEX"
            value={formatRm(requestedOpex)}
            hint={`FY ${currentYear}`}
          />
          <SummaryCard
            icon={ArrowUpRight}
            label="Requested CAPEX"
            value={formatRm(requestedCapex)}
            hint={`FY ${currentYear}`}
          />
        </div>

        <div className="mt-6 rounded-[1.5rem] glass-card p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-2xl">Yearly budgets</h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search budgets"
                className="h-11 rounded-full pl-11"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1 rounded-full border border-foreground/10 p-1 w-fit">
            {filters.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  filter === option
                    ? "bg-foreground text-background"
                    : "text-foreground/60 hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {loading ? (
              <EmptyState message="Loading your budgets…" />
            ) : visibleBudgets.length === 0 ? (
              <EmptyState
                message={
                  budgets.length === 0
                    ? "No budgets yet. Submit a yearly budget request."
                    : "No budgets match your filters."
                }
              />
            ) : (
              <ul className="divide-y divide-foreground/10">
                {visibleBudgets.map((row) => (
                  <li key={row.id}>
                    <Link
                      to="/user/history/$budgetId"
                      params={{ budgetId: String(row.id) }}
                      className="flex w-full flex-wrap items-center justify-between gap-4 py-4 text-left transition hover:bg-ivory/60"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
                              row.budgetType === "OPEX"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-amber-100 text-amber-800",
                            )}
                          >
                            {row.budgetType}
                          </span>
                          <p className="truncate text-sm font-medium">
                            {row.title}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-foreground/50">
                          {row.budgetRef} · FY {row.budgetYear} · {row.code}
                          {" · "}
                          {row.isMine ? "You" : row.createdByEmail}
                          {" · "}
                          {row.date}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium tabular-nums">
                          {formatRm(row.amount)}
                        </span>
                        <StatusPill status={row.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export function HistoryBudgetDetailPage({ budgetId }: { budgetId: number }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<BudgetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [budgetFormEnabled, setBudgetFormEnabled] = useState(true);
  const [logs, setLogs] = useState<BudgetActionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

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

  useEffect(() => {
    if (!Number.isFinite(budgetId) || budgetId <= 0) {
      toast.error("This budget could not be found. Open it from History.");
      void navigate({ to: "/user/history" });
      return;
    }

    let active = true;
    setLoading(true);
    getMyBudget({ data: { budgetId } })
      .then((row) => {
        if (active) setDetail(row);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not open this budget. Try again.",
        );
        void navigate({ to: "/user/history" });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [budgetId, navigate]);

  useEffect(() => {
    if (!Number.isFinite(budgetId) || budgetId <= 0) return;

    let active = true;
    setLogsLoading(true);
    listMyBudgetLogsForBudget({ data: { budgetId } })
      .then((rows) => {
        if (active) setLogs(rows);
      })
      .catch(() => {
        if (active) setLogs([]);
      })
      .finally(() => {
        if (active) setLogsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [budgetId]);

  const goBack = () => {
    void navigate({ to: "/user/history" });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden app-canvas text-foreground md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-12">
        <Link
          to="/user/history"
          activeOptions={{ exact: true }}
          className="inline-flex items-center gap-2 text-sm text-foreground/55 transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </Link>
        <div className="mt-6">
          {loading || !detail ? (
            <p className="py-16 text-center text-sm text-foreground/50">
              Loading budget details
            </p>
          ) : (
            <BudgetDetailCard
              key={`${detail.id}-${detail.budgetType}`}
              detail={detail}
              formEnabled={budgetFormEnabled}
              logs={logs}
              logsLoading={logsLoading}
              onResubmitted={(updated) => {
                setDetail(updated);
                void listMyBudgetLogsForBudget({ data: { budgetId: updated.id } })
                  .then(setLogs)
                  .catch(() => {});
              }}
              onDeleted={goBack}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  featured,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[1.5rem] p-5 glass-card transition hover:-translate-y-0.5",
        featured ? "bg-lime text-lime-foreground" : "",
      )}
    >
      <Icon
        className={cn(
          "absolute -right-3 -bottom-3 h-20 w-20 -rotate-12 transition group-hover:rotate-0",
          featured ? "text-lime-foreground/10" : "text-foreground/5",
        )}
      />
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            featured
              ? "bg-lime-foreground/10"
              : "bg-lime text-lime-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <p
          className={cn(
            "text-sm font-medium",
            featured ? "text-lime-foreground/70" : "text-foreground/60",
          )}
        >
          {label}
        </p>
      </div>
      <p className="relative mt-3 font-display text-3xl tabular-nums">{value}</p>
      <p
        className={cn(
          "relative mt-1 text-xs",
          featured ? "text-lime-foreground/60" : "text-foreground/50",
        )}
      >
        {hint}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-foreground/15 py-14 text-center">
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

function BudgetDetailCard({
  detail,
  formEnabled,
  logs,
  logsLoading,
  onResubmitted,
  onDeleted,
}: {
  detail: BudgetDetail;
  formEnabled: boolean;
  logs: BudgetActionLog[];
  logsLoading: boolean;
  onResubmitted: (detail: BudgetDetail) => void;
  onDeleted: (budgetId: number) => void;
}) {
  const { icon: StatusIcon, tone } = statusConfig[detail.status];
  const isCapex = detail.budgetType === "CAPEX";
  const canEdit = detail.isMine && formEnabled;
  const canDelete =
    (detail.status === "Pending" || detail.status === "Rejected") &&
    detail.isMine;
  const canTransfer =
    detail.status === "Pending" && detail.isMine && formEnabled;
  const canUpdateBudget = detail.isMine;
  const isResubmit = detail.status === "Rejected";
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [code, setCode] = useState(detail.code);
  const [activity, setActivity] = useState(detail.activity ?? "");
  const [itemName, setItemName] = useState(detail.itemName ?? "");
  const [targetMonths, setTargetMonths] = useState(detail.targetMonths ?? "");
  const [objective, setObjective] = useState(detail.objective ?? "");
  const [justification, setJustification] = useState(detail.justification);
  const [quantity, setQuantity] = useState(detail.quantity ?? 1);
  const [costPerUnit, setCostPerUnit] = useState(
    detail.costPerUnit == null ? "" : String(detail.costPerUnit),
  );
  const [budgetAmount, setBudgetAmount] = useState(String(detail.amount));
  const [effectIfNotApproved, setEffectIfNotApproved] = useState(
    detail.effectIfNotApproved ?? "",
  );
  const [alternative, setAlternative] = useState(detail.alternative ?? "");
  const [remarks, setRemarks] = useState(detail.remarks ?? "");
  const [opexItemNames, setOpexItemNames] = useState(
    () => detail.items.map((item) => item.itemName ?? ""),
  );

  const unitValue = Number(costPerUnit) || 0;
  const codeOptions = isCapex ? CAPEX_CODES : OPEX_CODES;

  useEffect(() => {
    if (detail.status !== "Pending") {
      setTransferOpen(false);
    }
  }, [detail.status]);

  const resetForm = () => {
    setCode(detail.code);
    setActivity(detail.activity ?? "");
    setItemName(detail.itemName ?? "");
    setTargetMonths(detail.targetMonths ?? "");
    setObjective(detail.objective ?? "");
    setJustification(detail.justification);
    setQuantity(detail.quantity ?? 1);
    setCostPerUnit(
      detail.costPerUnit == null ? "" : String(detail.costPerUnit),
    );
    setBudgetAmount(String(detail.amount));
    setEffectIfNotApproved(detail.effectIfNotApproved ?? "");
    setAlternative(detail.alternative ?? "");
    setRemarks(detail.remarks ?? "");
    setOpexItemNames(detail.items.map((item) => item.itemName ?? ""));
  };

  const startEdit = () => {
    resetForm();
    setEditing(true);
  };

  const cancelEdit = () => {
    resetForm();
    setEditing(false);
  };

  const closeTransfer = () => {
    if (transferring) return;
    setTransferOpen(false);
  };

  const closeUpdate = () => {
    if (updating) return;
    setUpdateOpen(false);
  };

  const handleUpdateBudget = async (payload: UpdateApprovedBudgetPayload) => {
    if (updating || !canUpdateBudget) return;
    setUpdating(true);
    const toastId = toast.loading(`Updating ${detail.budgetRef}…`);
    try {
      const updated = await updateApprovedYearlyBudget({
        data: { budgetId: detail.id, ...payload },
      });
      onResubmitted(updated);
      setUpdateOpen(false);
      toast.success(`${detail.budgetRef} amount updated`, {
        id: toastId,
        description: "The amount was saved. Status did not change.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update this budget. Try again.",
        { id: toastId },
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleTransfer = async (payload: TransferBudgetInput) => {
    if (transferring || !canTransfer) return;
    setTransferring(true);
    const toastId = toast.loading(
      `Transferring ${detail.budgetRef} to ${payload.targetType}…`,
    );
    try {
      const updated = await transferYearlyBudget({
        data: { budgetId: detail.id, ...payload },
      });
      onResubmitted(updated);
      setTransferOpen(false);
      toast.success(`${detail.budgetRef} transferred to ${payload.targetType}`, {
        id: toastId,
        description: "Still waiting for HOD review.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not transfer this budget. Try again.",
        { id: toastId },
      );
    } finally {
      setTransferring(false);
    }
  };

  const handleResubmit = async () => {
    if (saving) return;

    if (isCapex) {
      if (!code || !itemName.trim() || !justification.trim()) {
        toast.error("Fill in item and justification, then try again.");
        return;
      }
    } else if (
      !code ||
      !activity.trim() ||
      !objective.trim() ||
      !justification.trim()
    ) {
      toast.error("Fill in the required fields, then try again.");
      return;
    } else if (
      detail.items.length > 0 &&
      (opexItemNames.length !== detail.items.length ||
        opexItemNames.some((name) => !name.trim()))
    ) {
      toast.error("Name every item, then try again.");
      return;
    }

    setSaving(true);
    const toastId = toast.loading(
      isResubmit
        ? `Resubmitting ${detail.budgetRef}…`
        : `Saving ${detail.budgetRef}…`,
    );
    try {
      const updated = isCapex
        ? await resubmitYearlyBudget({
            data: {
              budgetId: detail.id,
              budgetType: "CAPEX",
              code,
              itemName: itemName.trim(),
              justification: justification.trim(),
              targetMonths: targetMonths || undefined,
              effectIfNotApproved: effectIfNotApproved.trim() || undefined,
              alternative: alternative.trim() || undefined,
              remarks: remarks.trim() || undefined,
            },
          })
        : await resubmitYearlyBudget({
            data: {
              budgetId: detail.id,
              budgetType: "OPEX",
              code,
              activity: activity.trim(),
              targetMonths: targetMonths || undefined,
              objective: objective.trim(),
              justification: justification.trim(),
              remarks: remarks.trim() || undefined,
              itemNames: opexItemNames.map((name) => name.trim()),
            },
          });
      onResubmitted(updated);
      setEditing(false);
      toast.success(
        isResubmit
          ? `${detail.budgetRef} resubmitted`
          : `${detail.budgetRef} updated`,
        {
          id: toastId,
          description: isResubmit
            ? "It is pending HOD review again."
            : "Details were saved. Amounts were not changed.",
        },
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save this budget. Try again.",
        { id: toastId },
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || !canDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    const toastId = toast.loading(
      isResubmit ? `Removing ${detail.budgetRef}…` : `Deleting ${detail.budgetRef}…`,
    );
    try {
      await deleteYearlyBudget({ data: { budgetId: detail.id } });
      toast.success(
        isResubmit ? `${detail.budgetRef} removed` : `${detail.budgetRef} deleted`,
        {
          id: toastId,
          description: "This budget request has been removed.",
        },
      );
      onDeleted(detail.id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete this budget. Try again.",
        { id: toastId },
      );
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const title =
    (isCapex ? detail.itemName : detail.activity)?.trim() || detail.budgetRef;

  return (
    <div className="mx-auto max-w-5xl">
      {editing ? (
        <div className="rounded-[1.5rem] glass-card p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-foreground/40 uppercase">
                Yearly budget · {detail.budgetType}
              </p>
              <h1 className="mt-1 font-display text-4xl">{detail.budgetRef}</h1>
              <p className="mt-2 text-sm text-foreground/60">
                FY {detail.budgetYear} · Submitted {detail.date}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${tone}`}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              {detail.status}
            </span>
          </div>
        <div className="mt-6 space-y-4">
          <DetailField label="Submitted by" value={detail.createdByEmail} />
          <DetailField label="Department" value={detail.department || "—"} />
          {detail.rejectRemarks && (
            <DetailField
              label="Rejection remarks"
              value={detail.rejectRemarks}
            />
          )}

          <div className="space-y-2">
            <Label>{isCapex ? "Category" : "Code"}</Label>
            <Select value={code} onValueChange={setCode} disabled={saving}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Select code" />
              </SelectTrigger>
              <SelectContent>
                {codeOptions.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isCapex ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-item">Item</Label>
                <Input
                  id="edit-item"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  disabled={saving}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-justification">Justification</Label>
                <Textarea
                  id="edit-justification"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  disabled={saving}
                  className="min-h-20 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-target-months">Target months</Label>
                <Input
                  id="edit-target-months"
                  type="month"
                  value={targetMonths}
                  onChange={(e) => setTargetMonths(e.target.value)}
                  disabled={saving}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Quantity</Label>
                  <div className="flex h-11 items-center rounded-xl border border-foreground/10 bg-ivory px-4 tabular-nums">
                    {quantity}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Estimated cost per unit (RM)</Label>
                  <div className="flex h-11 items-center rounded-xl border border-foreground/10 bg-ivory px-4 tabular-nums">
                    {formatRm(unitValue)}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Estimated price</Label>
                <div className="flex h-11 items-center rounded-xl border border-foreground/10 bg-ivory px-4 font-display text-xl tabular-nums">
                  {formatRm(detail.amount)}
                </div>
                <div className="flex flex-col gap-2 rounded-xl bg-amber-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="flex min-w-0 items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
                    <p className="text-xs leading-relaxed text-amber-900/75">
                      Quantity and unit cost stay as they are here. To change
                      the amount, update the budget.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUpdateOpen(true)}
                    disabled={saving || updating || !canUpdateBudget}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-medium text-amber-950 transition hover:brightness-95 disabled:opacity-50"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Update amount
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-effect">
                  Effect if budget not approved
                </Label>
                <Textarea
                  id="edit-effect"
                  value={effectIfNotApproved}
                  onChange={(e) => setEffectIfNotApproved(e.target.value)}
                  disabled={saving}
                  className="min-h-20 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-alternative">
                  Alternative more cost-effective
                </Label>
                <Textarea
                  id="edit-alternative"
                  value={alternative}
                  onChange={(e) => setAlternative(e.target.value)}
                  disabled={saving}
                  className="min-h-20 rounded-xl"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-activity">
                  Activities / Programme / Event
                </Label>
                <Input
                  id="edit-activity"
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  disabled={saving}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-opex-months">Target months</Label>
                <Input
                  id="edit-opex-months"
                  type="month"
                  value={targetMonths}
                  onChange={(e) => setTargetMonths(e.target.value)}
                  disabled={saving}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-objective">Objectives</Label>
                <Textarea
                  id="edit-objective"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  disabled={saving}
                  className="min-h-20 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-opex-justification">Justifications</Label>
                <Textarea
                  id="edit-opex-justification"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  disabled={saving}
                  className="min-h-20 rounded-xl"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Items</Label>
                {detail.items.length > 0 ? (
                  <ul className="overflow-hidden rounded-xl border border-foreground/10">
                    {detail.items.map((item, index) => (
                      <li
                        key={item.id}
                        className="flex flex-col gap-2 border-b border-foreground/8 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <Input
                          value={opexItemNames[index] ?? ""}
                          onChange={(e) =>
                            setOpexItemNames((prev) =>
                              prev.map((name, i) =>
                                i === index ? e.target.value : name,
                              ),
                            )
                          }
                          placeholder={`Item ${index + 1}`}
                          disabled={saving}
                          className="h-10 rounded-lg"
                        />
                        <p className="shrink-0 text-sm text-foreground/55 tabular-nums">
                          {item.quantity} × {formatRm(item.costPerUnit)} ={" "}
                          {formatRm(item.amount)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex h-11 items-center rounded-xl border border-foreground/10 bg-ivory px-4 text-sm text-foreground/50">
                    No items on this request
                  </div>
                )}
                <div className="flex flex-col gap-2 rounded-xl bg-amber-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="flex min-w-0 items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
                    <p className="text-xs leading-relaxed text-amber-900/75">
                      You can rename items here. To change quantity or amount,
                      update the budget.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUpdateOpen(true)}
                    disabled={saving || updating || !canUpdateBudget}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-medium text-amber-950 transition hover:brightness-95 disabled:opacity-50"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Update amount
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>OPEX budget (RM)</Label>
                <div className="flex h-11 items-center rounded-xl border border-foreground/10 bg-ivory px-4 font-display text-xl tabular-nums">
                  {formatRm(detail.amount)}
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-remarks">Remarks</Label>
            <Input
              id="edit-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={saving}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-6">
            <button
              type="button"
              onClick={() => void handleResubmit()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-medium text-lime-foreground transition hover:brightness-95 disabled:opacity-50"
            >
              {saving
                ? isResubmit
                  ? "Resubmitting…"
                  : "Saving…"
                : isResubmit
                  ? "Resubmit"
                  : "Save changes"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-foreground/60 transition hover:bg-ivory hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
        </div>
      ) : (
        <>
          {detail.isMine && !formEnabled && (
            <div className="mb-4 rounded-[1.5rem] glass-card px-6 py-5 text-sm text-foreground/55">
              Yearly budget submissions are closed. You can still update
              amounts. Edit opens again when your admin reopens them.
            </div>
          )}

          <div className="overflow-hidden rounded-[1.5rem] glass-card">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
                        isCapex
                          ? "bg-amber-100 text-amber-800"
                          : "bg-sky-100 text-sky-800",
                      )}
                    >
                      {detail.budgetType}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${tone}`}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      {detail.status}
                    </span>
                  </div>
                  {(canEdit ||
                    canDelete ||
                    canTransfer ||
                    canUpdateBudget) && (
                    <TooltipProvider delayDuration={200}>
                      <div className="flex items-center gap-1.5">
                        {canEdit && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={startEdit}
                                disabled={deleting || transferring || updating}
                                aria-label="Edit form"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-800 transition hover:brightness-95 disabled:opacity-50"
                              >
                                <ClipboardPen className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              Edit form — change the budget details
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {canUpdateBudget && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => setUpdateOpen(true)}
                                disabled={deleting || transferring || updating}
                                aria-label="Update budget"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-lime/70 text-lime-foreground transition hover:brightness-95 disabled:opacity-50"
                              >
                                <Wallet className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              Update budget — change the approved amount
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {canTransfer && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => setTransferOpen(true)}
                                disabled={deleting || transferring}
                                aria-label="Transfer"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-800 transition hover:brightness-95 disabled:opacity-50"
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              Transfer — move this budget to another type
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => void handleDelete()}
                                disabled={deleting || transferring}
                                aria-label={
                                  confirmDelete
                                    ? isResubmit
                                      ? "Confirm remove"
                                      : "Confirm delete"
                                    : isResubmit
                                      ? "Remove"
                                      : "Delete"
                                }
                                className={cn(
                                  "inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:brightness-95 disabled:opacity-50",
                                  confirmDelete
                                    ? "bg-red-600 text-white"
                                    : "bg-red-100 text-red-600",
                                )}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              {deleting
                                ? isResubmit
                                  ? "Removing…"
                                  : "Deleting…"
                                : confirmDelete
                                  ? isResubmit
                                    ? "Click again to confirm remove"
                                    : "Click again to confirm delete"
                                  : isResubmit
                                    ? "Remove — discard this draft"
                                    : "Delete — remove this budget"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {canDelete && confirmDelete && !deleting && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(false)}
                                aria-label="Cancel"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5 text-foreground/60 transition hover:bg-ivory hover:text-foreground"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              Cancel — keep this budget
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
                  )}
                </div>
                <h1 className="mt-4 font-display text-4xl leading-tight">
                  {title}
                </h1>
                <p className="mt-2 text-sm text-foreground/55">
                  {detail.budgetRef} · Submitted {detail.date}
                </p>
                <p className="mt-1 text-sm text-foreground/55">
                  {detail.createdByEmail}
                </p>
              </div>
              <div
                className={cn(
                  "relative flex flex-col justify-end overflow-hidden p-6 md:p-8",
                  isCapex ? "bg-amber-100" : "bg-lime text-lime-foreground",
                )}
              >
                <Wallet
                  className={cn(
                    "absolute -right-3 -bottom-3 h-20 w-20 -rotate-12",
                    isCapex ? "text-amber-900/10" : "text-lime-foreground/15",
                  )}
                />
                <p
                  className={cn(
                    "text-xs font-medium tracking-wide uppercase",
                    isCapex ? "text-amber-800/70" : "text-lime-foreground/70",
                  )}
                >
                  {isCapex ? "CAPEX total" : "OPEX total"}
                </p>
                <p className="mt-2 font-display text-3xl tabular-nums md:text-4xl">
                  {formatRm(detail.amount)}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    isCapex ? "text-amber-800/70" : "text-lime-foreground/70",
                  )}
                >
                  FY {detail.budgetYear}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <MetaTile
              icon={isCapex ? ArrowUpRight : ArrowDownLeft}
              label={isCapex ? "Category" : "Code"}
              value={budgetCodeLabel(detail.code, detail.budgetType)}
            />
            <MetaTile
              icon={CalendarDays}
              label="Target months"
              value={formatTargetMonth(detail.targetMonths)}
            />
            <MetaTile
              icon={Building2}
              label="Department"
              value={detail.department || "—"}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
            <section className="rounded-[1.5rem] glass-card p-6 md:p-8">
              <h2 className="font-display text-xl">Request</h2>
              <div className="mt-5 space-y-5">
                {isCapex ? (
                  <>
                    <DetailBlock label="Item" value={detail.itemName || "—"} />
                    <DetailBlock
                      label="Justification"
                      value={detail.justification}
                    />
                    <DetailBlock
                      label="Effect if budget not approved"
                      value={detail.effectIfNotApproved || "—"}
                    />
                    <DetailBlock
                      label="Alternative more cost-effective"
                      value={detail.alternative || "—"}
                    />
                  </>
                ) : (
                  <>
                    <DetailBlock
                      label="Activities / Programme / Event"
                      value={detail.activity || "—"}
                    />
                    <DetailBlock
                      label="Objectives"
                      value={detail.objective || "—"}
                    />
                    <DetailBlock
                      label="Justifications"
                      value={detail.justification}
                    />
                  </>
                )}
                <DetailBlock label="Remarks" value={detail.remarks || "—"} />
                {detail.status === "Rejected" && detail.rejectRemarks && (
                  <DetailBlock
                    label="Rejection remarks"
                    value={detail.rejectRemarks}
                  />
                )}
              </div>
            </section>

            <section className="rounded-[1.5rem] glass-card p-6 md:p-8">
              <h2 className="font-display text-xl">
                {isCapex ? "Estimate" : "Items"}
              </h2>
              {isCapex ? (
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-foreground/50">Quantity</dt>
                    <dd className="tabular-nums">
                      {detail.quantity == null ? "—" : detail.quantity}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-foreground/50">Cost per unit</dt>
                    <dd className="tabular-nums">
                      {detail.costPerUnit == null
                        ? "—"
                        : formatRm(detail.costPerUnit)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-foreground/10 pt-3 font-medium">
                    <dt>Estimated price</dt>
                    <dd className="tabular-nums">{formatRm(detail.amount)}</dd>
                  </div>
                </dl>
              ) : detail.items.length > 0 ? (
                <div className="mt-5">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-4 border-b border-foreground/10 pb-2 text-[11px] font-medium tracking-wide text-foreground/45 uppercase">
                    <span>Item</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Each</span>
                    <span className="text-right">Total</span>
                  </div>
                  <ul>
                    {detail.items.map((item) => (
                      <li
                        key={item.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-baseline gap-x-4 border-b border-foreground/8 py-3 text-sm last:border-b-0"
                      >
                        <span className="min-w-0 truncate font-medium">
                          {item.itemName || "Untitled item"}
                        </span>
                        <span className="tabular-nums text-foreground/70">
                          {item.quantity}
                        </span>
                        <span className="tabular-nums text-foreground/70">
                          {formatRm(item.costPerUnit)}
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatRm(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1 flex items-center justify-between gap-4 border-t border-foreground/10 pt-3 text-sm font-medium">
                    <span>Items total</span>
                    <span className="tabular-nums">
                      {formatRm(
                        detail.items.reduce((sum, item) => sum + item.amount, 0),
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-foreground/50">
                  No line items on this request.
                </p>
              )}
            </section>
          </div>

          <section className="mt-4 rounded-[1.5rem] glass-card p-6 md:p-8">
            <h2 className="font-display text-xl">Request log</h2>
            <div className="mt-4">
              <BudgetLogList
                logs={logs}
                loading={logsLoading}
                compact
                emptyMessage="No edits, transfers, or amount updates on this request yet."
              />
            </div>
          </section>
        </>
      )}

      {transferOpen &&
        createPortal(
          <DetailOverlay onClose={closeTransfer}>
            <TransferBudgetCard
              detail={detail}
              transferring={transferring}
              onClose={closeTransfer}
              onTransfer={(payload) => void handleTransfer(payload)}
            />
          </DetailOverlay>,
          document.body,
        )}

      {updateOpen &&
        createPortal(
          <DetailOverlay onClose={closeUpdate}>
            <UpdateApprovedBudgetForm
              budgetId={detail.id}
              budgetRef={detail.budgetRef}
              budgetType={detail.budgetType}
              amount={detail.amount}
              quantity={detail.quantity}
              costPerUnit={detail.costPerUnit}
              items={detail.items}
              saving={updating}
              onClose={closeUpdate}
              onSave={(payload) => void handleUpdateBudget(payload)}
            />
          </DetailOverlay>,
          document.body,
        )}
    </div>
  );
}

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
      budgetAmount: number;
      remarks?: string;
    };

function TransferBudgetCard({
  detail,
  transferring,
  onClose,
  onTransfer,
}: {
  detail: BudgetDetail;
  transferring: boolean;
  onClose: () => void;
  onTransfer: (payload: TransferBudgetInput) => void;
}) {
  const targetType = detail.budgetType === "OPEX" ? "CAPEX" : "OPEX";
  const sourceType = detail.budgetType;

  const [capexCode, setCapexCode] = useState<
    (typeof CAPEX_CODES)[number]["value"] | ""
  >("");
  const [opexCode, setOpexCode] = useState<
    (typeof OPEX_CODES)[number]["value"] | ""
  >("");
  const [itemName, setItemName] = useState(detail.activity ?? "");
  const [activity, setActivity] = useState(detail.itemName ?? "");
  const [objective, setObjective] = useState(detail.objective ?? "");
  const [justification, setJustification] = useState(detail.justification);
  const [targetMonths, setTargetMonths] = useState(detail.targetMonths ?? "");
  const [quantity, setQuantity] = useState(1);
  const [costPerUnit, setCostPerUnit] = useState(
    detail.amount > 0 ? String(detail.amount) : "",
  );
  const [budgetAmount, setBudgetAmount] = useState(
    detail.amount > 0 ? String(detail.amount) : "",
  );
  const [effectIfNotApproved, setEffectIfNotApproved] = useState("");
  const [alternative, setAlternative] = useState("");
  const [remarks, setRemarks] = useState(detail.remarks ?? "");

  const unitValue = Number(costPerUnit) || 0;
  const estimatedPrice = quantity * unitValue;
  const opexBudgetValue = Number(budgetAmount) || 0;

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
    if (opexBudgetValue <= 0) {
      toast.error("Enter a budget amount above zero.");
      return;
    }
    onTransfer({
      targetType: "OPEX",
      code: opexCode,
      activity: activity.trim(),
      objective: objective.trim(),
      justification: justification.trim(),
      targetMonths: targetMonths || undefined,
      budgetAmount: opexBudgetValue,
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
            From {sourceType} · {formatRm(detail.amount)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={transferring}
          aria-label="Close transfer form"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/50 transition hover:bg-ivory hover:text-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-ivory p-4">
        <p className="text-xs text-foreground/50">
          Current {sourceType} {sourceType === "OPEX" ? "activity" : "item"}
        </p>
        <p className="mt-1 text-sm font-medium">
          {sourceType === "OPEX"
            ? detail.activity || "—"
            : detail.itemName || "—"}
        </p>
        <p className="mt-0.5 text-xs text-foreground/50">
          {budgetCodeLabel(detail.code, sourceType)}
        </p>
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
                disabled={transferring}
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
                disabled={transferring}
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
                disabled={transferring}
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
                disabled={transferring}
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
                  disabled={transferring}
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
                  disabled={transferring}
                  className="h-11 rounded-xl tabular-nums"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-ivory px-4 py-3">
              <p className="text-xs text-foreground/50">Estimated price</p>
              <p className="mt-1 font-display text-2xl tabular-nums">
                {formatRm(estimatedPrice)}
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
                disabled={transferring}
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
                disabled={transferring}
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
                disabled={transferring}
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
                disabled={transferring}
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
                disabled={transferring}
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
                disabled={transferring}
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
                disabled={transferring}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`transfer-budget-${detail.id}`}>
                OPEX budget (RM)
              </Label>
              <Input
                id={`transfer-budget-${detail.id}`}
                inputMode="decimal"
                value={budgetAmount}
                onChange={(e) =>
                  setBudgetAmount(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder="0.00"
                disabled={transferring}
                className="h-11 rounded-xl tabular-nums"
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
            disabled={transferring}
            className="h-11 rounded-xl"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2.5 border-t border-foreground/10 pt-6">
        <button
          type="button"
          onClick={submitTransfer}
          disabled={transferring}
          className="group inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-md disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </span>
          {transferring
            ? "Transferring…"
            : `Confirm transfer to ${targetType}`}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={transferring}
          className="rounded-full px-4 py-2.5 text-sm text-foreground/50 transition hover:bg-ivory hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const OPEX_CODES = [
  {
    value: "926-0000",
    label: "926-0000 LEASE LINE FOR IT SYSTEM (926-000/23121)",
  },
  {
    value: "916-0000",
    label: "916-0000 EQUIP. RENTAL (916-000/24501) - Photocopy machine include SST 8%",
  },
  {
    value: "918-0001",
    label: "918-0001 RENTAL - LAPTOP/PC (918-0001/24602)",
  },
  {
    value: "999-1003",
    label: "999-1003 PRINTING EXP-METER READING (999-1003/27101)",
  },
  {
    value: "992-0000",
    label: "992-0000 IT & AUDIO VISUAL - EXPENSES (992-000/27809)",
  },
  {
    value: "923-0000",
    label: "923-0000 IT & AUDIO-REPAIR & MAINTENANCE (923-000/28503)",
  },
  {
    value: "945-0000",
    label: "945-0000 PROFESSIONAL FEES (945-000/29106)",
  },
] as const;

const CAPEX_CODES = [
  { value: "200-1100", label: "200-1100 : RENOVATION" },
  { value: "200-1000", label: "200-1000 : OFFICE EQUIPMENT" },
  { value: "200-0500", label: "200-0500 : IT & AUDIO VISUAL" },
] as const;

function formatTargetMonth(value: string | null) {
  if (!value) return "—";
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function budgetCodeLabel(code: string, budgetType: "OPEX" | "CAPEX") {
  const labels: Record<string, string> =
    budgetType === "CAPEX"
      ? {
          "200-1100": "200-1100 : Renovation",
          "200-1000": "200-1000 : Office equipment",
          "200-0500": "200-0500 : IT & audio visual",
        }
      : {
          "926-0000": "926-0000 Lease line for IT system",
          "916-0000": "916-0000 Equip. rental",
          "918-0001": "918-0001 Rental - laptop/PC",
          "999-1003": "999-1003 Printing exp-meter reading",
          "992-0000": "992-0000 IT & audio visual - expenses",
          "923-0000": "923-0000 IT & audio-repair & maintenance",
        };
  return labels[code] ?? code;
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-wide text-foreground/40 uppercase">
        {label}
      </p>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
        {value}
      </p>
    </div>
  );
}

function MetaTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.5rem] glass-card p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-lime-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-xs text-foreground/50">{label}</p>
      </div>
      <p className="mt-3 text-sm font-medium leading-snug">{value}</p>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-foreground/40 uppercase">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">
        {value}
      </dd>
    </div>
  );
}
