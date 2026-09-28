"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useTransition } from "react";
import { FilterSelect } from "./ui/FilterSelect";
import { SegmentedControl } from "./ui/SegmentedControl";

export interface FilterOptions {
  sessions: number[];
  types: string[];
  secteurs: string[];
  selectivites: string[];
  regions: string[];
}

interface Props {
  options: FilterOptions;
  /** Masque le sélecteur de session (pages déjà présentées en évolution). */
  hideSession?: boolean;
}

/** Barre de filtres globale, collante : session (segmentée) + filtres en pastilles ; tout passe par l'URL. */
export function FilterBar({ options, hideSession }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Pendant le rechargement, le contenu reste affiché en opacité réduite (pas de squelette).
  useEffect(() => {
    document.body.classList.toggle("is-pending", pending);
  }, [pending]);

  const push = (next: URLSearchParams) =>
    startTransition(() => router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  const set = (param: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(param, value);
    else next.delete(param);
    next.delete("page");
    push(next);
  };

  const activeCount = ["type", "secteur", "selectivite", "region"].filter((k) => sp.get(k)).length;
  const session = Number(sp.get("session") ?? options.sessions.at(-1));

  return (
    <div className="filter-bar sticky top-16 z-20 mb-6 lg:top-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface/90 p-2 shadow-card backdrop-blur-md">
        {!hideSession && (
          <SegmentedControl
            ariaLabel="Session"
            value={session}
            options={options.sessions.map((s) => ({ value: s, label: String(s) }))}
            onChange={(v) => set("session", String(v))}
          />
        )}
        <span aria-hidden className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <span className="hidden items-center gap-1.5 px-1 text-xs font-medium text-muted md:flex">
          <SlidersHorizontal size={14} /> Filtres
        </span>
        <FilterSelect label="Type" value={sp.get("type") ?? ""} options={options.types} allLabel="Tous" onChange={(v) => set("type", v)} />
        <FilterSelect label="Secteur" value={sp.get("secteur") ?? ""} options={options.secteurs} allLabel="Tous" onChange={(v) => set("secteur", v)} />
        <FilterSelect label="Sélectivité" value={sp.get("selectivite") ?? ""} options={options.selectivites} allLabel="Toutes" onChange={(v) => set("selectivite", v)} />
        <FilterSelect label="Région" value={sp.get("region") ?? ""} options={options.regions} allLabel="France" onChange={(v) => set("region", v)} />
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams();
              const s = sp.get("session");
              if (s) next.set("session", s);
              push(next);
            }}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <RotateCcw size={14} /> Réinitialiser{activeCount > 1 ? ` (${activeCount})` : ""}
          </button>
        )}
        {pending && <span className="sr-only" role="status">Mise à jour…</span>}
      </div>
    </div>
  );
}
