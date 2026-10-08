import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function CtaBand() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="rounded-[2rem] bg-foreground px-5 py-14 text-center text-background sm:rounded-[2.5rem] sm:px-8 sm:py-20 md:py-28">
        <h2 className="mx-auto max-w-3xl font-display text-4xl leading-tight sm:text-5xl md:text-7xl">
          Ready to take control of your budget?
        </h2>
        <div className="mt-10 flex justify-center">
          <Link
            to="/login"
            className="group inline-flex max-w-full items-center justify-center gap-3 rounded-full bg-lime px-5 py-3 text-sm font-medium text-lime-foreground transition hover:brightness-95 sm:px-7 sm:py-4 sm:text-base"
          >
            Sign in to Budget Tracker
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
