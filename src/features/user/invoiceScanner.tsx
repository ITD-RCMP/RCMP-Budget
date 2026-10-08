import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, FileText, Loader2, RotateCcw, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createBilling } from "@backend/server-functions/billing-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ScanStatus = "starting" | "live" | "preview" | "error";

type SnapMode = "single" | "batch";

type Scan = { url: string; width: number; height: number };

const MAX_BATCH_PAGES = 20;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("unreadable"));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("unreadable"));
    reader.readAsDataURL(file);
  });
}

function isPdf(base64: string) {
  try {
    return atob(base64.slice(0, 8)).startsWith("%PDF");
  } catch {
    return false;
  }
}

function cameraErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError")
    return "Camera access is blocked. Allow the camera in your browser settings, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "No camera found. Connect a camera and try again.";
  if (name === "NotReadableError")
    return "Your camera is busy. Close other apps using it and try again.";
  if (!window.isSecureContext)
    return "The camera only works on a secure link. Open this page with https:// and try again.";
  return "Could not start the camera. Please try again.";
}

function drawFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0);
}

function paintPreview(frame: HTMLCanvasElement, display: HTMLCanvasElement) {
  const view = viewRect(frame.width, frame.height);
  display.width = Math.round(view.width);
  display.height = Math.round(view.height);
  display
    .getContext("2d")
    ?.drawImage(frame, view.x, view.y, view.width, view.height, 0, 0, display.width, display.height);
}

function todayIso() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function pageSize(scan: Scan) {
  const ratio = scan.width / scan.height;
  let width = 210;
  let height = width / ratio;
  if (height > 297) {
    height = 297;
    width = height * ratio;
  }
  return {
    width,
    height,
    orientation: width > height ? ("landscape" as const) : ("portrait" as const),
  };
}

async function scansToPdf(scans: Scan[]) {
  const { jsPDF } = await import("jspdf");
  const first = pageSize(scans[0]);
  const pdf = new jsPDF({
    unit: "mm",
    format: [first.width, first.height],
    orientation: first.orientation,
  });
  scans.forEach((scan, index) => {
    const size = pageSize(scan);
    if (index > 0) pdf.addPage([size.width, size.height], size.orientation);
    pdf.addImage(scan.url, "JPEG", 0, 0, size.width, size.height);
  });
  return pdf.output("datauristring").split(",")[1] ?? "";
}

const VIEW_RATIO = 3 / 4;
const GUIDE_INSET = 0.08;
const A4_RATIO = 210 / 297;
const GUIDE_WIDTH = 1 - GUIDE_INSET * 2;
const GUIDE_HEIGHT = (GUIDE_WIDTH * VIEW_RATIO) / A4_RATIO;

function viewRect(frameWidth: number, frameHeight: number) {
  const width = Math.min(frameWidth, frameHeight * VIEW_RATIO);
  const height = width / VIEW_RATIO;
  return { x: (frameWidth - width) / 2, y: (frameHeight - height) / 2, width, height };
}

function snapshotView(frame: HTMLCanvasElement) {
  const view = viewRect(frame.width, frame.height);
  const page = document.createElement("canvas");
  page.width = Math.round(view.width);
  page.height = Math.round(view.height);
  page
    .getContext("2d")
    ?.drawImage(frame, view.x, view.y, view.width, view.height, 0, 0, page.width, page.height);
  return page;
}

