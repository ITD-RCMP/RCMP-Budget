import { createFileRoute } from "@tanstack/react-router";
import { FinanceBudgetPage } from "@/features/finance/budget";

export const Route = createFileRoute("/finance/budget")({
  head: () => ({
    meta: [
      { title: "Budget — Budget Tracker" },
      {
        name: "description",
        content: "Department budgets for finance.",
      },
    ],
  }),
  component: FinanceBudgetPage,
});
