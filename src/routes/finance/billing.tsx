import { createFileRoute } from "@tanstack/react-router";
import { FinanceBillingPage } from "@/features/finance/billing";

export const Route = createFileRoute("/finance/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Budget Tracker" },
      {
        name: "description",
        content: "Invoices submitted by each department.",
      },
    ],
  }),
  component: FinanceBillingPage,
});
