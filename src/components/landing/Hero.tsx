import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Underline } from "./Underline";

export function Hero() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-12 pb-10 text-center sm:px-6 sm:pt-16 md:pt-28 md:pb-16">
      <h1 className="mx-auto max-w-5xl font-display text-4xl leading-[1.05] tracking-tight text-foreground sm:text-6xl md:text-8xl">
        Track every ringgit,
        <br />
        approve in
        <span className="relative mx-3 inline-block">
          <span>seconds</span>
          <Underline className="absolute -bottom-3 left-0 h-4 w-full md:-bottom-4 md:h-5" />
        </span>
      </h1>
      <p className="mx-auto mt-10 max-w-xl text-base text-foreground/70 md:text-lg">
        The department budget tracker for requisitions, PRFs, multi-layer approvals,
        and real-time budget visibility.
      </p>
      <div className="mt-10 flex justify-center">
        <Link
          to="/login"
          className="group inline-flex items-center gap-3 rounded-full bg-lime px-7 py-4 text-base font-medium text-lime-foreground shadow-card transition hover:brightness-95"
        >
          Get started
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background transition group-hover:translate-x-0.5">
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
      <p className="mt-6 text-sm text-foreground/60">
        Created by Information Technology Department of UniKL Royal College Of Medicine
      </p>
    </section>
  );
}
