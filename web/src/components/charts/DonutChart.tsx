"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Unit } from "@/lib/data/schema";
import { fmtPct, fmtValue } from "@/lib/format";

const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];

interface Props {
  data: { label: string; value: number }[];
  unit: Unit;
  metricLabel: string;
}

/**
 * Anneau de répartition (part d'un total) : 6 parts max, « Autres » en gris, total au centre.
 * Légende avec valeurs et pourcentages toujours visibles (les couleurs claires ne portent pas seules le sens).
 */
export function DonutChart({ data, unit, metricLabel }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((a, d) => a + d.value, 0);
  const colorOf = (d: { label: string }, i: number) => (d.label === "Autres" ? "var(--neutral)" : COLORS[i % COLORS.length]);
  const share = (v: number) => (total > 0 ? (100 * v) / total : 0);

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <div className="relative mx-auto aspect-square w-full max-w-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              startAngle={90}
              endAngle={-270}
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((d, i) => (
                <Cell key={d.label} fill={colorOf(d, i)} opacity={active === null || active === i ? 1 : 0.45} />
              ))}
            </Pie>
            <Tooltip
              content={({ active: on, payload }) => {
                const p = on ? (payload?.[0]?.payload as { label: string; value: number } | undefined) : undefined;
                if (!p) return null;
                return (
                  <div className="pointer-events-none rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-lg">
                    <p className="font-medium text-ink">{p.label}</p>
                    <p><span className="tabular font-semibold">{fmtValue(p.value, unit)}</span> <span className="text-ink-2">· {fmtPct(share(p.value))}</span></p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Total au centre de l'anneau */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-muted">Total</span>
          <span className="text-xl font-semibold tracking-tight text-ink">{fmtValue(total, unit, true)}</span>
          <span className="max-w-[60%] truncate text-[11px] text-muted">{metricLabel}</span>
        </div>
      </div>

      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li
            key={d.label}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-center gap-2.5 rounded-md px-2 py-1 ${active === i ? "bg-surface-2" : ""}`}
          >
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm" style={{ background: colorOf(d, i) }} />
            <span className="min-w-0 flex-1 truncate text-ink-2" title={d.label}>{d.label}</span>
            <span className="tabular whitespace-nowrap font-semibold text-ink">{fmtPct(share(d.value))}</span>
            <span className="tabular w-20 whitespace-nowrap text-right text-xs text-muted">{fmtValue(d.value, unit, true)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
