"use client";

import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Unit } from "@/lib/data/schema";
import { fmtValue } from "@/lib/format";
import { ColumnChart } from "./ColumnChart";
import { AXIS_TICK, categoryAxis, ChartTooltip, Legend, type Series } from "./common";

interface Props {
  id: string;
  data: Record<string, string | number | null>[];
  bar: Series;
  line: Series;
  unit: Unit;
  unit2: Unit;
}

const unitName = (u: Unit) => (u === "pct" ? "%" : u === "ratio" ? "ratio" : "effectif");
const num = (v: unknown) => (typeof v === "number" ? v : null);

/**
 * Graphique combiné pour deux indicateurs d'unités différentes, sans jamais superposer deux axes Y.
 *  - x temporel (sessions) : deux panneaux alignés sur le même axe X (barres puis courbe), infobulle synchronisée ;
 *  - x catégoriel (écoles, filières…) : lignes horizontales, libellés complets à gauche, une colonne par
 *    indicateur avec sa propre échelle (barres puis points) — pas de courbe reliant des catégories sans ordre.
 */
export function ComboChart(props: Props) {
  const temporal = props.data.every((d) => typeof d.x === "number" || /^\d{4}$/.test(String(d.label)));
  return temporal ? <ComboPanels {...props} /> : <ComboRows {...props} />;
}

function ComboPanels({ id, data, bar, line, unit, unit2 }: Props) {
  const syncId = `combo-${id}`;
  const axis = categoryAxis(data.map((d) => String(d.label ?? "")));
  return (
    <div>
      <Legend series={[bar, line]} />
      <p className="mb-1 text-[11px] font-medium text-muted">{bar.label} ({unitName(unit)})</p>
      <ColumnChart data={data} series={[bar]} unit={unit} height={190} hideLegend syncId={syncId} hideXAxis />
      <p className="mb-1 mt-3 text-[11px] font-medium text-muted">{line.label} ({unitName(unit2)})</p>
      <div style={{ height: 170 + axis.extra }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} syncId={syncId} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" tick={axis.tick} height={axis.height} tickLine={false} axisLine={{ stroke: "var(--axis)" }} interval={0} />
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

/** Version catégorielle : une ligne par catégorie, deux colonnes indépendantes (barres | points). */
function ComboRows({ data, bar, line, unit, unit2 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = data.slice(0, 30);
  const v1 = rows.map((d) => num(d[bar.key]));
  const v2 = rows.map((d) => num(d[line.key]));
  const max1 = Math.max(0, ...v1.filter((v): v is number => v !== null));
  const vals2 = v2.filter((v): v is number => v !== null);
  // Échelle du 2e indicateur : 0-100 pour un pourcentage, sinon 0 → max
  const max2 = unit2 === "pct" && Math.max(...vals2) <= 100 ? 100 : Math.max(0, ...vals2);
  const pct = (v: number | null, max: number) => (v === null || max <= 0 ? 0 : (100 * Math.max(0, v)) / max);

  return (
    <div>
      <Legend series={[bar, line]} />
      <div className="overflow-x-auto">
        <table className="tabular w-full min-w-[520px] border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="w-[34%] pb-2 pr-3 text-left font-medium text-muted" />
              <th className="border-l border-grid px-3 pb-2 text-left">
                <span className="text-[0.8125rem] font-semibold text-ink">{bar.label}</span>
                <span className="block font-normal text-muted">{unitName(unit)} · 0 – {fmtValue(max1, unit, true)}</span>
              </th>
              <th className="border-l border-grid px-3 pb-2 text-left">
                <span className="text-[0.8125rem] font-semibold text-ink">{line.label}</span>
                <span className="block font-normal text-muted">{unitName(unit2)} · 0 – {fmtValue(max2, unit2, true)}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr
                key={i}
                className={hover === i ? "bg-surface-2/70" : ""}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                title={`${d.label}\n${bar.label} : ${fmtValue(v1[i], unit)}\n${line.label} : ${fmtValue(v2[i], unit2)}`}
              >
                <th scope="row" className="py-1.5 pr-3 text-left font-normal leading-snug text-ink-2">{String(d.label)}</th>
                <td className="border-l border-grid px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="block h-3 shrink-0 rounded-r-[4px]" style={{ width: `${pct(v1[i], max1) * 0.78}%`, minWidth: v1[i] ? 2 : 0, background: bar.color }} />
                    <span className="whitespace-nowrap text-[11px] text-ink-2">{fmtValue(v1[i], unit, true)}</span>
                  </div>
                </td>
                <td className="border-l border-grid px-3 py-1.5">
                  {/* Point sur une échelle propre (pas de ligne entre catégories) */}
                  <div className="relative flex h-4 items-center">
                    <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-grid" />
                    {v2[i] !== null && (
                      <span className="absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-2 ring-[var(--surface)]"
                        style={{ left: `${pct(v2[i], max2) * 0.8}%`, background: line.color }} />
                    )}
                    <span className="absolute right-0 whitespace-nowrap text-[11px] text-ink-2">{fmtValue(v2[i], unit2)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 30 && <p className="mt-2 text-[11px] text-muted">30 premières catégories affichées.</p>}
    </div>
  );
}
