"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Unit } from "@/lib/data/schema";
import { fmtValue } from "@/lib/format";
import { AXIS_TICK, categoryAxis, ChartTooltip, Legend, type Series } from "./common";

interface Props {
  data: Record<string, string | number | null>[];
  series: Series[];
  unit: Unit;
  stacked?: boolean;
  height?: number;
  yDomain?: [number, number | "auto"];
  /** Masque la légende (petits multiples : légende commune au-dessus). */
  hideLegend?: boolean;
  syncId?: string;
  hideXAxis?: boolean;
}

/** Barres verticales (colonnes) groupées ou empilées ; valeur au sommet pour une seule série. */
export function ColumnChart({ data, series, unit, stacked = false, height = 280, yDomain, hideLegend, syncId, hideXAxis }: Props) {
  const single = series.length === 1;
  const axis = categoryAxis(data.map((d) => String(d.label ?? "")));
  const barSize = stacked || single ? Math.min(24, Math.max(8, 360 / Math.max(1, data.length))) : Math.min(14, Math.max(5, 200 / Math.max(1, data.length * series.length)));
  return (
    <div>
      {!hideLegend && <Legend series={series} />}
      <div style={{ height: height + (hideXAxis ? 0 : axis.extra) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: single ? 18 : 6, right: 8, bottom: 0, left: 0 }} barGap={2} syncId={syncId}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" tick={axis.tick} height={axis.height} tickLine={false} axisLine={{ stroke: "var(--axis)" }} hide={hideXAxis} interval={0} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52}
              domain={yDomain ?? (stacked && unit === "pct" ? [0, 100] : [0, "auto"])}
              tickFormatter={(v: number) => (unit === "pct" ? `${v} %` : fmtValue(v, unit, true))} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={(p) => <ChartTooltip {...p} series={series} unit={unit} />} />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                barSize={barSize}
                stackId={stacked ? "a" : undefined}
                radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
                stroke={stacked ? "var(--surface)" : undefined}
                strokeWidth={stacked ? 2 : 0}
                isAnimationActive={false}
              >
                {single && (
                  <LabelList dataKey={s.key} position="top" offset={6} fill="var(--ink-2)" fontSize={11}
                    formatter={(v: unknown) => fmtValue(v as number | null, unit, true)} />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
