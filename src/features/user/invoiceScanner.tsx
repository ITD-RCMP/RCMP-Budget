import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";
import type Jscanify from "jscanify/client";
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
import {
  focusOnPaper,
  loadDocumentScanner,
  paperPixelSize,
  readPaperCorners,
  type PaperCorners,
} from "@/lib/document-scanner";

type ScanStatus = "starting" | "live" | "focusing" | "preview" | "error";

type SnapMode = "single" | "batch";

type Scan = { url: string; width: number; height: number };

type PaperFocus = { originX: number; originY: number; scale: number };

const HIGHLIGHT_INTERVAL_MS = 120;
const FOCUS_MS = 320;
const MAX_BATCH_PAGES = 20;

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
  if (error instanceof Error && error.message === "opencv-load-failed")
    return "The scanner could not load. Check your internet and try again.";
  return "Could not start the camera. Please try again.";
}

function drawFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0);
}

function paintPreview(
  frame: HTMLCanvasElement,
  display: HTMLCanvasElement,
  corners: PaperCorners | null,
) {
  display.width = frame.width;
  display.height = frame.height;
  const ctx = display.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(frame, 0, 0);
  if (!corners) return;
  ctx.strokeStyle = "#5fb98a";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(corners.topLeftCorner.x, corners.topLeftCorner.y);
  ctx.lineTo(corners.topRightCorner.x, corners.topRightCorner.y);
  ctx.lineTo(corners.bottomRightCorner.x, corners.bottomRightCorner.y);
  ctx.lineTo(corners.bottomLeftCorner.x, corners.bottomLeftCorner.y);
  ctx.closePath();
  ctx.stroke();
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

function copyFrame(frame: HTMLCanvasElement) {
  const copy = document.createElement("canvas");
  copy.width = frame.width;
  copy.height = frame.height;
  copy.getContext("2d")?.drawImage(frame, 0, 0);
  return copy;
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
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<SnapMode>("single");
  const [pages, setPages] = useState<Scan[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLCanvasElement | null>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<Jscanify | null>(null);
  const cornersRef = useRef<PaperCorners | null>(null);
  const holdRef = useRef(false);
  const focusTimer = useRef(0);
  const [status, setStatus] = useState<ScanStatus>("starting");
  const [errorMessage, setErrorMessage] = useState("");
  const [scan, setScan] = useState<Scan | null>(null);
  const [focus, setFocus] = useState<PaperFocus | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || scan || reviewing) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frameId = 0;
    let lastDraw = 0;

    const highlightLoop = (time: number) => {
      const video = videoRef.current;
      const display = displayRef.current;
      const frame = frameRef.current;
      const scanner = scannerRef.current;
      if (cancelled || !video || !display || !frame || !scanner) return;
      if (holdRef.current) {
        frameId = requestAnimationFrame(highlightLoop);
        return;
      }
      if (video.videoWidth && time - lastDraw >= HIGHLIGHT_INTERVAL_MS) {
        lastDraw = time;
        drawFrame(video, frame);
        const corners = readPaperCorners(scanner, frame);
        cornersRef.current = corners;
        paintPreview(frame, display, corners);
      }
      frameId = requestAnimationFrame(highlightLoop);
    };

    const start = async () => {
      setStatus("starting");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        scannerRef.current = await loadDocumentScanner();
        const video = videoRef.current;
        if (cancelled || !video) return;
        holdRef.current = false;
        frameRef.current ??= document.createElement("canvas");
        video.srcObject = stream;
        await video.play();
        setStatus("live");
        frameId = requestAnimationFrame(highlightLoop);
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
  }, [open, scan, reviewing, attempt]);

  useEffect(() => {
    if (open) return;
    window.clearTimeout(focusTimer.current);
    holdRef.current = false;
    setScan(null);
    setFocus(null);
    setSupplier("");
    setInvoiceDate(todayIso());
    setMode("single");
    setPages([]);
    setReviewing(false);
  }, [open]);

  const capture = useCallback(() => {
    if (mode === "batch" && pages.length >= MAX_BATCH_PAGES) {
      toast.error("This batch is full. Save these pages, then start another bill.");
      return;
    }
    const frame = frameRef.current;
    const scanner = scannerRef.current;
    const corners = cornersRef.current;
    if (!frame || !scanner || !corners) {
      toast.error(
        "No page found. Place the invoice on a plain surface and try again.",
      );
      return;
    }
    const snapshot = copyFrame(frame);
    const size = paperPixelSize(corners);
    holdRef.current = true;
    setFocus(focusOnPaper(corners, snapshot.width, snapshot.height));
    setStatus("focusing");
    window.clearTimeout(focusTimer.current);
    focusTimer.current = window.setTimeout(() => {
      const page = scanner.extractPaper(snapshot, size.width, size.height, corners);
      if (!page) {
        holdRef.current = false;
        setFocus(null);
        setStatus("live");
        toast.error(
          "No page found. Place the invoice on a plain surface and try again.",
        );
        return;
      }
      const next = {
        url: page.toDataURL("image/jpeg", 0.92),
        width: page.width,
        height: page.height,
      };
      if (mode === "batch") {
        setPages((current) => [...current, next]);
        holdRef.current = false;
        setFocus(null);
        setStatus("live");
        return;
      }
      setScan(next);
      setFocus(null);
      setStatus("preview");
    }, FOCUS_MS);
  }, [mode, pages.length]);

  const removePage = useCallback((index: number) => {
    setPages((current) => current.filter((_, pageIndex) => pageIndex !== index));
    setReviewing((current) => current && pages.length > 1);
  }, [pages.length]);

  const savePdf = useCallback(async () => {
    const scans = mode === "batch" ? pages : scan ? [scan] : [];
    if (scans.length === 0) return;
    if (!supplier.trim() || !invoiceDate) {
      toast.error("Add the supplier and invoice date, then save.");
      return;
    }
    setSaving(true);
    try {
      const pdfBase64 = await scansToPdf(scans);
      const result = await createBilling({
        data: { supplier: supplier.trim(), invoiceDate, pdfBase64 },
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
  }, [mode, pages, scan, supplier, invoiceDate, onSaved, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-2xl rounded-[1.5rem] border-0 p-6 sm:rounded-[1.5rem]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Scan invoice</DialogTitle>
          <DialogDescription>
            {mode === "batch"
              ? "Snap each page, then finish to save them as one bill."
              : "Hold the invoice flat and keep all four corners in view."}
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
              disabled={Boolean(scan) || pages.length > 0 || reviewing || saving}
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
            reviewing
              ? "bg-ivory/70 p-3"
              : "flex max-h-[60vh] items-center justify-center bg-foreground/90",
          )}
          style={
            reviewing
              ? undefined
              : { aspectRatio: scan ? `${scan.width} / ${scan.height}` : "4 / 3" }
          }
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
          ) : scan ? (
            <img
              src={scan.url}
              alt="Scanned invoice"
              className="h-full w-full object-contain"
            />
          ) : (
            <canvas
              ref={displayRef}
              className={
                status === "live" || status === "focusing"
                  ? "h-full w-full object-contain transition-transform duration-300 ease-out"
                  : "hidden"
              }
              style={
                focus
                  ? {
                      transform: `scale(${focus.scale})`,
                      transformOrigin: `${focus.originX}% ${focus.originY}%`,
                    }
                  : undefined
              }
            />
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
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
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
          {status === "live" && !reviewing && (
            <>
              <button
                type="button"
                onClick={capture}
                className="inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-medium text-lime-foreground transition hover:brightness-95"
              >
                <Camera className="h-4 w-4" />
                {mode === "batch" ? `Snap page${pages.length ? ` ${pages.length + 1}` : ""}` : "Capture"}
              </button>
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
              {status === "preview" && (
                <button
                  type="button"
                  onClick={() => {
                    holdRef.current = false;
                    setFocus(null);
                    setScan(null);
                  }}
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
      </DialogContent>
    </Dialog>
  );
}
