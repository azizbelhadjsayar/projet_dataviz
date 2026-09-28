"use client";

import { memo, type ReactNode } from "react";
import { ChartCard, type TableData } from "@/components/ChartCard";
import { StatTile } from "@/components/StatTile";
import { AreaStack } from "@/components/charts/AreaStack";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { ComboChart } from "@/components/charts/ComboChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { Dumbbell } from "@/components/charts/Dumbbell";
import { Legend, type Series } from "@/components/charts/common";
import { FacetBars } from "@/components/charts/FacetBars";
import { Funnel } from "@/components/charts/Funnel";
import { HBarChart } from "@/components/charts/HBarChart";
import { Heatmap } from "@/components/charts/Heatmap";
import { PartBars } from "@/components/charts/PartBars";
import { ScatterPlot } from "@/components/charts/ScatterPlot";
import { Treemap } from "@/components/charts/Treemap";
import { TrendChart } from "@/components/charts/TrendChart";
import { Waterfall } from "@/components/charts/Waterfall";
import type { ChartPayload, ChartRow } from "@/lib/agent/types";
import { fmtValue } from "@/lib/format";
import { AgentMap } from "./AgentMap";

/** Ordre fixe des couleurs catégorielles (palette validée à 6 teintes) ; « Autres » toujours en gris. */
const PALETTE = [1, 2, 3, 4, 5, 6].map((i) => ({ color: `var(--series-${i})`, ink: `var(--on-series-${i})` }));
const NEUTRAL = { color: "var(--neutral)", ink: "var(--on-neutral)" };

const numbers = (rows: ChartRow[], keys: string[]) =>
  rows.flatMap((d) => keys.map((k) => d[k])).filter((v): v is number => typeof v === "number");
const n = (v: unknown) => (typeof v === "number" ? v : null);

