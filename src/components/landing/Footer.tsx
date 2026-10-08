import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer id="contact" className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
      <div className="flex flex-col items-start justify-between gap-6 border-t border-border pt-8 md:flex-row md:items-center">
        <Link to="/" className="inline-flex items-center">
          <img
            src="/unikl-official.png"
            alt="UniKL — Universiti Kuala Lumpur, Royal College of Medicine Perak"
            className="h-9 w-auto sm:h-12"
          />
        </Link>
        <p className="text-xs text-foreground/50">
          © {new Date().getFullYear()} UniKL Royal College Of Medicine. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
