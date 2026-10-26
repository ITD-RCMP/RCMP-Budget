import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sidebar as UserSidebar } from "./sidebar";
import { Sidebar as HodSidebar } from "@/features/hod/sidebar";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@backend/server-functions/auth-fns";
import {
  DEFAULT_STAMP_POSITION,
  receivedStampDate,
  receivedStampDepartment,
  stampReceivedPdf,
  type StampPosition,
} from "@/lib/received-stamp";
import {
  acknowledgeBilling,
  getBilling,
  getBillingPdf,
} from "@backend/server-functions/billing-fns";

function pdfBytes(data: string) {
  return Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
}

const STAMP_PRESETS: { label: string; position: StampPosition }[] = [
  { label: "Top left", position: { x: 0, y: 1 } },
  { label: "Top right", position: { x: 1, y: 1 } },
  { label: "Bottom left", position: { x: 0, y: 0 } },
  { label: "Bottom right", position: { x: 1, y: 0 } },
];

// Approximates the real stamp's footprint (see src/lib/received-stamp.ts) so the
// preview box lines up with where the stamp will actually land on the PDF.
const STAMP_PREVIEW_WIDTH_PCT = 40;
const STAMP_PREVIEW_HEIGHT_PCT = 20;

function StampPositionPicker({
  value,
  onChange,
}: {
  value: StampPosition;
  onChange: (position: StampPosition) => void;
}) {
  const padRef = useRef<HTMLDivElement>(null);

  const moveTo = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height));
    onChange({ x, y });
  };

  const isPreset = (preset: StampPosition) =>
    Math.abs(preset.x - value.x) < 0.01 && Math.abs(preset.y - value.y) < 0.01;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-foreground">Stamp position</p>
        <p className="mt-0.5 text-xs leading-snug text-foreground/60">
          Choose where the red "RECEIVED" stamp appears on the invoice. Pick a corner or drag the
          outline below — the preview on the left updates right away.
        </p>
      </div>

      <div
        ref={padRef}
        role="slider"
        aria-label="Stamp position on the page"
        aria-valuetext={`${Math.round(value.x * 100)}% across, ${Math.round(value.y * 100)}% up`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          moveTo(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) return;
          moveTo(event.clientX, event.clientY);
        }}
        className="relative mx-auto aspect-[1/1.414] w-full max-w-48 cursor-crosshair touch-none rounded-sm border border-foreground/20 bg-white shadow-sm"
      >
        <div
          className="absolute flex items-center justify-center rounded-[2px] border-2 border-dashed border-rose-500/70 bg-rose-500/10"
          style={{
            width: `${STAMP_PREVIEW_WIDTH_PCT}%`,
            height: `${STAMP_PREVIEW_HEIGHT_PCT}%`,
            left: `${value.x * (100 - STAMP_PREVIEW_WIDTH_PCT)}%`,
            bottom: `${value.y * (100 - STAMP_PREVIEW_HEIGHT_PCT)}%`,
          }}
        >
          <span className="text-[6px] font-bold tracking-wide text-rose-600 sm:text-[7px]">
            RECEIVED
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {STAMP_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.position)}
            aria-pressed={isPreset(preset.position)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-xs font-medium transition",
              isPreset(preset.position)
                ? "border-transparent bg-lime text-lime-foreground"
                : "border-foreground/15 text-foreground/70 hover:border-foreground/30",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-foreground/50">
        Custom: {Math.round(value.x * 100)}% across, {Math.round(value.y * 100)}% up from the
        bottom.
      </p>
    </div>
  );
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
  const [stampPosition, setStampPosition] = useState<StampPosition>(DEFAULT_STAMP_POSITION);
  const [previewPosition, setPreviewPosition] = useState<StampPosition>(DEFAULT_STAMP_POSITION);
  const [isUpdatingStamp, setIsUpdatingStamp] = useState(false);

  // Only regenerate the (relatively expensive) stamped PDF preview once the user
  // pauses dragging, so the page doesn't reload on every pointer move.
  useEffect(() => {
    const id = setTimeout(() => setPreviewPosition(stampPosition), 250);
    return () => clearTimeout(id);
  }, [stampPosition]);

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
        setIsUpdatingStamp(true);
        const staff = currentUser.data?.fullName || currentUser.data?.email || "Staff";
        bytes = await stampReceivedPdf(
          bytes,
          {
            staffName: staff,
            receivedOn: receivedStampDate(),
            department: receivedStampDepartment,
          },
          previewPosition,
        );
      }
      if (cancelled) return;
      url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      setPdfSrc(url);
    };

    void open()
      .catch(() => {
        if (!cancelled) {
          setPdfSrc(null);
          setPdfFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setIsUpdatingStamp(false);
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [pdf.data, billing.data, currentUser.isPending, currentUser.data, previewPosition]);

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
        data: { billingId, confirmed: ticked, stampPosition },
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

        <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-8 sm:py-6 md:px-12 lg:flex-row">
          <div className="relative min-h-0 flex-1">
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
              <>
                <iframe
                  title={bill?.invoiceRef ?? "Invoice PDF"}
                  src={pdfSrc}
                  className="h-full w-full rounded-[1.25rem] bg-white"
                />
                {isUpdatingStamp && (
                  <div className="pointer-events-none absolute top-7 right-7 flex items-center gap-2 rounded-full bg-foreground/80 px-3 py-1.5 text-xs font-medium text-ivory shadow-lg sm:top-9 sm:right-11">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Moving stamp…
                  </div>
                )}
              </>
            )}
          </div>

          {bill && !bill.acknowledgedAt && (
            <form
              className="flex w-full shrink-0 flex-col gap-3 lg:w-72 lg:overflow-y-auto xl:w-80"
              onSubmit={(event) => {
                event.preventDefault();
                if (!ticked || submit.isPending) return;
                submit.mutate();
              }}
            >
              <div className="rounded-[1.25rem] bg-ivory/70 p-4 sm:p-5">
                <StampPositionPicker value={stampPosition} onChange={setStampPosition} />
              </div>
              <div className="flex flex-col gap-3 rounded-[1.25rem] bg-ivory/70 p-3">
                <button
                  type="button"
                  aria-pressed={ticked}
                  onClick={() => setTicked((value) => !value)}
                  className="flex min-w-0 items-center gap-3 text-left text-sm text-foreground/70"
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
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-lime px-5 text-sm font-medium text-lime-foreground transition hover:brightness-95 disabled:opacity-50 sm:h-9"
                >
                  {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
