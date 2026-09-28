import type { Unit } from "./data/schema";

const int = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const compactFmt = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

export const fmtInt = (v: number | null | undefined) => (v === null || v === undefined ? "–" : int.format(v));
export const fmtCompact = (v: number | null | undefined) => (v === null || v === undefined ? "–" : compactFmt.format(v));
export const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${one.format(v)} %`);
export const fmtRatio = (v: number | null | undefined) => (v === null || v === undefined ? "–" : one.format(v));

export function fmtValue(v: number | null | undefined, unit: Unit, compact = false) {
  if (unit === "pct") return fmtPct(v);
  if (unit === "ratio") return fmtRatio(v);
  return compact ? fmtCompact(v) : fmtInt(v);
}

/** Variation : % relatif pour les effectifs, points pour les pourcentages. */
export function fmtDelta(cur: number | null, prev: number | null, unit: Unit) {
  if (cur === null || prev === null || prev === 0) return null;
  if (unit === "pct") {
    const d = cur - prev;
    return { value: d, text: `${d >= 0 ? "+" : "−"}${one.format(Math.abs(d))} pt` };
  }
  const d = (100 * (cur - prev)) / prev;
  return { value: d, text: `${d >= 0 ? "+" : "−"}${one.format(Math.abs(d))} %` };
}
