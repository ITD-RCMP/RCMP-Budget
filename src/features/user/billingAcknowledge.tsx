import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sidebar as UserSidebar } from "./sidebar";
import { Sidebar as HodSidebar } from "@/features/hod/sidebar";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@backend/server-functions/auth-fns";
import {
  receivedStampDate,
  receivedStampDepartment,
  stampReceivedPdf,
} from "@/lib/received-stamp";
import {
  acknowledgeBilling,
  getBilling,
  getBillingPdf,
} from "@backend/server-functions/billing-fns";

function pdfBytes(data: string) {
  return Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
}

export function BillingAcknowledgePage({
  billingId,
  area = "user",
}: {
  billingId: number;
  area?: "user" | "hod";
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ticked, setTicked] = useState(false);
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);

  const billing = useQuery({
    queryKey: ["billing", billingId],
    queryFn: () => getBilling({ data: { billingId } }),
    enabled: Number.isFinite(billingId) && billingId > 0,
  });

  const pdf = useQuery({
    queryKey: ["billing-pdf", billingId],
    queryFn: () => getBillingPdf({ data: { billingId } }),
    enabled: billing.isSuccess && billing.data.hasPdf,
  });

  const currentUser = useQuery({
    queryKey: ["current-user"],
    queryFn: () => getCurrentUser(),
  });

  useEffect(() => {
    if (!pdf.data || !billing.data || currentUser.isPending) return;
    let url: string | null = null;
    let cancelled = false;
    setPdfFailed(false);

    const open = async () => {
      let bytes = pdfBytes(pdf.data.data);
      if (!billing.data.acknowledgedAt) {
        const staff = currentUser.data?.fullName || currentUser.data?.email || "Staff";
        bytes = await stampReceivedPdf(bytes, {
          staffName: staff,
          receivedOn: receivedStampDate(),
          department: receivedStampDepartment,
        });
      }
      if (cancelled) return;
      url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      setPdfSrc(url);
    };

    void open().catch(() => {
      if (!cancelled) {
        setPdfSrc(null);
        setPdfFailed(true);
      }
    });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [pdf.data, billing.data, currentUser.isPending, currentUser.data]);

  useEffect(() => {
    if (!billing.isError) return;
    toast.error(
      billing.error instanceof Error
        ? billing.error.message
        : "This bill was not found. Go back and try again.",
    );
    void navigate({ to: area === "hod" ? "/hod/billing" : "/user/billing" });
  }, [area, billing.isError, billing.error, navigate]);

  const submit = useMutation({
    mutationFn: () =>
      acknowledgeBilling({
        data: { billingId, confirmed: ticked },
      }),
    onSuccess: () => {
      toast.success("Bill acknowledged.");
      void queryClient.invalidateQueries({ queryKey: ["billings"] });
      void navigate({ to: area === "hod" ? "/hod/billing" : "/user/billing" });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not acknowledge this bill. Please try again.",
      ),
  });

  const bill = billing.data;

  return (
    <div className="flex h-dvh flex-col overflow-hidden app-canvas text-foreground md:flex-row">
      {area === "hod" ? <HodSidebar /> : <UserSidebar />}
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-4 px-4 pt-4 sm:px-8 sm:pt-8 md:px-12">
          <div className="min-w-0">
            <Link
              to={area === "hod" ? "/hod/billing" : "/user/billing"}
              className="inline-flex items-center gap-2 text-sm text-foreground/55 transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Billing
            </Link>
            <h1 className="mt-3 truncate font-display text-3xl sm:text-4xl">
              {bill?.invoiceRef ?? "Invoice"}
            </h1>
            {bill && (
              <p className="mt-1 text-sm text-foreground/60">
                {bill.supplier}
                {bill.acknowledgedAt
                  ? ` · Acknowledged by ${bill.acknowledgedName}`
                  : " · Read the invoice, then confirm below."}
              </p>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 px-4 py-4 sm:px-8 sm:py-6 md:px-12">
          {pdf.isPending || billing.isPending || currentUser.isPending || (!pdfSrc && !pdfFailed && !pdf.isError) ? (
            <p className="flex h-full items-center justify-center gap-2 text-sm text-foreground/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Opening the invoice…
            </p>
          ) : pdf.isError || pdfFailed || !pdfSrc ? (
            <p className="flex h-full items-center justify-center text-sm text-foreground/60">
              This invoice could not be opened. Go back and try again.
            </p>
          ) : (
            <iframe
              title={bill?.invoiceRef ?? "Invoice PDF"}
              src={pdfSrc}
              className="h-full w-full rounded-[1.25rem] bg-white"
            />
          )}
        </div>

        {bill && !bill.acknowledgedAt && (
          <form
            className="px-4 pb-4 sm:px-8 sm:pb-8 md:px-12"
            onSubmit={(event) => {
              event.preventDefault();
              if (!ticked || submit.isPending) return;
              submit.mutate();
            }}
          >
            <div className="flex flex-col gap-3 rounded-[1.25rem] bg-ivory/70 p-3 sm:flex-row sm:items-center sm:rounded-full sm:py-1.5 sm:pr-1.5 sm:pl-4">
              <button
                type="button"
                aria-pressed={ticked}
                onClick={() => setTicked((value) => !value)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left text-sm text-foreground/70"
              >
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition",
                    ticked
                      ? "border-transparent bg-lime text-lime-foreground"
                      : "border-foreground/20",
                  )}
                >
                  {ticked && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                I acknowledge this invoice.
              </button>
              <button
                type="submit"
                disabled={!ticked || submit.isPending}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-lime px-5 text-sm font-medium text-lime-foreground transition hover:brightness-95 disabled:opacity-50 sm:h-9 sm:w-auto"
              >
                {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
