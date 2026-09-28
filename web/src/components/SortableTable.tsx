"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Unit } from "@/lib/data/schema";
import { fmtValue } from "@/lib/format";

export interface Column {
  key: string;
  label: string;
  unit?: Unit;
}

type Row = Record<string, string | number | null>;

interface Props {
  columns: Column[];
  rows: Row[];
  initialSort?: string;
  maxHeight?: number;
  /** Rendu personnalisé de la 1re colonne (lien, etc.). */
  renderFirst?: (row: Row) => ReactNode;
}

/** Tableau triable (clic sur l'en-tête), valeurs formatées selon l'unité. */
export function SortableTable({ columns, rows, initialSort, maxHeight = 520, renderFirst }: Props) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: initialSort ?? columns[1]?.key ?? columns[0].key, dir: -1 });
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fr")) * sort.dir;
    });
  }, [rows, sort]);

  return (
    <div className="overflow-auto rounded-lg" style={{ maxHeight }}>
      <table className="tabular w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr>
            {columns.map((c, i) => {
              const active = sort.key === c.key;
              return (
                <th
                  key={c.key}
                  aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                  className={`whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-ink-2 ${i ? "text-right" : "text-left"}`}
                >
                  <button
                    type="button"
                    onClick={() => setSort({ key: c.key, dir: active ? (sort.dir === 1 ? -1 : 1) : c.unit ? -1 : 1 })}
                    className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
                  >
                    {c.label}
                    <span aria-hidden className="text-[10px] text-muted">{active ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i} className="border-b border-grid last:border-0 hover:bg-surface-2/60">
              {columns.map((c, j) => (
                <td key={c.key} className={`px-3 py-2 ${j ? "whitespace-nowrap text-right text-ink-2" : "text-left text-ink"}`}>
                  {j === 0 && renderFirst ? renderFirst(r) : c.unit ? fmtValue(r[c.key] as number | null, c.unit) : (r[c.key] ?? "–")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
