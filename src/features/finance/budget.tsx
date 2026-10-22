import { FinanceLayout } from "./sidebar";

export function FinanceBudgetPage() {
  return (
    <FinanceLayout>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Budget</h1>
        <p className="mt-2 text-sm text-foreground/60">Department budgets for finance.</p>
      </div>
    </FinanceLayout>
  );
}
