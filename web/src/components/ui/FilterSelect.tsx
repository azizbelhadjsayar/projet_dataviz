"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

interface Props {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  /** Libellé de l'option « pas de filtre ». */
  allLabel: string;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Filtre en pastille : affiche « Libellé : valeur », s'ouvre sur une liste avec recherche (si > 7 choix),
 * navigable au clavier (↑ ↓ Entrée Échap) ; une croix retire le filtre actif.
 */
export function FilterSelect({ label, value, options, onChange, allLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const searchable = options.length > 7;
  const active = !!value;

  const items = useMemo(() => {
    const q = norm(query.trim());
    return ["", ...options].filter((o) => !q || (o && norm(o).includes(q)));
  }, [options, query]);

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };
  const openList = () => {
    setCursor(Math.max(0, ["", ...options].indexOf(value)));
    setQuery("");
    setOpen(true);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); openList(); return; }
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(items.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[cursor] !== undefined) choose(items[cursor]); }
  };

  return (
    <div ref={root} className="relative" onKeyDown={onKey}>
      <div
        className={`flex h-9 items-center rounded-lg border text-sm transition-colors ${
          active ? "border-accent/40 bg-accent-soft text-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
        }`}
      >
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openList())}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          className="flex h-full items-center gap-1.5 rounded-lg pl-3 pr-2"
        >
          <span className={active ? "text-ink-2" : ""}>{label}</span>
          {active && <span className="max-w-40 truncate font-medium text-ink">{value}</span>}
          {!active && <span className="text-muted">· {allLabel}</span>}
          <ChevronDown size={14} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {active && (
          <button type="button" onClick={() => choose("")} aria-label={`Retirer le filtre ${label}`}
            className="mr-1 rounded-md p-1 text-ink-2 hover:bg-surface hover:text-ink">
            <X size={13} />
          </button>
        )}
      </div>

      {open && (
        <div className="animate-fade-up absolute left-0 top-full z-40 mt-1.5 w-72 overflow-hidden rounded-xl border border-line bg-raised shadow-raised">
          {searchable && (
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search size={14} className="text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
                placeholder={`Rechercher ${label.toLowerCase()}…`}
                aria-label={`Rechercher ${label.toLowerCase()}`}
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </div>
          )}
          <ul id={listId} role="listbox" aria-label={label} className="max-h-72 overflow-y-auto p-1">
            {items.map((o, i) => {
              const selected = o === value;
              return (
                <li
                  key={o || "__all"}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setCursor(i)}
                  onMouseDown={(e) => { e.preventDefault(); choose(o); }}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm ${
                    i === cursor ? "bg-surface-2 text-ink" : "text-ink-2"
                  }`}
                >
                  <span className={`truncate ${o ? "" : "text-muted"}`}>{o || allLabel}</span>
                  {selected && <Check size={15} className="shrink-0 text-accent" />}
                </li>
              );
            })}
            {!items.length && <li className="px-2.5 py-3 text-sm text-muted">Aucun résultat</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
