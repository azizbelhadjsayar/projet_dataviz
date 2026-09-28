"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Unit } from "@/lib/data/schema";
import { fmtValue } from "@/lib/format";
import { ColumnChart } from "./ColumnChart";
import { AXIS_TICK, ChartTooltip, Legend, type Series } from "./common";

interface Props {
  id: string;
  data: Record<string, string | number | null>[];
  bar: Series;
  line: Series;
  unit: Unit;
  unit2: Unit;
}

const unitName = (u: Unit) => (u === "pct" ? "%" : u === "ratio" ? "ratio" : "effectif");

/**
 * Graphique combiné « barres + courbe » pour deux indicateurs d'unités différentes :
 * deux panneaux alignés sur le même axe X (mêmes marges, même placement en bandes), infobulle synchronisée.
 * Chaque indicateur garde sa propre échelle sans superposer deux axes Y (qui suggérerait une corrélation arbitraire).
 */
export function ComboChart({ id, data, bar, line, unit, unit2 }: Props) {
  const syncId = `combo-${id}`;
  return (
    <div>
      <Legend series={[bar, line]} />
      <p className="mb-1 text-[11px] font-medium text-muted">{bar.label} ({unitName(unit)})</p>
      <ColumnChart data={data} series={[bar]} unit={unit} height={190} hideLegend syncId={syncId} hideXAxis />
      <p className="mb-1 mt-3 text-[11px] font-medium text-muted">{line.label} ({unitName(unit2)})</p>
      <div style={{ height: 170 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} syncId={syncId} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--axis)" }} interval={0} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} domain={["auto", "auto"]}
              tickFormatter={(v: number) => (unit2 === "pct" ? `${v} %` : fmtValue(v, unit2, true))} />
            <Tooltip cursor={{ stroke: "var(--axis)" }} content={(p) => <ChartTooltip {...p} series={[line]} unit={unit2} />} />
            {/* Barre invisible : impose le placement en bandes, donc des points centrés sous les barres du haut. */}
            <Bar dataKey={line.key} fill="transparent" legendType="none" isAnimationActive={false} />
            <Line dataKey={line.key} name={line.label} stroke={line.color} strokeWidth={2} isAnimationActive={false}
              dot={{ r: 4, fill: line.color, stroke: "var(--surface)", strokeWidth: 2 }} activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
