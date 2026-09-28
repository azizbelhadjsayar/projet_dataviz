"use client";

import type { Unit } from "@/lib/data/schema";
import { fmtValue } from "@/lib/format";

interface Props {
  rows: string[];
  cols: string[];
  values: (number | null)[][];
  rowLabel: string;
  colLabel: string;
  unit: Unit;
  metricLabel: string;
}

const STEPS = 6;

/** Tableau croisé coloré (rampe séquentielle à une teinte), valeurs lisibles dans chaque cellule. */
export function Heatmap({ rows, cols, values, rowLabel, colLabel, unit, metricLabel }: Props) {
  const flat = values.flat().filter((v): v is number => v !== null);
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const step = (v: number) => (max === min ? 3 : 1 + Math.min(STEPS - 1, Math.floor(((v - min) / (max - min)) * STEPS)));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="tabular w-full border-separate border-spacing-[2px] text-xs">
          <thead>
            <tr>
              <th className="pb-1 pr-2 text-left font-medium text-muted">{rowLabel} \ {colLabel}</th>
              {cols.map((c) => <th key={c} className="px-1 pb-1 text-center text-[0.8125rem] font-semibold text-ink">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r}>
                <th scope="row" className="max-w-56 truncate pr-2 text-left font-normal text-ink-2" title={r}>{r}</th>
                {cols.map((c, j) => {
                  const v = values[i][j];
                  const k = v === null ? 0 : step(v);
                  return (
                    <td
                      key={c}
                      title={`${r} · ${c} : ${fmtValue(v, unit)}`}
                      className={`heat-cell heat-${k} min-w-14 rounded-[4px] px-2 py-1.5 text-center font-medium`}
                    >
                      {fmtValue(v, unit, true)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <span>{metricLabel}</span>
        <span className="tabular">{fmtValue(min, unit, true)}</span>
        <span className="flex gap-[2px]">
          {Array.from({ length: STEPS }, (_, i) => <span key={i} className={`heat-${i + 1} block h-2.5 w-6 first:rounded-l-full last:rounded-r-full`} />)}
        </span>
        <span className="tabular">{fmtValue(max, unit, true)}</span>
      </div>
    </div>
  );
}
