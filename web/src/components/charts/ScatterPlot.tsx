"use client";

import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { Unit } from "@/lib/data/schema";
import { fmtInt, fmtValue } from "@/lib/format";
import { AXIS_TICK, Legend, type Series } from "./common";

export interface Point {
  label: string;
  group?: string;
  x: number;
  y: number;
  n?: number;
  /** Clé du groupe (couleur) quand les points sont colorés par catégorie. */
  seriesKey?: string;
}

interface Props {
  data: Point[];
  xLabel: string;
  yLabel: string;
  xUnit: Unit;
  yUnit: Unit;
  nLabel?: string;
  xLog?: boolean;
  refX?: number | null;
  refY?: number | null;
  height?: number;
  /** Couleur par catégorie (≤ 3 groupes, palette validée tous-couples). */
  groups?: Series[];
  /** Échelles imposées (petits multiples : même échelle dans chaque panneau). */
  xDomain?: [number, number];
  yDomain?: [number, number];
}

export function ScatterPlot({ data, xLabel, yLabel, xUnit, yUnit, nLabel = "formations", xLog, refX, refY, height = 380, groups, xDomain, yDomain }: Props) {
  // Axes ancrés à 0 sauf si des valeurs négatives existent (ex. variations).
  const xNeg = data.some((p) => p.x < 0);
  const yNeg = data.some((p) => p.y < 0);
  const yMax = Math.max(...data.map((p) => p.y));
  const layers = groups?.length ? groups.map((g) => ({ color: g.color, points: data.filter((p) => p.seriesKey === g.key) })) : [{ color: "var(--series-1)", points: data }];
  return (
    <div>
      {groups && groups.length > 1 && <Legend series={groups} />}
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            scale={xLog ? "log" : "auto"}
            domain={xDomain ?? (xLog || xNeg ? ["auto", "auto"] : [0, "auto"])}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: "var(--axis)" }}
            tickFormatter={(v: number) => fmtValue(v, xUnit === "pct" ? "count" : xUnit, true)}
            label={{ value: xLabel, position: "insideBottom", offset: -16, fill: "var(--ink-2)", fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            domain={yDomain ?? (yNeg ? ["auto", "auto"] : [0, yUnit === "pct" && yMax <= 100 ? 100 : "auto"])}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => (yUnit === "pct" ? `${v} %` : fmtValue(v, yUnit, true))}
            label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 12, fill: "var(--ink-2)", fontSize: 12, dy: 60 }}
          />
          {refX != null && <ReferenceLine x={refX} stroke="var(--axis)" />}
          {refY != null && <ReferenceLine y={refY} stroke="var(--axis)" />}
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
              if (!p) return null;
              return (
                <div className="pointer-events-none max-w-72 rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-lg">
                  <p className="mb-1 font-medium text-ink">{p.label}</p>
                  {p.group && <p className="mb-1 text-xs text-ink-2">{p.group}</p>}
                  <p><span className="tabular font-semibold">{fmtValue(p.x, xUnit)}</span> <span className="text-ink-2">{xLabel.toLowerCase()}</span></p>
                  <p><span className="tabular font-semibold">{fmtValue(p.y, yUnit)}</span> <span className="text-ink-2">{yLabel.toLowerCase()}</span></p>
                  {p.n !== undefined && <p className="text-xs text-muted">{fmtInt(p.n)} {nLabel}</p>}
                </div>
              );
            }}
          />
          {layers.map((layer, i) => (
            <Scatter
              key={i}
              data={layer.points}
              isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number }) => (
                <g>
                  {/* zone de survol élargie (24 px) autour d'un point de 10 px */}
                  <circle cx={props.cx} cy={props.cy} r={12} fill="transparent" />
                  <circle cx={props.cx} cy={props.cy} r={5} fill={layer.color} fillOpacity={0.8} stroke="var(--surface)" strokeWidth={2} />
                </g>
              )}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
    </div>
  );
}
