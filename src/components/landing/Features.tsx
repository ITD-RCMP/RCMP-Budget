import { FileText, FilePlus2, GitBranch, Activity } from "lucide-react";

const features = [
  {
    icon: FilePlus2,
    title: "Requisition submission",
    body: "Employees file structured requests in seconds — with attachments, category, and cost center baked in.",
  },
  {
    icon: FileText,
    title: "PRF generator",
    body: "Auto-compose Payment Request Forms from approved requisitions. Numbered, dated, and print-ready.",
  },
  {
    icon: GitBranch,
    title: "Layered approvals",
    body: "Configure multi-step routes by amount, department, or role. Escalate when reviewers are away.",
  },
  {
    icon: Activity,
    title: "Real-time budget",
    body: "See committed, pending, and available balances update the moment an approval lands.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="mb-10 max-w-2xl sm:mb-14">
        <p className="text-sm uppercase tracking-widest text-foreground/50">Features</p>
        <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl md:text-6xl">
          Everything a department needs, nothing it doesn't.
        </h2>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {features.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="group rounded-3xl border border-border bg-ivory p-6 transition hover:bg-lime/40 sm:p-8"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-6 font-display text-3xl">{title}</h3>
            <p className="mt-3 max-w-sm text-foreground/70">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
