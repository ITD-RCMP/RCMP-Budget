import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Receipt,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getFinanceBillingPdf,
  listFinanceBillings,
  type FinanceBilling,
} from "@backend/server-functions/billing-fns";
import { FinanceLayout } from "./sidebar";

const billingsKey = ["finance-billings"] as const;
const PAGE_SIZE = 5;

const filterField =
  "h-11 rounded-2xl border-foreground/10 bg-ivory/70 px-3.5 text-sm shadow-none focus-visible:ring-foreground/15";

const actionButton =
  "inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 text-xs text-foreground/70 transition hover:bg-ivory disabled:opacity-50";

function pageItems(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "…", total] as const;
  if (current >= total - 2) return [1, "…", total - 2, total - 1, total] as const;
  return [1, "…", current, "…", total] as const;
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatAmount(value: number) {
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function departmentTotalLabel(month: string) {
  if (month === currentMonth()) return "Department total (this month)";
  const [year, monthIndex] = month.split("-");
  const name = new Date(Number(year), Number(monthIndex) - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
  return `Department total (${name})`;
}

function pdfObjectUrl(data: string, fileName: string) {
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  return URL.createObjectURL(new File([bytes], fileName, { type: "application/pdf" }));
}

function FilterField({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <span className="flex h-4 items-center justify-between px-1 text-xs text-foreground/45">
        <span>{label}</span>
        {action}
      </span>
      {children}
    </div>
  );
}

function LedgerAmount({ value }: { value: number | null }) {
  if (value == null) return <span className="font-normal text-foreground/35">—</span>;
  return formatAmount(value);
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lime text-lime-foreground">
        <Receipt className="h-5 w-5" />
      </span>
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-1 text-sm text-foreground/60">{body}</p>
    </div>
  );
}

export function FinanceBillingPage() {
  const [month, setMonth] = useState(currentMonth);
  const [date, setDate] = useState("");
  const [supplier, setSupplier] = useState("");
  const [department, setDepartment] = useState("All");
  const [rowPage, setRowPage] = useState<Record<string, number>>({});
  const [maximized, setMaximized] = useState(false);
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);

  const billings = useQuery({
    queryKey: billingsKey,
    queryFn: () => listFinanceBillings(),
  });

  const closePreview = () => {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  useEffect(() => {
    if (!preview && !maximized) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (preview) closePreview();
      else setMaximized(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, maximized]);

  const viewPdf = useMutation({
    mutationFn: (billingId: number) => getFinanceBillingPdf({ data: { billingId } }),
    onSuccess: (result) => {
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return {
          title: result.fileName.replace(/\.pdf$/i, ""),
          url: pdfObjectUrl(result.data, result.fileName),
        };
      });
    },
    onError: (error) => toast.error(errorText(error, "Could not open the PDF. Please try again.")),
  });

  const departments = useMemo(() => {
    const names = new Set((billings.data ?? []).map((row) => row.departmentName));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [billings.data]);

  const visible = useMemo(() => {
    const term = supplier.trim().toLowerCase();
    return (billings.data ?? []).filter(
      (row) =>
        (department === "All" || row.departmentName === department) &&
        (!month || row.invoiceMonth === month) &&
        (!date || row.invoiceDate === date) &&
        (!term ||
          row.supplier.toLowerCase().includes(term) ||
          row.invoiceRef.toLowerCase().includes(term) ||
          row.createdBy.toLowerCase().includes(term)),
    );
  }, [billings.data, department, month, date, supplier]);

  const groups = useMemo(() => {
    const grouped = new Map<string, FinanceBilling[]>();
    for (const row of visible) {
      const list = grouped.get(row.departmentName) ?? [];
      list.push(row);
      grouped.set(row.departmentName, list);
    }
    return [...grouped.entries()];
  }, [visible]);

  const hasFilters = Boolean(date || supplier || department !== "All" || month !== currentMonth());

  useEffect(() => {
    setRowPage({});
  }, [month, date, supplier, department]);

  return (
    <FinanceLayout>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Billing</h1>
        <p className="mt-2 text-sm text-foreground/60">Invoices submitted by each department.</p>
      </div>

      <div
        className={cn(
          "mt-6 rounded-[1.25rem] p-4 sm:mt-8 sm:rounded-[1.5rem] sm:p-6 md:p-8",
          maximized
            ? "fixed inset-0 z-40 mt-0 flex h-dvh w-screen flex-col overflow-hidden rounded-none bg-background"
            : "glass-card",
        )}
      >
        <div className="flex items-end gap-3">
        <div className="grid min-w-0 flex-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[14rem_12rem_14rem_minmax(0,1fr)]">
          <FilterField label="Month">
            <div className="relative">
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value || currentMonth())}
                aria-label="Month"
                className={filterField}
              />
            </div>
          </FilterField>
          <FilterField label="Date">
            <div className="relative">
              {date === "" && (
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-foreground/40">
                  Any date
                </span>
              )}
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Date"
                className={`${filterField} ${date === "" ? "[&::-webkit-datetime-edit]:text-transparent" : ""}`}
              />
            </div>
          </FilterField>
          <FilterField label="Department">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              aria-label="Department"
              className={`${filterField} w-full`}
            >
              <option value="All">All departments</option>
              {departments.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField
            label="Search"
            action={
              hasFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setMonth(currentMonth());
                    setDate("");
                    setSupplier("");
                    setDepartment("All");
                  }}
                  className="text-xs text-foreground/45 transition hover:text-foreground"
                >
                  Clear
                </button>
              ) : null
            }
          >
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-foreground/35" />
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Supplier, ref, or email"
                aria-label="Search"
                className="h-11 rounded-2xl border-foreground/10 bg-ivory/70 pr-3.5 pl-10 text-sm shadow-none focus-visible:ring-foreground/15"
              />
            </div>
          </FilterField>
        </div>
          <button
            type="button"
            onClick={() => setMaximized((value) => !value)}
            aria-label={maximized ? "Exit fullscreen" : "Maximize screen"}
            title={maximized ? "Exit fullscreen" : "Maximize screen"}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-foreground/10 bg-ivory/70 text-foreground/55 transition hover:bg-ivory hover:text-foreground"
          >
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>

        <div className={cn("mt-6", maximized && "min-h-0 flex-1 overflow-auto")}>
          {billings.isPending ? (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-foreground/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading bills…
            </p>
          ) : billings.isError ? (
            <EmptyState
              title="Could not load bills"
              body="Refresh the page and try again."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No bills match your filters" : "No bills yet"}
              body={
                hasFilters
                  ? "Change or clear the filters to see more."
                  : "Invoices from departments will show here."
              }
            />
          ) : (
            <div className="space-y-8">
              {groups.map(([name, rows]) => {
                const groupAmounts = rows.filter((row) => row.totalInvoice != null);
                const groupTotal = groupAmounts.reduce(
                  (sum, row) => sum + (row.totalInvoice ?? 0),
                  0,
                );
                return (
                  <section key={name}>
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <h2 className="text-lg font-medium [font-family:ui-sans-serif,system-ui,sans-serif]">
                        {name}
                      </h2>
                      <p className="text-xs text-foreground/45">
                        {rows.length} invoice{rows.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <DepartmentLedger
                      rows={rows}
                      page={rowPage[name] ?? 1}
                      onPage={(next) => setRowPage((current) => ({ ...current, [name]: next }))}
                      total={groupAmounts.length === 0 ? null : groupTotal}
                      totalLabel={departmentTotalLabel(month)}
                      pdfPending={viewPdf.isPending}
                      onPdf={(id) => viewPdf.mutate(id)}
                    />
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-0 sm:p-4 md:p-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={preview.title}
            className="flex h-dvh w-full max-w-4xl flex-col gap-3 bg-background p-4 sm:h-full sm:max-h-[90vh] sm:rounded-[1.5rem]"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="truncate font-display text-2xl">{preview.title}</h2>
              <button
                type="button"
                onClick={closePreview}
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/60 transition hover:bg-ivory hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <iframe
              title={preview.title}
              src={preview.url}
              className="min-h-0 w-full flex-1 rounded-[1rem] bg-white"
            />
          </div>
        </div>
      ) : null}
    </FinanceLayout>
  );
}

function DepartmentLedger({
  rows,
  page,
  onPage,
  total,
  totalLabel,
  pdfPending,
  onPdf,
}: {
  rows: FinanceBilling[];
  page: number;
  onPage: (page: number) => void;
  total: number | null;
  totalLabel: string;
  pdfPending: boolean;
  onPdf: (billingId: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="mt-3">
      <div className="sm:hidden">
        <ul>
          {paged.map((row) => (
            <li key={row.id} className="border-b border-foreground/10 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-foreground/45">{formatDate(row.invoiceDate)}</p>
                  <p className="font-medium">{row.invoiceRef}</p>
                </div>
                <p className="text-right font-medium tabular-nums whitespace-nowrap">
                  <LedgerAmount value={row.totalInvoice} />
                </p>
              </div>
              <InvoiceDetails row={row} pdfPending={pdfPending} onPdf={() => onPdf(row.id)} />
            </li>
          ))}
        </ul>
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-[3px] border-double border-foreground/30 text-left text-[11px] font-medium tracking-[0.14em] text-foreground/45 uppercase">
              <th className="w-28 px-2 py-2.5 font-medium">Date</th>
              <th className="w-32 px-2 py-2.5 font-medium">Ref</th>
              <th className="px-2 py-2.5 font-medium">Particulars</th>
              <th className="w-28 px-2 py-2.5 text-right font-medium">Invoice (RM)</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr key={row.id} className="border-b border-foreground/10 align-top">
                <td className="px-2 py-3 whitespace-nowrap text-foreground/80">
                  {formatDate(row.invoiceDate)}
                </td>
                <td className="px-2 py-3 whitespace-nowrap font-medium">{row.invoiceRef}</td>
                <td className="px-2 py-3">
                  <InvoiceDetails row={row} pdfPending={pdfPending} onPdf={() => onPdf(row.id)} />
                </td>
                <td className="px-2 py-3 text-right font-medium tabular-nums whitespace-nowrap">
                  <LedgerAmount value={row.totalInvoice} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-foreground/15">
              <td colSpan={3} className="px-2 py-3 text-xs tracking-[0.12em] text-foreground/45 uppercase">
                {totalLabel}
              </td>
              <td className="px-2 py-3 text-right font-medium tabular-nums whitespace-nowrap">
                <LedgerAmount value={total} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <TablePager
        total={rows.length}
        page={currentPage}
        pageCount={pageCount}
        onPage={onPage}
      />
    </div>
  );
}

function TablePager({
  total,
  page,
  pageCount,
  onPage,
}: {
  total: number;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-foreground/45">
        {total} bill{total === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-foreground/60 transition hover:bg-ivory disabled:opacity-40 sm:px-3"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>
        {pageItems(page, pageCount).map((item, index) =>
          item === "…" ? (
            <span key={`ellipsis-${index}`} className="px-2 text-sm text-foreground/35">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPage(item)}
              className={
                item === page
                  ? "h-8 w-8 rounded-full bg-foreground text-sm text-background transition"
                  : "h-8 w-8 rounded-full text-sm text-foreground/60 transition hover:bg-ivory"
              }
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPage(Math.min(pageCount, page + 1))}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-foreground/60 transition hover:bg-ivory disabled:opacity-40 sm:px-3"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function InvoiceDetails({
  row,
  pdfPending,
  onPdf,
}: {
  row: FinanceBilling;
  pdfPending: boolean;
  onPdf: () => void;
}) {
  return (
    <>
      <p className="mt-2 font-medium sm:mt-0">{row.supplier}</p>
      <p className="mt-1 text-xs leading-5 break-words text-foreground/55">
        Submitted by {row.createdBy}
      </p>
      <button
        type="button"
        disabled={!row.hasPdf || pdfPending}
        onClick={onPdf}
        className={`${actionButton} mt-2`}
      >
        <FileText className="h-3.5 w-3.5" />
        PDF
      </button>
    </>
  );
}
