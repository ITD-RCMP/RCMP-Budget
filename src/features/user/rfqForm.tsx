import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  FileText,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Sidebar } from "@/features/user/sidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateRfqFromForm } from "@backend/server-functions/rfq-generator";

type RfqLine = {
  id: number;
  name: string;
  quantity: number;
  pricePerUnit: number;
};

function formatRm(value: number) {
  return `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function downloadRfqFile(result: { fileName: string; data: string }) {
  const bytes = Uint8Array.from(atob(result.data), (char) =>
    char.charCodeAt(0),
  );
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RfqFormPage() {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [lines, setLines] = useState<RfqLine[]>([]);
  const [generating, setGenerating] = useState(false);

  const unitPrice = Number(pricePerUnit) || 0;
  const lineCost = unitPrice * quantity;
  const totalCost = lines.reduce(
    (sum, item) => sum + item.pricePerUnit * item.quantity,
    0,
  );
  const canAdd = name.trim().length > 0 && unitPrice > 0;

  const addItem = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || unitPrice <= 0) return;

    setLines((prev) => {
      const existing = prev.find(
        (item) =>
          item.name.toLowerCase() === trimmed.toLowerCase() &&
          item.pricePerUnit === unitPrice,
      );
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }
      return [
        ...prev,
        {
          id: Date.now(),
          name: trimmed,
          quantity,
          pricePerUnit: unitPrice,
        },
      ];
    });
    setName("");
    setQuantity(1);
    setPricePerUnit("");
  };

  const updateQuantity = (id: number, delta: number) => {
    setLines((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + delta } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const removeItem = (id: number) => {
    setLines((prev) => prev.filter((item) => item.id !== id));
  };

  const generate = async () => {
    if (lines.length === 0 || generating) return;
    setGenerating(true);
    const toastId = toast.loading("Generating your RFQ…");
    try {
      const result = await generateRfqFromForm({
        data: {
          items: lines.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            pricePerUnit: item.pricePerUnit,
          })),
        },
      });
      downloadRfqFile(result);
      toast.success("RFQ downloaded. Open the PDF to review it.", {
        id: toastId,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not generate RFQ. Check your items and try again.",
        { id: toastId },
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden app-canvas text-foreground md:flex-row">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-6 md:p-12">
        <Link
          to="/user"
          className="inline-flex items-center gap-2 text-sm text-foreground/60 transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <div className="mt-6">
          <h1 className="font-display text-4xl">Generate RFQ</h1>
          <p className="mt-2 text-sm text-foreground/60">
            Add items with quantity and unit price, then download your Request
            for Quotation.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
          <form
            onSubmit={addItem}
            className="h-fit rounded-[1.5rem] glass-card p-6 md:p-8"
          >
            <h2 className="font-display text-2xl">Add an item</h2>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="rfq-item">Item</Label>
                <Input
                  id="rfq-item"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ergonomic office chair"
                  className="h-12 rounded-xl"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <div className="flex w-fit items-center gap-1 rounded-full border border-foreground/10 p-1">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-ivory"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center text-base font-medium tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-ivory"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rfq-price">Price (RM) / Unit</Label>
                  <Input
                    id="rfq-price"
                    inputMode="decimal"
                    value={pricePerUnit}
                    onChange={(e) =>
                      setPricePerUnit(e.target.value.replace(/[^\d.]/g, ""))
                    }
                    placeholder="0.00"
                    className="h-12 rounded-xl tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cost (RM)</Label>
                <div className="flex h-12 items-center rounded-xl border border-foreground/10 bg-ivory px-4 font-display text-xl tabular-nums">
                  {formatRm(lineCost)}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canAdd}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-base font-medium text-background transition hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Add item
            </button>
          </form>

          <div className="flex h-fit flex-col rounded-[1.5rem] glass-card p-6 md:p-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">RFQ items</h2>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-lime px-2 text-sm font-medium text-lime-foreground tabular-nums">
                {lines.length}
              </span>
            </div>

            {lines.length === 0 ? (
              <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-foreground/15 py-12 text-center">
                <FileText className="h-8 w-8 text-foreground/30" />
                <p className="max-w-48 text-sm text-foreground/50">
                  No items yet. Add items on the left to build your RFQ.
                </p>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-foreground/10">
                {lines.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="mt-0.5 text-xs text-foreground/50">
                        {formatRm(item.pricePerUnit)} × {item.quantity}
                      </p>
                      <p className="mt-1 text-sm font-medium tabular-nums">
                        {formatRm(item.pricePerUnit * item.quantity)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full border border-foreground/10 p-0.5">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-ivory"
                        aria-label={`Decrease ${item.name} quantity`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm font-medium tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-ivory"
                        aria-label={`Increase ${item.name} quantity`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/40 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-foreground/10 pt-4">
              <p className="text-sm text-foreground/60">Total cost</p>
              <p className="font-display text-2xl tabular-nums">
                {formatRm(totalCost)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void generate()}
              disabled={lines.length === 0 || generating}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-lime py-4 text-base font-medium text-lime-foreground transition hover:brightness-95 disabled:opacity-40"
            >
              {generating ? "Generating…" : "Generate RFQ"}
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
