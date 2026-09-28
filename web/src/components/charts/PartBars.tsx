"use client";

import type { Unit } from "@/lib/data/schema";
import { fmtPct, fmtValue } from "@/lib/format";
import { FloatingTip, Legend, useTip, type Series } from "./common";

interface Props {
  /** Lignes normalisées : part (%) par clé de série, valeur d'origine dans `<clé>_raw`. */
  data: Record<string, string | number | null>[];
  series: Series[];
  rawUnit: Unit;
}

/**
 * Barres horizontales à 100 % (parts d'un tout) : segments séparés de 2 px, part écrite dans le segment
 * quand elle tient. Une seule barre = « barre de répartition », avec la légende chiffrée en dessous.
 */
export function PartBars({ data, series, rawUnit }: Props) {
  const { ref, tip, bind } = useTip<{ row: string; s: Series; pct: number; raw: number | null }>();
  const single = data.length === 1;

  return (
    <div ref={ref} className="relative">
      {!single && <Legend series={series} />}
      <div className={single ? "" : "space-y-2"}>
        {data.map((d) => {
          const label = String(d.label ?? "");
          return (
            <div key={label} className={single ? "" : "grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]"}>
              {!single && <span className="truncate text-right text-[13px] text-ink-2" title={label}>{label}</span>}
              <div className={`flex w-full gap-[2px] ${single ? "h-11" : "h-7"}`}>
                {series.map((s) => {
                  const v = d[s.key];
                  if (typeof v !== "number" || v <= 0) return null;
                  const raw = d[`${s.key}_raw`];
                  return (
                    <div
                      key={s.key}
                      {...bind({ row: label, s, pct: v, raw: typeof raw === "number" ? raw : null })}
                      className="flex min-w-0 items-center justify-center overflow-hidden transition-opacity first:rounded-l-[4px] last:rounded-r-[4px] hover:opacity-85"
                      style={{ flex: `${v} 1 0`, background: s.color, color: s.ink }}
                    >
                      {v >= (single ? 5 : 8) && <span className="tabular truncate px-1 text-[11px] font-semibold">{fmtPct(v)}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {single && (
        <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {series.map((s) => {
            const v = data[0][s.key];
            const raw = data[0][`${s.key}_raw`];
            return (
              <li key={s.key} className="flex items-center gap-2.5">
                <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-ink-2" title={s.label}>{s.label}</span>
                <span className="tabular whitespace-nowrap font-semibold text-ink">{fmtPct(typeof v === "number" ? v : null)}</span>
                <span className="tabular w-16 whitespace-nowrap text-right text-xs text-muted">{fmtValue(typeof raw === "number" ? raw : null, rawUnit, true)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {tip && (
        <FloatingTip {...tip}>
          {!single && <p className="mb-1 text-xs font-medium text-ink-2">{tip.item.row}</p>}
          <p className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: tip.item.s.color }} />
            <span className="text-ink">{tip.item.s.label}</span>
          </p>
          <p className="mt-0.5">
            <span className="tabular font-semibold text-ink">{fmtPct(tip.item.pct)}</span>
            {tip.item.raw !== null && <span className="tabular text-ink-2"> · {fmtValue(tip.item.raw, rawUnit)}</span>}
          </p>
        </FloatingTip>
      )}
    </div>
  );
}
