"use client";

import { useState } from "react";
import type { Unit } from "@/lib/data/schema";
import { fmtValue } from "@/lib/format";
import { Legend, type Series } from "./common";

interface Props {
  facets: { label: string; data: Record<string, string | number | null>[] }[];
  facetLabel?: string;
  series: Series[];
  unit: Unit;
  stacked?: boolean;
}

/**
 * Petits multiples en barres, à la Tableau : catégories en lignes (libellés partagés à gauche),
 * un panneau par valeur de séparation en colonnes, en-têtes en haut, même échelle pour tous.
 */
export function FacetBars({ facets, facetLabel, series, unit, stacked = false }: Props) {
  const [hover, setHover] = useState<{ cat: string; facet: string } | null>(null);
  const categories = [...new Set(facets.flatMap((f) => f.data.map((d) => String(d.label))))];
  const valueOf = (facet: number, cat: string, key: string) => {
    const v = facets[facet].data.find((d) => String(d.label) === cat)?.[key];
    return typeof v === "number" ? v : null;
  };
  // Échelle commune : maximum global (somme des séries si empilé)
  let max = 0;
  facets.forEach((_, fi) => categories.forEach((cat) => {
    const vals = series.map((s) => Math.max(0, valueOf(fi, cat, s.key) ?? 0));
    max = Math.max(max, stacked ? vals.reduce((a, b) => a + b, 0) : Math.max(...vals));
  }));
  if (unit === "pct" && max <= 100) max = 100;
  const pctOf = (v: number | null) => (v === null || max <= 0 ? 0 : (100 * Math.max(0, v)) / max);
  const single = series.length === 1;

  return (
    <div>
      <Legend series={series} />
      <div className="overflow-x-auto">
        <table className="tabular w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface pb-2 pr-3 text-left font-medium text-muted">{facetLabel ?? ""}</th>
              {facets.map((f) => (
                <th key={f.label} className="min-w-32 border-l border-grid px-3 pb-2 text-left text-[0.8125rem] font-semibold text-ink">{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat} className={hover?.cat === cat ? "bg-surface-2/60" : ""}>
                <th scope="row" className="sticky left-0 z-10 max-w-52 truncate bg-surface py-1.5 pr-3 text-left font-normal text-ink-2" title={cat}>{cat}</th>
                {facets.map((f, fi) => {
                  const vals = series.map((s) => valueOf(fi, cat, s.key));
                  const tip = `${cat} · ${f.label}\n${series.map((s, k) => `${s.label} : ${fmtValue(vals[k], unit)}`).join("\n")}`;
                  return (
                    <td
                      key={f.label}
                      className="border-l border-grid px-3 py-1.5"
                      title={tip}
                      onMouseEnter={() => setHover({ cat, facet: f.label })}
                      onMouseLeave={() => setHover(null)}
                    >
                      {stacked ? (
                        <div className="flex h-3 items-center gap-[2px]">
                          {series.map((s, k) => vals[k] ? (
                            <span key={s.key} className="block h-3 first:rounded-l-[2px] last:rounded-r-[4px]" style={{ width: `${pctOf(vals[k])}%`, background: s.color }} />
                          ) : null)}
                        </div>
                      ) : (
                        <div className="space-y-[2px]">
                          {series.map((s, k) => (
                            <div key={s.key} className="flex items-center gap-1.5">
                              <span className="block shrink-0 rounded-r-[4px]" style={{ width: `${pctOf(vals[k])}%`, minWidth: vals[k] ? 2 : 0, height: single ? 12 : 7, background: s.color }} />
                              {single && <span className="whitespace-nowrap text-[11px] text-ink-2">{fmtValue(vals[k], unit, true)}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted">Même échelle dans tous les panneaux (0 – {fmtValue(max, unit, true)}). Survolez une cellule pour les valeurs.</p>
    </div>
  );
}
