import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { updateBilling, type Billing } from "@backend/server-functions/billing-fns";

export function BillingEditDialog({
  billing,
  onClose,
}: {
  billing: Billing | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [supplier, setSupplier] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [totalInvoice, setTotalInvoice] = useState("");

  useEffect(() => {
    if (!billing) return;
    setSupplier(billing.supplier);
    setInvoiceDate(billing.invoiceDate);
    setTotalInvoice(billing.totalInvoice != null ? String(billing.totalInvoice) : "");
  }, [billing]);

  const update = useMutation({
    mutationFn: (input: {
      billingId: number;
      supplier: string;
      invoiceDate: string;
      totalInvoice: number;
    }) => updateBilling({ data: input }),
    onSuccess: () => {
      toast.success("Invoice updated.");
      void queryClient.invalidateQueries({ queryKey: ["billings"] });
      onClose();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not save your changes. Please try again.",
      ),
  });

  const submit = () => {
    if (!billing) return;
    const amount = Number(totalInvoice);
    if (!supplier.trim()) {
      toast.error("Add the supplier name, then save again.");
      return;
    }
    if (!invoiceDate) {
      toast.error("Pick an invoice date, then save again.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter an amount greater than 0, then save again.");
      return;
    }
    update.mutate({
      billingId: billing.id,
      supplier: supplier.trim(),
      invoiceDate,
      totalInvoice: amount,
    });
  };

  return (
    <Dialog open={billing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass-card rounded-[1.5rem] p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Edit invoice</DialogTitle>
          <DialogDescription>Update the invoice details, then save.</DialogDescription>
        </DialogHeader>
        <label className="grid gap-1.5 text-xs text-foreground/50">
          Supplier
          <Input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Supplier name"
            className="h-11 rounded-full"
          />
        </label>
        <label className="grid gap-1.5 text-xs text-foreground/50">
          Invoice date
          <Input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="h-11 rounded-full"
          />
        </label>
        <label className="grid gap-1.5 text-xs text-foreground/50">
          Invoice total (RM)
          <Input
            type="number"
            min="0"
            step="0.01"
            value={totalInvoice}
            onChange={(e) => setTotalInvoice(e.target.value)}
            placeholder="0.00"
            className="h-11 rounded-full"
          />
        </label>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={update.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-medium text-lime-foreground transition hover:brightness-95 disabled:opacity-60"
          >
            {update.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
