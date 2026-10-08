const steps = [
  {
    n: "01",
    title: "Submit",
    body: "Staff files a requisition with amount, category, and cost center.",
  },
  {
    n: "02",
    title: "Approve",
    body: "Reviewers approve in order. PRF is generated on final sign-off.",
  },
  {
    n: "03",
    title: "Track",
    body: "Balances, commitments, and spend update live across the department.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="mb-10 max-w-2xl sm:mb-14">
        <p className="text-sm uppercase tracking-widest text-foreground/50">How it works</p>
        <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl md:text-6xl">
          Three moves from request to receipt.
        </h2>
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="border-t border-foreground pt-6">
            <div className="font-display text-xl text-foreground/50">{s.n}</div>
            <h3 className="mt-2 font-display text-4xl">{s.title}</h3>
            <p className="mt-3 text-foreground/70">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
