"use client";

import { ArrowRight, MapPin, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "./ChartCard";
import { FranceMap, type MapShape } from "./charts/FranceMap";
import { HBarChart } from "./charts/HBarChart";
import { SegmentedControl } from "./ui/SegmentedControl";
import type { Unit } from "@/lib/data/schema";
import { fmtInt, fmtValue } from "@/lib/format";

export interface TerritoryRow {
  code: string;
  name: string;
  formations: number;
  values: Record<string, number | null>;
}

interface Props {
  metrics: { id: string; label: string; unit: Unit; description: string }[];
  regions: { shapes: MapShape[]; rows: TerritoryRow[] };
  /** Contours des départements chargés à la demande (/api/geo/departements). */
  departements: { rows: TerritoryRow[] };
  width: number;
  height: number;
  subtitle: string;
  session: number;
}

type Level = "regions" | "departements";

export function TerritoryExplorer({ metrics, regions, departements, width, height, subtitle, session }: Props) {
  const [metricId, setMetricId] = useState(metrics[0].id);
  const [level, setLevel] = useState<Level>("regions");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [selected, setSelected] = useState<string | null>(null);
  const [depShapes, setDepShapes] = useState<MapShape[] | null>(null);
  const metric = metrics.find((m) => m.id === metricId)!;
  const data = useMemo(
    () => (level === "regions" ? regions : { shapes: depShapes ?? [], rows: departements.rows }),
    [level, regions, depShapes, departements.rows],
  );

  // Préchargement des contours départementaux peu après l'affichage (ou immédiatement si demandés).
  useEffect(() => {
    if (depShapes) return;
    let cancelled = false;
    const t = setTimeout(() => {
      fetch("/api/geo/departements")
        .then((r) => (r.ok ? r.json() : null))
        .then((s: MapShape[] | null) => { if (!cancelled && s) setDepShapes(s); })
        .catch(() => {});
    }, level === "departements" ? 0 : 1200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [level, depShapes]);

  const values = useMemo(() => {
    const out: Record<string, { value: number | null; formations: number }> = {};
    for (const r of data.rows) out[r.code] = { value: r.values[metricId] ?? null, formations: r.formations };
    return out;
  }, [data, metricId]);

  // Classement : toutes les régions ; départements : les 15 premiers.
  const ranked = useMemo(() => {
    const rows = data.rows.filter((r) => r.values[metricId] !== null && r.formations >= 5)
      .sort((a, b) => (b.values[metricId] as number) - (a.values[metricId] as number))
      .map((r) => ({ label: r.name, value: r.values[metricId] }));
    return level === "regions" ? rows : rows.slice(0, 15);
  }, [data, metricId, level]);

  const sel = selected ? data.rows.find((r) => r.code === selected) : null;
  const rank = sel ? [...data.rows].filter((r) => r.values[metricId] !== null)
    .sort((a, b) => (b.values[metricId] as number) - (a.values[metricId] as number)).findIndex((r) => r.code === sel.code) + 1 : 0;

  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[0.975rem] font-semibold">{metric.label} par {level === "regions" ? "région" : "département"}</h2>
          <p className="mt-0.5 text-[0.8125rem] text-muted">{subtitle}</p>
          <p className="mt-1 max-w-2xl text-xs text-ink-2">{metric.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Indicateur</span>
            <select
              value={metricId}
              onChange={(e) => setMetricId(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-line bg-surface pl-3 pr-8 text-sm font-medium text-ink outline-none hover:border-line-strong focus-visible:ring-2 focus-visible:ring-accent"
            >
              {metrics.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">▾</span>
          </label>
          <SegmentedControl ariaLabel="Échelon" value={level} onChange={(l) => { setLevel(l); setSelected(null); }}
            options={[{ value: "regions" as Level, label: "Régions" }, { value: "departements" as Level, label: "Départements" }]} />
          <SegmentedControl ariaLabel="Affichage" value={view} onChange={setView}
            options={[{ value: "chart" as const, label: "Carte" }, { value: "table" as const, label: "Tableau" }]} />
        </div>
      </header>

      {view === "table" ? (
        <DataTable
          maxHeight={580}
          table={{
            columns: [level === "regions" ? "Région" : "Département", metric.label, "Formations"],
            rows: [...data.rows]
              .sort((a, b) => (b.values[metricId] ?? -Infinity) - (a.values[metricId] ?? -Infinity))
              .map((r) => [r.name, fmtValue(r.values[metricId] ?? null, metric.unit), fmtInt(r.formations)]),
          }}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div>
            {data.shapes.length ? (
              <FranceMap shapes={data.shapes} width={width} height={height} values={values} unit={metric.unit}
                metricLabel={metric.label} selected={selected} onSelect={(c) => setSelected(c === selected ? null : c)} />
            ) : (
              <div className="flex items-center justify-center rounded-xl bg-surface-2 text-sm text-muted" style={{ aspectRatio: `${width} / ${height}` }}>
                Chargement des départements…
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-4">
            {sel ? (
              <div className="animate-fade-up rounded-xl border border-accent/30 bg-accent-soft/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-semibold text-ink"><MapPin size={16} className="text-accent" /> {sel.name}</p>
                  <button type="button" onClick={() => setSelected(null)} aria-label="Fermer le détail" className="rounded-md p-1 text-ink-2 hover:bg-surface">
                    <X size={15} />
                  </button>
                </div>
                <p className="mt-1 text-sm text-ink-2">
                  <span className="tabular text-2xl font-semibold text-ink">{fmtValue(sel.values[metricId] ?? null, metric.unit)}</span>{" "}
                  {metric.label.toLowerCase()} · {rank ? `${rank}ᵉ sur ${data.rows.filter((r) => r.values[metricId] !== null).length}` : ""}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {metrics.filter((m) => m.id !== metricId).slice(0, 6).map((m) => (
                    <div key={m.id} className="flex justify-between gap-2 border-b border-line/60 pb-1">
                      <dt className="truncate text-muted">{m.label}</dt>
                      <dd className="tabular font-medium text-ink">{fmtValue(sel.values[m.id] ?? null, m.unit)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  {level === "regions" && (
                    <Link href={`/?session=${session}&region=${encodeURIComponent(sel.name)}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-ink shadow-card hover:text-accent">
                      Vue d&apos;ensemble de la région <ArrowRight size={13} />
                    </Link>
                  )}
                  <Link href={`/assistant?q=${encodeURIComponent(`Dresse le portrait Parcoursup ${level === "regions" ? "de la région" : "du département"} ${sel.name} en ${session} : offre, pression, accès, profils des admis, et comparaison avec la moyenne nationale.`)}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-accent shadow-card hover:bg-accent-soft">
                    <Sparkles size={13} /> Analyser avec l&apos;IA
                  </Link>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">Cliquez sur un territoire de la carte pour afficher son détail.</p>
            )}
            <div>
              <p className="mb-2 text-sm font-medium text-ink-2">
                {level === "regions" ? "Classement des régions" : "15 départements en tête"} <span className="font-normal text-muted">(≥ 5 formations)</span>
              </p>
              <HBarChart
                data={ranked}
                unit={metric.unit}
                labelWidth={170}
                xDomain={metric.unit === "pct" ? [0, 100] : undefined}
                series={[{ key: "value", label: metric.label, color: "var(--series-1)" }]}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
