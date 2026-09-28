"use client";

import { memo, type ReactNode } from "react";
import { ChartCard, type TableData } from "@/components/ChartCard";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { ComboChart } from "@/components/charts/ComboChart";
import { Legend, type Series } from "@/components/charts/common";
import { FacetBars } from "@/components/charts/FacetBars";
import { HBarChart } from "@/components/charts/HBarChart";
import { Heatmap } from "@/components/charts/Heatmap";
import { ScatterPlot } from "@/components/charts/ScatterPlot";
import { TrendChart } from "@/components/charts/TrendChart";
import type { ChartPayload, ChartRow } from "@/lib/agent/types";
import { fmtValue } from "@/lib/format";

const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--neutral)"];

const numbers = (rows: ChartRow[], keys: string[]) =>
  rows.flatMap((d) => keys.map((k) => d[k])).filter((v): v is number => typeof v === "number");

/** Vue tableau équivalente (accessibilité, export CSV), quel que soit le type de graphique. */
function tableOf(chart: ChartPayload): TableData {
  const fmt = (v: unknown, unit = chart.unit) => fmtValue(v as number | null, unit);
  if (chart.heat) {
    const h = chart.heat;
    return { columns: [h.rowLabel, ...h.cols], rows: h.rows.map((r, i) => [r, ...h.values[i].map((v) => fmt(v))]) };
  }
  const seriesCols = chart.series.map((s) => s.label);
  const line = (d: ChartRow) => chart.series.map((s, k) => fmt(d[s.key], chart.type === "combo" && k === 1 ? chart.unit2 : chart.unit));
  if (chart.type === "scatter") {
    const all: ChartRow[] = chart.facets ? chart.facets.flatMap((f) => f.data.map((d): ChartRow => ({ ...d, facet: f.label }))) : chart.data;
    return {
      columns: [...(chart.facets ? [chart.facetLabel ?? ""] : []), "Point", chart.xLabel, "Valeur", ...(chart.series.length > 1 ? ["Groupe"] : [])],
      rows: all.map((d) => [
        ...(chart.facets ? [String(d.facet)] : []), String(d.label), fmt(d.x), fmt(d.y0),
        ...(chart.series.length > 1 ? [chart.series.find((s) => s.key === d.group)?.label ?? ""] : []),
      ]),
    };
  }
  if (chart.facets) {
    return {
      columns: [chart.facetLabel ?? "Panneau", chart.xLabel, ...seriesCols],
      rows: chart.facets.flatMap((f) => f.data.map((d) => [f.label, String(d.label), ...line(d)])),
    };
  }
  return { columns: [chart.xLabel, ...seriesCols], rows: chart.data.map((d) => [String(d.label), ...line(d)]) };
}

