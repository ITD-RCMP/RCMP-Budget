import { createFileRoute } from "@tanstack/react-router";
import { FinanceDashboard } from "@/features/finance/dashboard";

export const Route = createFileRoute("/finance/")({
  head: () => ({
    meta: [
      { title: "Finance — Budget Tracker" },
      {
        name: "description",
        content: "Finance workspace for Budget Tracker.",
      },
    ],
  }),
  component: FinanceDashboard,
});
