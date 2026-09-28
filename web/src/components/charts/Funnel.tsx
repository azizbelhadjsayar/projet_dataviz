"use client";

import { Fragment } from "react";
import type { Unit } from "@/lib/data/schema";
import { fmtPct, fmtValue } from "@/lib/format";

/** Rampe ordinale (étapes successives), du plus foncé au plus clair ; elle reste lisible sur la surface. */
const STAGES = ["var(--ord-5)", "var(--ord-4)", "var(--ord-3)", "var(--ord-2)", "var(--ord-1)"];

/**
 * Entonnoir : étapes successives (ex. vœux → propositions → admis), barres centrées proportionnelles
 * à la 1re étape, taux de passage d'une étape à la suivante entre les barres.
 */
export function Funnel({ data, unit }: { data: Record<string, string | number | null>[]; unit: Unit }) {
  const steps = data.map((d) => ({ label: String(d.label), v: typeof d.y0 === "number" ? d.y0 : 0 }));
  const max = Math.max(...steps.map((s) => s.v), 0);
  const first = steps[0]?.v ?? 0;
  const grid = "grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,6.5rem)] items-center gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,8rem)]";

  return (
    <div>
      {steps.map((s, i) => (
        <Fragment key={s.label}>
          {i > 0 && (
            <div className={grid}>
              <span />
              <p className="tabular py-1 text-center text-[11px] text-muted">
                ↓ {fmtPct(steps[i - 1].v > 0 ? (100 * s.v) / steps[i - 1].v : null)} de l&apos;étape précédente
              </p>
              <span />
            </div>
          )}
          <div className={grid} title={`${s.label} : ${fmtValue(s.v, unit)}`}>
            <span className="truncate text-right text-[13px] text-ink-2" title={s.label}>{s.label}</span>
            <div className="flex justify-center">
              <div className="h-9 rounded-[4px]" style={{ width: `${Math.max(1.5, max > 0 ? (100 * s.v) / max : 0)}%`, background: STAGES[Math.min(i, STAGES.length - 1)] }} />
            </div>
            <p className="leading-tight">
              <span className="tabular block text-sm font-semibold text-ink">{fmtValue(s.v, unit, true)}</span>
              {i > 0 && <span className="tabular block text-[11px] text-muted">{fmtPct(first > 0 ? (100 * s.v) / first : null)} de l&apos;étape 1</span>}
            </p>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