/** Vue tableau équivalente (accessibilité, export CSV), quel que soit le type de graphique. */
function tableOf(chart: ChartPayload): TableData {
  const fmt = (v: unknown, unit = chart.unit) => fmtValue(n(v), unit);
  const metric = chart.series[0]?.label ?? "Valeur";
  if (chart.heat) {
    const h = chart.heat;
    return { columns: [h.rowLabel, ...h.cols], rows: h.rows.map((r, i) => [r, ...h.values[i].map((v) => fmt(v))]) };
  }
  if (chart.map) {
    return {
      columns: [chart.xLabel || "Territoire", metric],
      rows: [...chart.map.areas].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)).map((a) => [a.name, fmt(a.value)]),
    };
  }
  if (chart.tiles) {
    return {
      columns: ["Indicateur", "Valeur", "Valeur précédente"],
      rows: chart.tiles.map((t) => [t.label, fmt(t.value, t.unit), t.previous !== undefined ? `${fmt(t.previous, t.unit)} (${t.previousLabel})` : null]),
    };
  }
  const total = chart.data.reduce((a, d) => a + (n(d.y0) ?? 0), 0);
  const share = (v: unknown) => (total ? fmtValue((100 * (n(v) ?? 0)) / total, "pct") : null);
  if (chart.type === "pie" || chart.type === "treemap") {
    const grouped = chart.type === "treemap" && chart.data.some((d) => d.parent);
    return {
      columns: [chart.xLabel || "Catégorie", ...(grouped ? ["Groupe"] : []), metric, "Part"],
      rows: chart.data.map((d) => [String(d.label), ...(grouped ? [String(d.parent)] : []), fmt(d.y0), share(d.y0)]),
    };
  }
  if (chart.type === "funnel") {
    const first = n(chart.data[0]?.y0) ?? 0;
    return {
      columns: ["Étape", metric, "Part de l'étape 1", "Passage depuis l'étape précédente"],
      rows: chart.data.map((d, i) => {
        const prev = i ? n(chart.data[i - 1].y0) ?? 0 : 0;
        return [String(d.label), fmt(d.y0), first ? fmtValue((100 * (n(d.y0) ?? 0)) / first, "pct") : null, i && prev ? fmtValue((100 * (n(d.y0) ?? 0)) / prev, "pct") : null];
      }),
    };
  }
  if (chart.type === "waterfall") {
    return {
      columns: ["Étape", metric, "Cumul"],
      rows: chart.data.map((d) => [
        String(d.label),
        d.kind === "total" ? fmt(d.y0) : `${(n(d.y0) ?? 0) >= 0 ? "+" : "−"}${fmt(Math.abs(n(d.y0) ?? 0))}`,
        fmt(d.kind === "down" ? d.lo : d.kind === "up" ? d.hi : d.y0),
      ]),
    };
  }
  if (chart.type === "dumbbell") {
    return {
      columns: [chart.xLabel, ...chart.series.map((s) => s.label), "Écart"],
      rows: chart.data.map((d) => [String(d.label), fmt(d.y0), fmt(d.y1),
        fmtValue((n(d.y1) ?? 0) - (n(d.y0) ?? 0), chart.unit === "pct" ? "ratio" : chart.unit) + (chart.unit === "pct" ? " pt" : "")]),
    };
  }
  const seriesCols = chart.series.map((s) => s.label);
  const line = (d: ChartRow) => chart.series.map((s, k) =>
    chart.rawUnit
      ? `${fmt(d[s.key])} (${fmtValue(n(d[`${s.key}_raw`]), chart.rawUnit)})`
      : fmt(d[s.key], chart.type === "combo" && k === 1 ? chart.unit2 : chart.unit));
  if (chart.type === "scatter" || chart.type === "bubble") {
    const all: ChartRow[] = chart.facets ? chart.facets.flatMap((f) => f.data.map((d): ChartRow => ({ ...d, facet: f.label }))) : chart.data;
    return {
      columns: [...(chart.facets ? [chart.facetLabel ?? ""] : []), "Point", chart.xLabel, "Valeur", ...(chart.sizeLabel ? [chart.sizeLabel] : []),
        ...(chart.series.length > 1 ? ["Groupe"] : [])],
      rows: all.map((d) => [
        ...(chart.facets ? [String(d.facet)] : []), String(d.label), fmt(d.x), fmt(d.y0), ...(chart.sizeLabel ? [fmtValue(n(d.z), "count")] : []),
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

/** Grille de petits multiples (courbes, aires, colonnes, nuages) : même échelle, en-tête au-dessus de chaque panneau. */
function FacetGrid({ chart, series, render }: {
  chart: ChartPayload; series: Series[];
  render: (data: ChartRow[], domain: [number, number]) => ReactNode;
}) {
  const vals = numbers(chart.facets!.flatMap((f) => f.data), chart.type === "scatter" || chart.type === "bubble" ? ["y0"] : series.map((s) => s.key));
  const min = Math.min(0, ...vals);
  let max = Math.max(...vals);
  if (chart.type === "stacked_column" || chart.type === "area") {
    max = Math.max(...chart.facets!.flatMap((f) => f.data.map((d) => series.reduce((a, s) => a + (n(d[s.key]) ?? 0), 0))));
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
  const series: Series[] = chart.series.map((s, i) => ({ ...s, ...(s.label === "Autres" ? NEUTRAL : PALETTE[i % PALETTE.length]) }));
  const stacked = chart.type === "stacked_bar" || chart.type === "stacked_column" || chart.type === "stacked_bar_100" || chart.type === "stacked_column_100";
  const metric = series[0]?.label ?? "";

  let body: ReactNode;
  if (chart.tiles) {
    body = (
      <div className={`grid gap-3 sm:grid-cols-2 ${chart.tiles.length >= 3 ? "lg:grid-cols-3" : ""} ${chart.tiles.length === 4 || chart.tiles.length > 6 ? "xl:grid-cols-4" : ""}`}>
        {chart.tiles.map((t) => (
          <StatTile key={t.label} label={t.label} value={t.value} unit={t.unit} previous={t.previous ?? null}
            previousLabel={t.previousLabel} trend={t.trend} trendIndex={t.trend ? t.trend.length - 1 : undefined} />
        ))}
      </div>
    );
  } else if (chart.map) {
    body = <AgentMap level={chart.map.level} areas={chart.map.areas} unit={chart.unit} metricLabel={metric} />;
  } else if (chart.type === "pie") {
    body = <DonutChart unit={chart.unit} metricLabel={metric} data={chart.data.map((d) => ({ label: String(d.label), value: n(d.y0) ?? 0 }))} />;
  } else if (chart.type === "treemap") {
    body = <Treemap data={chart.data} series={series} unit={chart.unit} metricLabel={metric} />;
  } else if (chart.type === "funnel") {
    body = <Funnel data={chart.data} unit={chart.unit} />;
  } else if (chart.type === "waterfall") {
    body = <Waterfall data={chart.data} unit={chart.unit} metricLabel={metric} />;
  } else if (chart.type === "dumbbell") {
    body = <Dumbbell data={chart.data} series={series} unit={chart.unit} />;
  } else if (chart.type === "histogram") {
    body = <ColumnChart data={chart.data} series={series} unit={chart.unit} histogram />;
  } else if (chart.heat) {
    body = <Heatmap {...chart.heat} unit={chart.unit} metricLabel={metric} />;
  } else if (chart.type === "combo") {
    body = <ComboChart id={chart.id} data={chart.data} bar={series[0]} line={series[1]} unit={chart.unit} unit2={chart.unit2 ?? chart.unit} />;
  } else if (chart.type === "scatter" || chart.type === "bubble") {
    const toPoints = (rows: ChartRow[]) => rows
      .filter((d) => typeof d.x === "number" && typeof d.y0 === "number")
      .map((d) => ({ label: String(d.label), x: d.x as number, y: d.y0 as number, seriesKey: d.group ? String(d.group) : undefined, z: n(d.z) ?? undefined }));
    const groups = series.length > 1 || series[0]?.key.startsWith("s") ? series : undefined;
    const yLabel = groups ? "Valeur" : series[0]?.label ?? "";
    const xUnit = chart.unit === "pct" ? "ratio" : chart.unit;
    if (chart.facets) {
      const xs = numbers(chart.facets.flatMap((f) => f.data), ["x"]);
      const xDomain: [number, number] = [Math.min(0, ...xs), Math.ceil(Math.max(...xs) * 1.05)];
      body = <FacetGrid chart={chart} series={groups ?? []} render={(rows, domain) => (
        <ScatterPlot data={toPoints(rows)} xLabel={chart.xLabel} yLabel={yLabel} xUnit={xUnit} yUnit={chart.unit}
          height={240} groups={groups?.map((g) => ({ ...g }))} xDomain={xDomain} yDomain={domain} sizeLabel={chart.sizeLabel} />
      )} />;
    } else {
      body = <ScatterPlot data={toPoints(chart.data)} xLabel={chart.xLabel} yLabel={yLabel} xUnit={xUnit}
        yUnit={chart.unit} height={chart.sizeLabel ? 420 : 360} groups={groups} sizeLabel={chart.sizeLabel} />;
    }
  } else if (chart.facets) {
    if (chart.type === "bar" || chart.type === "stacked_bar" || chart.type === "stacked_bar_100") {
      body = <FacetBars facets={chart.facets} facetLabel={chart.facetLabel} series={series} unit={chart.unit} stacked={stacked} />;
    } else if (chart.type === "line") {
      body = <FacetGrid chart={chart} series={series} render={(rows, domain) => (
        <TrendChart data={rows as Record<string, number | null>[]} xKey="label" series={series} unit={chart.unit} height={190} yDomain={domain} hideLegend />
      )} />;
    } else if (chart.type === "area") {
      body = <FacetGrid chart={chart} series={series} render={(rows, domain) => (
        <AreaStack data={rows} series={series} unit={chart.unit} height={200} yDomain={domain} hideLegend />
      )} />;
    } else {
      body = <FacetGrid chart={chart} series={series} render={(rows, domain) => (
        <ColumnChart data={rows} series={series} unit={chart.unit} stacked={stacked} height={200} yDomain={domain} hideLegend rawUnit={chart.rawUnit} />
      )} />;
    }
  } else if (chart.type === "stacked_bar_100") {
    body = <PartBars data={chart.data} series={series} rawUnit={chart.rawUnit ?? "count"} />;
  } else if (chart.type === "line") {
    body = <TrendChart data={chart.data as Record<string, number | null>[]} xKey="label" series={series} unit={chart.unit} />;
  } else if (chart.type === "area") {
    body = <AreaStack data={chart.data} series={series} unit={chart.unit} />;
  } else if (chart.type === "column" || chart.type === "stacked_column" || chart.type === "stacked_column_100") {
    body = <ColumnChart data={chart.data} series={series} unit={chart.unit} stacked={stacked} rawUnit={chart.rawUnit} />;
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
