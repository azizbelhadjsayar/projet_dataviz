"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Unit } from "@/lib/data/schema";
import { fmtValue } from "@/lib/format";
import { AXIS_TICK, ChartTooltip, Legend, type Series } from "./common";

interface Props {
  data: Record<string, number | null>[];
  series: Series[];
  unit: Unit;
  xKey?: string;
  height?: number;
  /** Ligne de référence horizontale (ex. 100 pour un indice base 100). */
  reference?: number;
  yDomain?: [number | "auto" | "dataMin" | "dataMax", number | "auto" | "dataMin" | "dataMax"];
  /** Repères verticaux annotés (ex. rupture de définition en 2021). */
  annotations?: { x: number | string; label: string }[];
  /** Petits multiples : pas de légende ni d'étiquettes de fin (légende commune au-dessus des panneaux). */
  hideLegend?: boolean;
}

/** Courbes d'évolution sur un seul axe, infobulle avec réticule listant toutes les séries. */
export function TrendChart({ data, series, unit, xKey = "session", height = 280, reference, yDomain, annotations, hideLegend }: Props) {
  // Étiquettes de fin de ligne seulement si elles ne se chevauchent pas ; sinon légende + infobulle.
  const last = data.at(-1);
  const vals = series.map((s) => last?.[s.key]).filter((v): v is number => typeof v === "number");
  const all = data.flatMap((d) => series.map((s) => d[s.key])).filter((v): v is number => typeof v === "number");
  const range = Math.max(...all) - Math.min(...all) || 1;
  const sorted = [...vals].sort((a, b) => a - b);
  const endLabels = !hideLegend && series.length <= 4 && sorted.every((v, i) => i === 0 || (v - sorted[i - 1]) / range > 0.08);

  return (
    <div>
      {!hideLegend && <Legend series={series} shape="line" />}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: endLabels && series.length > 1 ? 96 : 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey={xKey} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--axis)" }} padding={{ left: 12, right: 12 }} />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={56}
              domain={yDomain ?? ["auto", "auto"]}
              tickFormatter={(v: number) => fmtValue(v, unit === "pct" ? "count" : unit, true)}
            />
            {reference !== undefined && <ReferenceLine y={reference} stroke="var(--axis)" />}
            {annotations?.map((a) => (
              <ReferenceLine key={String(a.x)} x={a.x} stroke="var(--axis)"
                label={{ value: a.label, position: "insideTopLeft", fill: "var(--muted)", fontSize: 11, offset: 6 }} />
            ))}
            <Tooltip
              cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
              content={(p) => <ChartTooltip {...p} series={series} unit={unit} title={(l) => (xKey === "session" || /^20\d\d$/.test(String(l)) ? `Session ${l}` : String(l ?? ""))} />}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                dot={{ r: 4, fill: s.color, stroke: "var(--surface)", strokeWidth: 2 }}
                activeDot={{ r: 5, fill: s.color, stroke: "var(--surface)", strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls
                label={
                  endLabels && series.length > 1
                    ? (props: { index?: number; x?: number | string; y?: number | string }) =>
                        props.index === data.length - 1 ? (
                          <text x={Number(props.x) + 10} y={Number(props.y)} dy={4} fontSize={12} fill="var(--ink-2)">
                            {s.label}
                          </text>
                        ) : null
                    : undefined
                }
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
