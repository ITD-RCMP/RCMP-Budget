import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FinanceLayout } from "./sidebar";

const filterField =
  "h-11 rounded-2xl border-foreground/10 bg-ivory/70 px-3.5 text-sm shadow-none focus-visible:ring-foreground/15";

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-foreground/45">{label}</span>
      {children}
    </label>
  );
}

export function FinanceBillingPage() {
  const [month, setMonth] = useState("");
  const [date, setDate] = useState("");
  const [supplier, setSupplier] = useState("");

  return (
    <FinanceLayout>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Billing</h1>
        <p className="mt-2 text-sm text-foreground/60">Invoices for the finance workspace.</p>
      </div>

      <div className="mt-6 rounded-[1.25rem] glass-card p-4 sm:mt-8 sm:rounded-[1.5rem] sm:p-6 md:p-8">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[14rem_12rem_minmax(0,1fr)]">
          <FilterField label="Month">
            <div className="relative">
              {month === "" && (
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-foreground/40">
                  Any month
                </span>
              )}
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                aria-label="Month"
                className={`${filterField} ${month === "" ? "[&::-webkit-datetime-edit]:text-transparent" : ""}`}
              />
            </div>
          </FilterField>
          <FilterField label="Date">
            <div className="relative">
              {date === "" && (
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-foreground/40">
                  Any date
                </span>
              )}
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Date"
                className={`${filterField} ${date === "" ? "[&::-webkit-datetime-edit]:text-transparent" : ""}`}
              />
            </div>
          </FilterField>
          <FilterField label="Supplier">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-foreground/35" />
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Search"
                aria-label="Supplier"
                className="h-11 rounded-2xl border-foreground/10 bg-ivory/70 pr-3.5 pl-10 text-sm shadow-none focus-visible:ring-foreground/15"
              />
            </div>
          </FilterField>
        </div>

        <div className="mt-6 hidden overflow-x-auto sm:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-[3px] border-double border-foreground/30 text-left text-[11px] font-medium tracking-[0.14em] text-foreground/45 uppercase">
                <th className="w-28 px-2 py-2.5 font-medium">Date</th>
                <th className="w-32 px-2 py-2.5 font-medium">Ref</th>
                <th className="px-2 py-2.5 font-medium">Particulars</th>
                <th className="w-28 px-2 py-2.5 text-right font-medium">Invoice (RM)</th>
              </tr>
            </thead>
          </table>
        </div>

        <p className="py-16 text-center text-sm text-foreground/50">No bills yet.</p>
      </div>
    </FinanceLayout>
  );
}
