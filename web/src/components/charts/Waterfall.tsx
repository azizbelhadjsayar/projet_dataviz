"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Unit } from "@/lib/data/schema";
import { fmtValue } from "@/lib/format";
import { AXIS_TICK, categoryAxis } from "./common";

type Kind = "total" | "up" | "down";
interface Step { label: string; y0: number; lo: number; hi: number; kind: Kind }

const COLOR: Record<Kind, string> = { total: "var(--total-bar)", up: "var(--pos)", down: "var(--neg)" };
const NAME: Record<Kind, string> = { total: "Total", up: "Hausse", down: "Baisse" };

/**
 * Cascade : du total de départ au total d'arrivée, chaque variation flotte au niveau du cumul.
 * Hausse / baisse = paire divergente (bleu / rouge), totaux en gris ; valeur signée au-dessus de chaque barre.
 */
export function Waterfall({ data, unit, metricLabel }: { data: Record<string, string | number | null>[]; unit: Unit; metricLabel: string }) {
  const steps: Step[] = data.map((d) => ({
    label: String(d.label), y0: Number(d.y0), lo: Number(d.lo), hi: Number(d.hi), kind: (d.kind as Kind) ?? "total",
  }));
  const signed = (s: Step) => (s.kind === "total" ? fmtValue(s.y0, unit, true) : `${s.y0 >= 0 ? "+" : "−"}${fmtValue(Math.abs(s.y0), unit, true)}`);
  const rows = steps.map((s) => ({ ...s, range: [s.lo, s.hi] as [number, number], tag: signed(s) }));
  const axis = categoryAxis(steps.map((s) => s.label));
  const min = Math.min(0, ...steps.map((s) => s.lo));

  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {(["up", "down", "total"] as Kind[]).filter((k) => steps.some((s) => s.kind === k)).map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[k] }} /> {NAME[k]}
          </li>
        ))}
      </ul>
      <div style={{ height: 300 + axis.extra }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" tick={axis.tick} height={axis.height} tickLine={false} axisLine={{ stroke: "var(--axis)" }} interval={0} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} domain={[min, "auto"]}
              tickFormatter={(v: number) => (unit === "pct" ? `${v} %` : fmtValue(v, unit, true))} />
            {min < 0 && <ReferenceLine y={0} stroke="var(--axis)" />}
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload }) => {
                const s = active ? (payload?.[0]?.payload as Step | undefined) : undefined;
                if (!s) return null;
                const after = s.kind === "down" ? s.lo : s.hi;
                return (
                  <div className="pointer-events-none rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-lg">
                    <p className="mb-1 font-medium text-ink">{s.label}</p>
                    <p><span className="tabular font-semibold">{signed(s)}</span> <span className="text-ink-2">{s.kind === "total" ? metricLabel.toLowerCase() : NAME[s.kind].toLowerCase()}</span></p>
                    {s.kind !== "total" && <p className="text-xs text-muted">Cumul après cette étape : {fmtValue(after, unit)}</p>}
                  </div>
                );
              }}
            />
            <Bar dataKey="range" radius={[4, 4, 4, 4]} isAnimationActive={false}>
              {rows.map((s, i) => <Cell key={i} fill={COLOR[s.kind]} />)}
              <LabelList dataKey="tag" position="top" offset={6} fill="var(--ink-2)" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
