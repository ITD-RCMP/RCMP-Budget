import { createFileRoute } from "@tanstack/react-router";
import { BillingPage } from "@/features/user/billing";

export const Route = createFileRoute("/user/billing/")({
  head: () => ({
    meta: [
      { title: "Billing — Budget Tracker" },
      {
        name: "description",
        content: "View department invoices and payment requests.",
      },
    ],
  }),
  component: BillingPage,
});
