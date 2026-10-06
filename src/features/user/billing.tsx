import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Mail,
  Receipt,
  Search,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Sidebar } from "./sidebar";
import { InvoiceScanner } from "./invoiceScanner";
import { BillingEmailDialog } from "./billingEmailDialog";
import { Input } from "@/components/ui/input";
import {
  getBillingPdf,
  listBillings,
  type Billing,
} from "@backend/server-functions/billing-fns";

const billingsKey = ["billings"] as const;
const PAGE_SIZE = 5;

function pageItems(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "…", total] as const;
  if (current >= total - 2) return [1, "…", total - 2, total - 1, total] as const;
  return [1, "…", current, "…", total] as const;
}

const actionButton =
  "inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 text-xs text-foreground/70 transition hover:bg-ivory disabled:opacity-50";

const filterField =
  "h-11 rounded-2xl border-foreground/10 bg-ivory/70 px-3.5 text-sm shadow-none focus-visible:ring-foreground/15 [&::-webkit-calendar-picker-indicator]:opacity-40";

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pdfObjectUrl(data: string, fileName: string) {
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  return URL.createObjectURL(new File([bytes], fileName, { type: "application/pdf" }));
}

export function BillingPage() {
  const queryClient = useQueryClient();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [emailBilling, setEmailBilling] = useState<Billing | null>(null);
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);
  const [month, setMonth] = useState("");
  const [date, setDate] = useState("");
  const [supplier, setSupplier] = useState("");
  const [page, setPage] = useState(1);

  const billings = useQuery({ queryKey: billingsKey, queryFn: () => listBillings() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: billingsKey });

  const closePreview = () => {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const viewPdf = useMutation({
    mutationFn: (billingId: number) => getBillingPdf({ data: { billingId } }),
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

  const visible = useMemo(() => {
    const term = supplier.trim().toLowerCase();
    return (billings.data ?? []).filter(
      (row) =>
        (!month || row.invoiceMonth === month) &&
        (!date || row.invoiceDate === date) &&
        (!term || row.supplier.toLowerCase().includes(term)),
    );
  }, [billings.data, month, date, supplier]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = Boolean(month || date || supplier);

  useEffect(() => {
    setPage(1);
  }, [month, date, supplier]);

  return (
    <div className="flex h-screen flex-col overflow-hidden app-canvas text-foreground md:flex-row">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8 md:p-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">Billing</h1>
            <p className="mt-2 text-sm text-foreground/60">
              Invoices and payment requests for your department.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-medium text-lime-foreground transition hover:brightness-95"
          >
            <Camera className="h-4 w-4" />
            Add invoice
          </button>
        </div>

        <div className="mt-8 rounded-[1.5rem] glass-card p-6 md:p-8">
          <div className="grid items-end gap-3 sm:grid-cols-[14rem_12rem_minmax(0,1fr)]">
            <FilterField label="Month">
              <div className="relative">
                {month === "" && (
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-foreground/40">
                    Any month
                  </span>
                )}
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  aria-label="Month"
                  className={`${filterField} ${month === "" ? "[&::-webkit-datetime-edit]:text-transparent" : ""}`}
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
            <FilterField
              label="Supplier"
              action={
                hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMonth("");
                      setDate("");
                      setSupplier("");
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
                  placeholder="Search"
                  aria-label="Supplier"
                  className={`${filterField} pl-10`}
                />
              </div>
            </FilterField>
          </div>

          <div className="mt-6">
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
                    : "Tap Add invoice to scan your first bill."
                }
              />
            ) : (
              <ul className="grid gap-3">
                {paged.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-4 rounded-[1.25rem] bg-ivory/60 p-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground/45">{row.invoiceRef}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{row.supplier}</p>
                        <BillingStatusTag complete={Boolean(row.acknowledgedAt)} />
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <BillingFact icon={Calendar} label="Invoice date" value={formatDate(row.invoiceDate)} />
                        <BillingFact icon={UserRound} label="Upload by" value={row.createdBy} />
                        <BillingFact
                          icon={Mail}
                          label="Emailed"
                          value={
                            row.emailSentAt
                              ? `${row.emailTo.join(", ")} · ${formatDateTime(row.emailSentAt)}`
                              : "Not yet"
                          }
                          pending={!row.emailSentAt}
                        />
                        <BillingFact
                          icon={CheckCircle2}
                          label="Acknowledged"
                          value={
                            row.acknowledgedAt
                              ? `${row.acknowledgedName} · ${formatDateTime(row.acknowledgedAt)}`
                              : "Not yet"
                          }
                          pending={!row.acknowledgedAt}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!row.hasPdf || !row.acknowledgedAt || viewPdf.isPending}
                        title={row.acknowledgedAt ? undefined : "Acknowledge this invoice first."}
                        onClick={() => viewPdf.mutate(row.id)}
                        className={actionButton}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        PDF
                      </button>
                      <button
                        type="button"
                        disabled={!row.hasPdf || !row.acknowledgedAt}
                        title={row.acknowledgedAt ? undefined : "Acknowledge this invoice first."}
                        onClick={() => setEmailBilling(row)}
                        className={actionButton}
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {row.emailSentAt ? "Resend" : "Send email"}
                      </button>
                      {!row.acknowledgedAt && (
                        <Link
                          to="/user/billing/$billingId"
                          params={{ billingId: String(row.id) }}
                          className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1.5 text-xs font-medium text-lime-foreground transition hover:brightness-95"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Acknowledge
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {visible.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-foreground/45">
                  {visible.length} bill{visible.length === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-foreground/60 transition hover:bg-ivory disabled:opacity-40 sm:px-3"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>
                  {pageItems(currentPage, pageCount).map((item, index) =>
                    item === "…" ? (
                      <span key={`ellipsis-${index}`} className="px-2 text-sm text-foreground/35">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item)}
                        className={
                          item === currentPage
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
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-foreground/60 transition hover:bg-ivory disabled:opacity-40 sm:px-3"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <InvoiceScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onSaved={() => void refresh()}
      />
      <BillingEmailDialog billing={emailBilling} onClose={() => setEmailBilling(null)} />
      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 md:p-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={preview.title}
            className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col gap-3 rounded-[1.5rem] bg-background p-4"
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
    </div>
  );
}

function BillingFact({
  icon: Icon,
  label,
  value,
  pending,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  pending?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-foreground/45">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] leading-4 text-foreground/40">{label}</span>
        <span
          className={
            pending
              ? "block text-xs leading-5 break-words text-foreground/45"
              : "block text-xs leading-5 break-words text-foreground/80"
          }
        >
          {value}
        </span>
      </span>
    </div>
  );
}

function BillingStatusTag({ complete }: { complete: boolean }) {
  return (
    <span
      className={
        complete
          ? "inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
          : "inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
      }
    >
      {complete ? "Complete" : "Not complete"}
    </span>
  );
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
