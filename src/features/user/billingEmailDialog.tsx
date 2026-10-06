import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendBillingEmail, type Billing } from "@backend/server-functions/billing-fns";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRecipients(value: string) {
  return value
    .split(/[,;\s]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

export function BillingEmailDialog({
  billing,
  onClose,
}: {
  billing: Billing | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!billing) return;
    setTo(billing.emailTo.join(", "));
    setMessage(
      `Hi,\n\nPlease find the attached invoice ${billing.invoiceRef} from ${billing.supplier}.\n\nThank you.`,
    );
  }, [billing]);

  const send = useMutation({
    mutationFn: (input: { billingId: number; to: string[]; message: string }) =>
      sendBillingEmail({ data: input }),
    onSuccess: () => {
      toast.success("Email sent.");
      void queryClient.invalidateQueries({ queryKey: ["billings"] });
      onClose();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "The email could not be sent. Please try again.",
      ),
  });

  const submit = () => {
    if (!billing) return;
    const recipients = parseRecipients(to);
    if (recipients.length === 0 || !recipients.every((email) => EMAIL_PATTERN.test(email))) {
      toast.error("Enter a valid email address, then send again.");
      return;
    }
    send.mutate({ billingId: billing.id, to: recipients, message: message.trim() });
  };

  return (
    <Dialog open={billing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass-card flex max-h-[90vh] min-h-[40rem] w-full max-w-3xl flex-col overflow-y-auto rounded-[1.5rem] border-0 p-8 sm:rounded-[1.5rem]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Send invoice</DialogTitle>
          <DialogDescription>
            The scanned PDF is attached. Separate many emails with commas.
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-1.5 text-xs text-foreground/50">
          To
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Enter email valid email address"
            className="h-11 rounded-full"
          />
        </label>
        <label className="grid gap-1.5 text-xs text-foreground/50">
          Message
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={12}
            className="min-h-72 rounded-[1rem]"
          />
          <span>Review this email before you send it.</span>
        </label>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={send.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-medium text-lime-foreground transition hover:brightness-95 disabled:opacity-60"
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
