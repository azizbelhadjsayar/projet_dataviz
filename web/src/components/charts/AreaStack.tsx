"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Unit } from "@/lib/data/schema";
import { fmtValue } from "@/lib/format";
import { AXIS_TICK, ChartTooltip, Legend, type Series } from "./common";

interface Props {
  data: Record<string, string | number | null>[];
  series: Series[];
  unit: Unit;
  height?: number;
  yDomain?: [number, number | "auto"];
  hideLegend?: boolean;
}

/**
 * Aires : évolution d'un total et de sa composition (aires empilées, liseré de 2 px entre les couches).
 * Des pourcentages qui ne totalisent pas 100 ne s'empilent pas : aires superposées translucides.
 */
export function AreaStack({ data, series, unit, height = 300, yDomain, hideLegend }: Props) {
  const sums = data.map((d) => series.reduce((a, s) => a + (typeof d[s.key] === "number" ? (d[s.key] as number) : 0), 0));
  const stacked = series.length > 1 && (unit !== "pct" || sums.every((t) => Math.abs(t - 100) < 1.5));
  const temporal = data.every((d) => /^20\d\d$/.test(String(d.label)));

  return (
    <div>
      {!hideLegend && <Legend series={series} />}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--axis)" }} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56}
              domain={yDomain ?? (stacked && unit === "pct" ? [0, 100] : [0, "auto"])}
              tickFormatter={(v: number) => (unit === "pct" ? `${v} %` : fmtValue(v, unit, true))} />
            <Tooltip
              cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
              content={(p) => (
                <ChartTooltip {...p} series={stacked ? [...series].reverse() : series} unit={unit}
                  title={(l) => (temporal ? `Session ${l}` : String(l ?? ""))} />
              )}
            />
            {series.map((s) => (
              <Area
                key={s.key}
                type="linear"
                dataKey={s.key}
                name={s.label}
                stackId={stacked ? "a" : undefined}
                stroke={stacked ? "var(--surface)" : s.color}
                strokeWidth={2}
                fill={s.color}
                fillOpacity={stacked ? 0.92 : series.length > 1 ? 0.14 : 0.2}
                dot={stacked ? false : { r: 3.5, fill: s.color, stroke: "var(--surface)", strokeWidth: 2 }}
                activeDot={{ r: 4.5, fill: s.color, stroke: "var(--surface)", strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
