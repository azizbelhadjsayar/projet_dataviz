"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/** Recherche instantanée : l'URL (?q=) est mise à jour 300 ms après la dernière frappe. */
export function SearchBox({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim() === (sp.get("q") ?? "")) return;
      const next = new URLSearchParams(sp.toString());
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      next.delete("page");
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
  }, [q, sp, router, pathname]);

  return (
    <div className="mb-4">
      <label className="group relative block">
        <span className="sr-only">Rechercher une formation</span>
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une formation, un établissement, une ville… (ex. informatique Lyon, IUT Nantes)"
          className="h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-24 text-[0.9375rem] text-ink shadow-card outline-none transition-shadow placeholder:text-muted focus:border-accent/50 focus:shadow-raised [&::-webkit-search-cancel-button]:hidden"
        />
        <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 text-xs text-muted">
          {pending ? <LoaderCircle size={15} className="animate-spin-slow" /> : <span className="tabular hidden sm:inline">{total.toLocaleString("fr-FR")} résultat{total > 1 ? "s" : ""}</span>}
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Effacer la recherche" className="rounded-md p-1 hover:bg-surface-2 hover:text-ink">
              <X size={15} />
            </button>
          )}
        </span>
      </label>
    </div>
  );
}
