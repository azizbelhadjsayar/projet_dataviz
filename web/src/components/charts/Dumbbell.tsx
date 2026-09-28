"use client";

import type { Unit } from "@/lib/data/schema";
import { fmtDelta, fmtValue } from "@/lib/format";
import { FloatingTip, useTip, type Series } from "./common";

/** Graduations « rondes » (1, 2, 5 × 10ⁿ) couvrant [lo, hi]. */
function niceScale(lo: number, hi: number, n = 4) {
  const raw = (hi - lo) / n || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 1e6; v += step) ticks.push(Number(v.toFixed(10)));
  return { lo: start, hi: end, ticks };
}

interface Props {
  data: Record<string, string | number | null>[];
  /** Deux séries : valeur de départ (y0) et d'arrivée (y1). */
  series: Series[];
  unit: Unit;
}

/**
 * Haltères : deux valeurs par catégorie (ex. 2021 et 2025) reliées par un trait ; la position compte,
 * pas la longueur, donc l'échelle est resserrée sur les données. Valeurs écrites aux deux extrémités.
 */
export function Dumbbell({ data, series, unit }: Props) {
  const { ref, tip, bind } = useTip<{ label: string; a: number; b: number }>();
  const [s0, s1] = series;
  const vals = data.flatMap((d) => [d.y0, d.y1]).filter((v): v is number => typeof v === "number");
  const vmin = Math.min(...vals), vmax = Math.max(...vals);
  const pad = (vmax - vmin) * 0.15 || Math.abs(vmax) * 0.1 || 1;
  const scale = niceScale(vmin >= 0 ? Math.max(0, vmin - pad) : vmin - pad, vmax + pad);
  const pos = (v: number) => (100 * (v - scale.lo)) / (scale.hi - scale.lo || 1);
  const fmt = (v: number) => fmtValue(v, unit, true);

  return (
    <div ref={ref} className="relative">
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {[s0, s1].map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.label}
          </li>
        ))}
      </ul>
      <div className="space-y-0.5">
        {data.map((d) => {
          const a = d.y0 as number, b = d.y1 as number;
          const label = String(d.label);
          const left = Math.min(pos(a), pos(b)), right = Math.max(pos(a), pos(b));
          const aLeft = a <= b;
          return (
            <div key={label} {...bind({ label, a, b })}
              className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-center gap-3 rounded-md hover:bg-surface-2/70 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
              <span className="truncate py-1.5 text-right text-[13px] text-ink-2" title={label}>{label}</span>
              <div className="relative mx-10 h-8">
                {scale.ticks.map((t) => (
                  <span key={t} aria-hidden className="absolute inset-y-0 w-px bg-grid" style={{ left: `${pos(t)}%` }} />
                ))}
                <span aria-hidden className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded bg-axis" style={{ left: `${left}%`, width: `${right - left}%` }} />
                {[{ v: a, s: s0 }, { v: b, s: s1 }].map(({ v, s }) => (
                  <span key={s.key} aria-hidden className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
                    style={{ left: `${pos(v)}%`, background: s.color }} />
                ))}
                <span className="tabular absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] text-ink-2" style={{ right: `calc(${100 - left}% + 10px)` }}>
                  {fmt(aLeft ? a : b)}
                </span>
                <span className="tabular absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold text-ink" style={{ left: `calc(${right}% + 10px)` }}>
                  {fmt(aLeft ? b : a)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {/* Graduations communes */}
      <div className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <span />
        <div className="relative mx-10 h-5 border-t border-axis">
          {scale.ticks.map((t) => (
            <span key={t} className="tabular absolute top-1 -translate-x-1/2 text-[11px] text-muted" style={{ left: `${pos(t)}%` }}>
              {unit === "pct" ? `${t} %` : fmt(t)}
            </span>
          ))}
        </div>
      </div>
      {tip && (
        <FloatingTip {...tip}>
          <p className="mb-1 font-medium text-ink">{tip.item.label}</p>
          {[{ v: tip.item.a, s: s0 }, { v: tip.item.b, s: s1 }].map(({ v, s }) => (
            <p key={s.key} className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
              <span className="tabular font-semibold text-ink">{fmtValue(v, unit)}</span>
              <span className="text-ink-2">{s.label}</span>
            </p>
          ))}
          {fmtDelta(tip.item.b, tip.item.a, unit) && (
            <p className="mt-1 text-xs text-muted">Écart : {fmtDelta(tip.item.b, tip.item.a, unit)!.text}</p>
          )}
        </FloatingTip>
      )}
    </div>
  );
}
