"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Unit } from "@/lib/data/schema";
import { fmtValue } from "@/lib/format";
import { AXIS_TICK, ChartTooltip, Legend, truncate, type Series } from "./common";

interface Props {
  data: Record<string, string | number | null>[];
  series: Series[];
  unit: Unit;
  labelKey?: string;
  labelWidth?: number;
  /** Stack à 100 % (parts) au lieu de barres groupées. */
  stacked?: boolean;
  xDomain?: [number, number | "auto" | "dataMax"];
}

/** Barres horizontales : une série (valeur en bout de barre), plusieurs séries groupées, ou empilées à 100 %. */
export function HBarChart({ data, series, unit, labelKey = "label", labelWidth = 170, stacked = false, xDomain }: Props) {
  const single = series.length === 1;
  const barSize = stacked || single ? 16 : 10;
  const rowHeight = stacked || single ? 30 : 12 * series.length + 14;
  const height = Math.max(120, data.length * rowHeight + 32);
  const maxChars = Math.round(labelWidth / 6.8);

  return (
    <div>
      <Legend series={series} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: single ? 64 : 16, bottom: 0, left: 0 }}
            barGap={2}
            barCategoryGap={stacked || single ? 7 : 6}
          >
            <CartesianGrid horizontal={false} stroke="var(--grid)" />
            <XAxis
              type="number"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              domain={stacked && unit === "pct" ? [0, 100] : xDomain ?? [0, "auto"]}
              tickFormatter={(v: number) => (unit === "pct" ? `${v} %` : fmtValue(v, unit, true))}
            />
            <YAxis
              type="category"
              dataKey={labelKey}
              width={labelWidth}
              tick={{ ...AXIS_TICK, fill: "var(--ink-2)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--axis)" }}
              tickFormatter={(v: string) => truncate(v, maxChars)}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={(p) => <ChartTooltip {...p} series={series} unit={unit} />}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                barSize={barSize}
                stackId={stacked ? "a" : undefined}
                radius={stacked ? (i === series.length - 1 ? [0, 4, 4, 0] : 0) : [0, 4, 4, 0]}
                stroke={stacked ? "var(--surface)" : undefined}
                strokeWidth={stacked ? 2 : 0}
                isAnimationActive={false}
              >
                {single && (
                  <LabelList
                    dataKey={s.key}
                    position="right"
                    offset={6}
                    fill="var(--ink-2)"
                    fontSize={12}
                    formatter={(v: unknown) => fmtValue(v as number | null, unit, true)}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
