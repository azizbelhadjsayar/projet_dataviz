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
  /** Bulles : valeur de l'indicateur de taille (surface proportionnelle). */
  z?: number;
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
  /** Bulles : libellé de l'indicateur de taille (points avec `z`). */
  sizeLabel?: string;
}

export function ScatterPlot({ data, xLabel, yLabel, xUnit, yUnit, nLabel = "formations", xLog, refX, refY, height = 380, groups, xDomain, yDomain, sizeLabel }: Props) {
  // Axes ancrés à 0 sauf si des valeurs négatives existent (ex. variations).
  const xNeg = data.some((p) => p.x < 0);
  const yNeg = data.some((p) => p.y < 0);
  const yMax = Math.max(...data.map((p) => p.y));
  // Bulles : rayon ∝ √valeur (surface proportionnelle), grandes bulles dessinées d'abord.
  const zMax = sizeLabel ? Math.max(0, ...data.map((p) => p.z ?? 0)) : 0;
  const radius = (p: Point) => (zMax > 0 ? 4 + 22 * Math.sqrt(Math.max(0, p.z ?? 0) / zMax) : 5);
  const ordered = zMax > 0 ? [...data].sort((a, b) => (b.z ?? 0) - (a.z ?? 0)) : data;
  const layers = groups?.length ? groups.map((g) => ({ color: g.color, points: ordered.filter((p) => p.seriesKey === g.key) })) : [{ color: "var(--series-1)", points: ordered }];
  return (
    <div>
      {groups && groups.length > 1 && <Legend series={groups} />}
      {zMax > 0 && <p className="mb-1 text-xs text-muted">Taille des bulles : {sizeLabel?.toLowerCase()} (surface proportionnelle, jusqu&apos;à {fmtValue(zMax, "count", true)}).</p>}
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
                  {sizeLabel && p.z !== undefined && <p><span className="tabular font-semibold">{fmtValue(p.z, "count")}</span> <span className="text-ink-2">{sizeLabel.toLowerCase()}</span></p>}
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
              shape={(props: { cx?: number; cy?: number; payload?: Point }) => {
                const r = props.payload ? radius(props.payload) : 5;
                return (
                  <g>
                    {/* zone de survol élargie autour du point */}
                    <circle cx={props.cx} cy={props.cy} r={Math.max(12, r + 4)} fill="transparent" />
                    <circle cx={props.cx} cy={props.cy} r={r} fill={layer.color} fillOpacity={zMax > 0 ? 0.6 : 0.8} stroke="var(--surface)" strokeWidth={zMax > 0 ? 1.5 : 2} />
                  </g>
                );
              }}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
    </div>
  );
}
