import { CheckCircle2, Clock, FileText, LayoutGrid, Wallet } from "lucide-react";

export function DashboardMock() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="rounded-[2rem] bg-ivory p-4 shadow-card sm:rounded-[2.5rem] sm:p-6 md:p-10">
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          {/* Sidebar */}
          <aside className="hidden rounded-2xl bg-background/60 p-5 md:block">
            <div className="mb-6 font-display text-2xl">Budget Tracker</div>
            <nav className="space-y-1 text-sm">
              {[
                { icon: LayoutGrid, label: "Overview", active: true },
                { icon: FileText, label: "Requisitions" },
                { icon: Wallet, label: "Budgets" },
                { icon: CheckCircle2, label: "Approvals" },
              ].map(({ icon: Icon, label, active }) => (
                <div
                  key={label}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                    active ? "bg-foreground text-background" : "text-foreground/70"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </div>
              ))}
            </nav>
          </aside>

          {/* Main */}
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-foreground/60">Q3 Operating Budget</p>
                <h3 className="font-display text-3xl sm:text-4xl">RM 1.24M remaining</h3>
              </div>
              <div className="rounded-full bg-lime px-4 py-1.5 text-xs font-medium text-lime-foreground">
                On track
              </div>
            </div>

            {/* Budget bar */}
            <div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-background/70">
                <div className="h-full w-[62%] rounded-full bg-foreground" />
              </div>
              <div className="mt-2 flex justify-between text-xs text-foreground/60">
                <span>Spent RM 760K</span>
                <span>Budget RM 2.0M</span>
              </div>
            </div>

            {/* Recent requisitions */}
            <div className="rounded-2xl bg-background/60 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Recent requisitions</h4>
                <span className="text-xs text-foreground/50">Last 7 days</span>
              </div>
              <ul className="divide-y divide-border">
                {[
                  {
                    title: "Office supplies — Marketing",
                    amount: "RM 4,250",
                    status: "Approved",
                    tone: "bg-lime text-lime-foreground",
                    Icon: CheckCircle2,
                  },
                  {
                    title: "Vendor payment — CV Bina",
                    amount: "RM 18,900",
                    status: "Pending L2",
                    tone: "bg-foreground/10 text-foreground",
                    Icon: Clock,
                  },
                  {
                    title: "Software license renewal",
                    amount: "RM 32,400",
                    status: "Draft PRF",
                    tone: "bg-background text-foreground border border-border",
                    Icon: FileText,
                  },
                ].map(({ title, amount, status, tone, Icon }) => (
                  <li key={title} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-foreground/60">{amount}</p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs ${tone}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
