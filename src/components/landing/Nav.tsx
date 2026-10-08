import { Link } from "@tanstack/react-router";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center ${className}`}>
      <img
        src="/unikl-official.png"
        alt="Budget Tracker — UniKL Royal College Of Medicine Perak"
        className="h-9 w-auto sm:h-12"
      />
    </Link>
  );
}

export function Nav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-6">
        <Wordmark />
        <nav className="hidden items-center gap-8 text-sm text-foreground/80 md:flex">
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#how" className="hover:text-foreground">
            How it works
          </a>
          <a href="#contact" className="hover:text-foreground">
            Contact
          </a>
        </nav>
        <Link
          to="/login"
          className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}