/** Grille de petits multiples (courbes, colonnes, nuages) : même échelle, en-tête au-dessus de chaque panneau. */
function FacetGrid({ chart, series, render }: {
  chart: ChartPayload; series: Series[];
  render: (data: ChartRow[], domain: [number, number]) => ReactNode;
}) {
  const vals = numbers(chart.facets!.flatMap((f) => f.data), chart.type === "scatter" ? ["y0"] : series.map((s) => s.key));
  const min = Math.min(0, ...vals);
  let max = Math.max(...vals);
  if (chart.type === "stacked_column") {
    max = Math.max(...chart.facets!.flatMap((f) => f.data.map((d) => series.reduce((a, s) => a + ((d[s.key] as number) || 0), 0))));
  }
  const domain: [number, number] = chart.unit === "pct" && max <= 100 && min >= 0 ? [0, 100] : [min, Math.ceil(max * 1.05)];
  return (
    <div>
      {series.length > 1 && <Legend series={series} shape={chart.type === "line" ? "line" : "rect"} />}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {chart.facets!.map((f) => (
          <div key={f.label} className="min-w-0 rounded-lg border border-grid p-2.5">
            <p className="mb-1 text-[0.8125rem] font-semibold text-ink">{f.label}</p>
            {render(f.data, domain)}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">Même échelle dans tous les panneaux.</p>
    </div>
  );
}

/** Graphique demandé par l'agent (create_chart), rendu avec les composants du dashboard. */
export const AgentChart = memo(function AgentChart({ chart }: { chart: ChartPayload }) {
  const series: Series[] = chart.series.map((s, i) => ({ ...s, color: s.label === "Autres" ? COLORS[4] : COLORS[i % 4] }));
  const stacked = chart.type === "stacked_bar" || chart.type === "stacked_column";

  let body: ReactNode;
  if (chart.heat) {
    body = <Heatmap {...chart.heat} unit={chart.unit} metricLabel={series[0]?.label ?? ""} />;
  } else if (chart.type === "combo") {
    body = <ComboChart id={chart.id} data={chart.data} bar={series[0]} line={series[1]} unit={chart.unit} unit2={chart.unit2 ?? chart.unit} />;
  } else if (chart.type === "scatter") {
    const toPoints = (rows: ChartRow[]) => rows
      .filter((d) => typeof d.x === "number" && typeof d.y0 === "number")
      .map((d) => ({ label: String(d.label), x: d.x as number, y: d.y0 as number, seriesKey: d.group ? String(d.group) : undefined }));
    const groups = series.length > 1 || series[0]?.key.startsWith("s") ? series : undefined;
    const yLabel = groups ? "Valeur" : series[0]?.label ?? "";
    if (chart.facets) {
      const xs = numbers(chart.facets.flatMap((f) => f.data), ["x"]);
      const xDomain: [number, number] = [Math.min(0, ...xs), Math.ceil(Math.max(...xs) * 1.05)];
      body = <FacetGrid chart={chart} series={groups ?? []} render={(rows, domain) => (
        <ScatterPlot data={toPoints(rows)} xLabel={chart.xLabel} yLabel={yLabel} xUnit={chart.unit === "pct" ? "ratio" : chart.unit} yUnit={chart.unit}
          height={240} groups={groups?.map((g) => ({ ...g }))} xDomain={xDomain} yDomain={domain} />
      )} />;
    } else {
      body = <ScatterPlot data={toPoints(chart.data)} xLabel={chart.xLabel} yLabel={yLabel} xUnit={chart.unit === "pct" ? "ratio" : chart.unit}
        yUnit={chart.unit} height={360} groups={groups} />;
    }
  } else if (chart.facets) {
    if (chart.type === "bar" || chart.type === "stacked_bar") {
      body = <FacetBars facets={chart.facets} facetLabel={chart.facetLabel} series={series} unit={chart.unit} stacked={stacked} />;
    } else if (chart.type === "line") {
      body = <FacetGrid chart={chart} series={series} render={(rows, domain) => (
        <TrendChart data={rows as Record<string, number | null>[]} xKey="label" series={series} unit={chart.unit} height={190} yDomain={domain} hideLegend />
      )} />;
    } else {
      body = <FacetGrid chart={chart} series={series} render={(rows, domain) => (
        <ColumnChart data={rows} series={series} unit={chart.unit} stacked={stacked} height={200} yDomain={domain} hideLegend />
      )} />;
    }
  } else if (chart.type === "line") {
    body = <TrendChart data={chart.data as Record<string, number | null>[]} xKey="label" series={series} unit={chart.unit} />;
  } else if (chart.type === "column" || chart.type === "stacked_column") {
    body = <ColumnChart data={chart.data} series={series} unit={chart.unit} stacked={stacked} />;
  } else {
    const vals = numbers(chart.data, series.map((s) => s.key));
    const min = Math.min(0, ...vals);
    const max = Math.max(0, ...vals);
    body = (
      <HBarChart
        data={chart.data}
        series={series}
        unit={chart.unit}
        stacked={stacked}
        labelWidth={190}
        xDomain={min < 0 ? [min * 1.1, max * 1.1] : chart.unit === "pct" && max <= 100 && series.length > 1 ? [0, 100] : undefined}
      />
    );
  }

  return (
    <ChartCard title={chart.title} subtitle={chart.subtitle} table={tableOf(chart)} note={chart.note} className="my-3">
      {body}
    </ChartCard>
  );
});
