import { Receipt } from "lucide-react";
import { Sidebar } from "./sidebar";

export function BillingPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden app-canvas text-foreground md:flex-row">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8 md:p-12">
        <div>
          <h1 className="font-display text-4xl">Billing</h1>
          <p className="mt-2 text-sm text-foreground/60">
            Invoices and payment requests for your department.
          </p>
        </div>

        <div className="mt-8 rounded-[1.5rem] glass-card px-6 py-16 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lime text-lime-foreground">
            <Receipt className="h-5 w-5" />
          </span>
          <p className="mt-4 font-medium">Under Development</p>
          <p className="mt-1 text-sm text-foreground/60">
            Bills will show up here once a payment request is created.
          </p>
        </div>
      </main>
    </div>
  );
}