export function InvoiceScanner({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [supplier, setSupplier] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayIso);
  const [totalInvoice, setTotalInvoice] = useState("");
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<SnapMode>("single");
  const [pages, setPages] = useState<Scan[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLCanvasElement | null>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ScanStatus>("starting");
  const [errorMessage, setErrorMessage] = useState("");
  const [scan, setScan] = useState<Scan | null>(null);
  const [uploadedPdf, setUploadedPdf] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || scan || reviewing || uploadedPdf) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frameId = 0;

    const paintLoop = () => {
      const video = videoRef.current;
      const display = displayRef.current;
      const frame = frameRef.current;
      if (cancelled || !video || !display || !frame) return;
      if (video.videoWidth) {
        drawFrame(video, frame);
        paintPreview(frame, display);
      }
      frameId = requestAnimationFrame(paintLoop);
    };

    const start = async () => {
      setStatus("starting");
      try {
        const portrait = window.matchMedia("(max-width: 639px)").matches;
        stream = await navigator.mediaDevices.getUserMedia({
          video: portrait
            ? {
                facingMode: { ideal: "environment" },
                width: { ideal: 1080 },
                height: { ideal: 1920 },
                aspectRatio: { ideal: 9 / 16 },
              }
            : { facingMode: "environment" },
          audio: false,
        });
        const video = videoRef.current;
        if (cancelled || !video) return;
        frameRef.current ??= document.createElement("canvas");
        video.srcObject = stream;
        await video.play();
        setStatus("live");
        frameId = requestAnimationFrame(paintLoop);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(cameraErrorMessage(error));
        setStatus("error");
      }
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, scan, reviewing, uploadedPdf, attempt]);

  useEffect(() => {
    if (open) return;
    setScan(null);
    setUploadedPdf(null);
    setUploadedName("");
    setSupplier("");
    setInvoiceDate(todayIso());
    setTotalInvoice("");
    setMode("single");
    setPages([]);
    setReviewing(false);
  }, [open]);

  const capture = useCallback(() => {
    if (mode === "batch" && pages.length >= MAX_BATCH_PAGES) {
      toast.error("This batch is full. Save these pages, then start another bill.");
      return;
    }
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video?.videoWidth || !frame) {
      toast.error("The camera is not ready yet. Wait a moment and try again.");
      return;
    }
    drawFrame(video, frame);
    const page = snapshotView(frame);
    const next = {
      url: page.toDataURL("image/jpeg", 0.92),
      width: page.width,
      height: page.height,
    };
    if (mode === "batch") {
      setPages((current) => [...current, next]);
      return;
    }
    setScan(next);
    setStatus("preview");
  }, [mode, pages.length]);

  const removePage = useCallback((index: number) => {
    setPages((current) => current.filter((_, pageIndex) => pageIndex !== index));
    setReviewing((current) => current && pages.length > 1);
  }, [pages.length]);

  const clearUpload = useCallback(() => {
    setUploadedPdf(null);
    setUploadedName("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const onUpload = useCallback(async (file: File | undefined) => {
    if (!file) return;
    const namedPdf = file.name.toLowerCase().endsWith(".pdf");
    if (file.type !== "application/pdf" && !namedPdf) {
      toast.error("This file is not a PDF. Choose a PDF and try again.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast.error("This file is too large. Choose a PDF under 10 MB.");
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      if (!isPdf(base64)) {
        toast.error("This file is not a PDF. Choose a PDF and try again.");
        return;
      }
      setScan(null);
      setPages([]);
      setReviewing(false);
      setUploadedPdf(base64);
      setUploadedName(file.name);
      setStatus("preview");
    } catch {
      toast.error("Could not read this file. Choose the PDF again.");
    }
  }, []);

  const savePdf = useCallback(async () => {
    const scans = mode === "batch" ? pages : scan ? [scan] : [];
    if (!uploadedPdf && scans.length === 0) return;
    const amount = Number(totalInvoice);
    if (!supplier.trim() || !invoiceDate) {
      toast.error("Add the supplier and invoice date, then save.");
      return;
    }
    if (!totalInvoice.trim() || !Number.isFinite(amount) || amount <= 0 || amount > 99999999.99) {
      toast.error("Enter the invoice amount in RM, then save.");
      return;
    }
    setSaving(true);
    try {
      const pdfBase64 = uploadedPdf ?? (await scansToPdf(scans));
      const result = await createBilling({
        data: {
          supplier: supplier.trim(),
          invoiceDate,
          totalInvoice: Math.round(amount * 100) / 100,
          pdfBase64,
        },
      });
      toast.success(`Bill ${result.invoiceRef} saved.`);
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the bill. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }, [mode, pages, scan, uploadedPdf, supplier, invoiceDate, totalInvoice, onSaved, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card left-0 top-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[1.5rem]">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="font-display text-2xl">Scan invoice</DialogTitle>
          <DialogDescription>
            {uploadedPdf
              ? "Add the supplier, date, and amount, then save this PDF."
              : mode === "batch"
                ? "Snap each page, then finish to save them as one bill."
                : "Snap the invoice, or upload a PDF from your device."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 rounded-full bg-ivory p-1" role="group" aria-label="Snap mode">
          {(
            [
              ["single", "Single"],
              ["batch", "Batch"],
            ] as const
          ).map(([option, label]) => (
            <button
              key={option}
              type="button"
              disabled={Boolean(scan) || Boolean(uploadedPdf) || pages.length > 0 || reviewing || saving}
              onClick={() => setMode(option)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-60",
                mode === option
                  ? "bg-foreground text-background"
                  : "text-foreground/55 hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className={cn(
            "relative overflow-hidden rounded-[1.25rem]",
            uploadedName
              ? "flex h-36 w-full items-center justify-center bg-ivory px-6"
              : reviewing
                ? "w-full bg-ivory/70 p-3"
                : scan
                  ? "mx-auto flex h-40 w-full shrink-0 items-center justify-center bg-foreground/90 sm:aspect-[3/4] sm:h-[min(60vh,32rem)]"
                  : "mx-auto flex h-[min(36vh,16rem)] w-full shrink-0 items-center justify-center bg-foreground/90 sm:aspect-[3/4] sm:h-[min(60vh,32rem)]",
          )}
        >
          <video ref={videoRef} className="hidden" playsInline muted />
          {reviewing ? (
            <ul className="grid max-h-[40vh] grid-cols-3 gap-2 overflow-y-auto">
              {pages.map((page, index) => (
                <li key={page.url} className="relative">
                  <img
                    src={page.url}
                    alt={`Page ${index + 1}`}
                    className="aspect-[3/4] w-full rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePage(index)}
                    aria-label={`Remove page ${index + 1}`}
                    className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/80 text-background"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : uploadedName ? (
            <div className="flex max-w-full items-center gap-3 text-foreground">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-lime text-lime-foreground">
                <FileText className="h-5 w-5" />
              </span>
              <p className="min-w-0 truncate text-sm font-medium">{uploadedName}</p>
            </div>
          ) : scan ? (
            <img
              src={scan.url}
              alt="Scanned invoice"
              className="h-full w-full object-contain"
            />
          ) : (
            <canvas
              ref={displayRef}
              className={status === "live" ? "h-full w-full" : "hidden"}
            />
          )}
          {status === "live" && !scan && !uploadedName && !reviewing && (
            <div
              aria-hidden
              className="pointer-events-none absolute rounded-xl border border-dashed border-white/50"
              style={{
                left: `${GUIDE_INSET * 100}%`,
                right: `${GUIDE_INSET * 100}%`,
                top: `${((1 - GUIDE_HEIGHT) / 2) * 100}%`,
                bottom: `${((1 - GUIDE_HEIGHT) / 2) * 100}%`,
              }}
            >
              {[
                "top-0 left-0 border-t-4 border-l-4 rounded-tl-xl",
                "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl",
                "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl",
                "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl",
              ].map((corner) => (
                <span key={corner} className={cn("absolute -m-0.5 h-8 w-8 border-lime", corner)} />
              ))}
            </div>
          )}
          {status === "starting" && (
            <p className="flex items-center gap-2 text-sm text-white/80">
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting camera…
            </p>
          )}
          {status === "error" && (
            <p className="max-w-sm px-6 text-center text-sm text-white/85">
              {errorMessage}
            </p>
          )}
        </div>

        {mode === "batch" && pages.length > 0 && !reviewing && (
          <div className="flex gap-2 overflow-x-auto">
            {pages.map((page, index) => (
              <div key={page.url} className="relative shrink-0">
                <img
                  src={page.url}
                  alt={`Page ${index + 1}`}
                  className="h-16 w-12 rounded-lg object-cover"
                />
                <span className="absolute right-1 bottom-1 rounded-full bg-foreground/80 px-1.5 text-[10px] text-background">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            void onUpload(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        {(status === "preview" || reviewing) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Supplier name"
              aria-label="Supplier"
              maxLength={255}
              className="h-11 rounded-full"
            />
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              aria-label="Invoice date"
              className="h-11 rounded-full"
            />
            <Input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={totalInvoice}
              onChange={(e) => setTotalInvoice(e.target.value)}
              placeholder="Invoice (RM)"
              aria-label="Invoice (RM)"
              className="h-11 rounded-full sm:col-span-2"
            />
          </div>
        )}

        <div className="flex shrink-0 flex-wrap justify-end gap-2 pb-1 max-sm:[&_button]:w-full">
          {status === "error" && (
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-medium text-lime-foreground transition hover:brightness-95"
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
          )}
          {(status === "starting" || status === "live" || status === "error") && !reviewing && !uploadedPdf && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-5 py-3 text-sm text-foreground/70 transition hover:bg-ivory"
              >
                <Upload className="h-4 w-4" />
                Upload PDF
              </button>
              {status === "live" && (
                <button
                  type="button"
                  onClick={capture}
                  className="inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-medium text-lime-foreground transition hover:brightness-95"
                >
                  <Camera className="h-4 w-4" />
                  {mode === "batch" ? `Snap page${pages.length ? ` ${pages.length + 1}` : ""}` : "Capture"}
                </button>
              )}
              {mode === "batch" && pages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReviewing(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-5 py-3 text-sm text-foreground/70 transition hover:bg-ivory"
                >
                  <Check className="h-4 w-4" />
                  Finish
                </button>
              )}
            </>
          )}
          {reviewing && (
            <button
              type="button"
              onClick={() => setReviewing(false)}
              className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-5 py-3 text-sm text-foreground/70 transition hover:bg-ivory"
            >
              <Camera className="h-4 w-4" />
              Add page
            </button>
          )}
          {(status === "preview" || reviewing) && (
            <>
              {status === "preview" && uploadedPdf && (
                <>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-5 py-3 text-sm text-foreground/70 transition hover:bg-ivory"
                  >
                    <Upload className="h-4 w-4" />
                    Choose another PDF
                  </button>
                  <button
                    type="button"
                    onClick={clearUpload}
                    className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-5 py-3 text-sm text-foreground/70 transition hover:bg-ivory"
                  >
                    <Camera className="h-4 w-4" />
                    Use camera
                  </button>
                </>
              )}
              {status === "preview" && !uploadedPdf && (
                <button
                  type="button"
                  onClick={() => setScan(null)}
                  className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-5 py-3 text-sm text-foreground/70 transition hover:bg-ivory"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retake
                </button>
              )}
              <button
                type="button"
                onClick={() => void savePdf()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-medium text-lime-foreground transition hover:brightness-95 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save bill
              </button>
            </>
          )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
