import { MapPinned } from "lucide-react";
import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { Insights, PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { TerritoryExplorer, type TerritoryRow } from "@/components/TerritoryExplorer";
import { aggregate, normalize } from "@/lib/data/query";
import { METRICS, type MetricId } from "@/lib/data/schema";
import { parseFilters, type SearchParams } from "@/lib/filters";
import { fmtPct, fmtRatio } from "@/lib/format";
import { getShapes, MAP_HEIGHT, MAP_WIDTH } from "@/lib/geo";
import { filterOptions, scopeLabel } from "@/lib/page-data";

const MAP_METRICS: MetricId[] = [
  "voeux_par_place", "taux_acces_moyen", "nb_formations", "capacite", "part_formations_selectives",
  "part_meme_academie", "part_boursiers_admis", "part_mention_tb", "part_filles_admis", "taux_remplissage",
];

export default async function TerritoiresPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const f = parseFilters(await searchParams);
  // La carte montre toute la France : on ignore le filtre région pour cette page.
  const { region: _region, ...scope } = f.withSession;
  void _region;

  const regionShapes = getShapes("regions");
  const shapeCodeByName = new Map(regionShapes.map((s) => [normalize(s.name), s.code]));

  const toRow = (code: string, name: string, r: Record<string, string | number | null>): TerritoryRow => ({
    code, name, formations: (r.nb_formations as number) ?? 0,
    values: Object.fromEntries(MAP_METRICS.map((m) => [m, r[m] as number | null])),
  });

  const regionRows = aggregate({ groupBy: ["region"], metrics: MAP_METRICS, filters: scope }).rows
    .filter((r) => r.region !== "Étranger")
    .map((r) => toRow(shapeCodeByName.get(normalize(String(r.region))) ?? `om-${r.region}`, String(r.region), r));
  const depRows = aggregate({ groupBy: ["code_departement", "departement"], metrics: MAP_METRICS, filters: scope }).rows
    .map((r) => toRow(String(r.code_departement), String(r.departement), r));

  // Faits saillants
  const OUTRE_MER = new Set(["01", "02", "03", "04", "06"]); // codes INSEE des régions d'outre-mer (encarts)
  const metro = regionRows.filter((r) => !r.code.startsWith("om-") && !OUTRE_MER.has(r.code));
  const by = (m: MetricId) => [...metro].filter((r) => r.values[m] !== null).sort((a, b) => (b.values[m] as number) - (a.values[m] as number));
  const pressure = by("voeux_par_place");
  const mobility = by("part_meme_academie");
  const insights = [
    pressure.length > 1 && <>Pression la plus forte en <strong className="text-ink">{pressure[0].name}</strong> ({fmtRatio(pressure[0].values.voeux_par_place)} vœux par place), la plus faible en {pressure.at(-1)!.name} ({fmtRatio(pressure.at(-1)!.values.voeux_par_place)}).</>,
    mobility.length > 1 && <>Recrutement le plus local en <strong className="text-ink">{mobility[0].name}</strong> : {fmtPct(mobility[0].values.part_meme_academie)} des admis néo-bacheliers viennent de la même académie, contre {fmtPct(mobility.at(-1)!.values.part_meme_academie)} en {mobility.at(-1)!.name}.</>,
    <>L&apos;Île-de-France compte trois académies (Paris, Créteil, Versailles) : la part d&apos;admis « de la même académie » y est mécaniquement plus faible.</>,
  ].filter(Boolean);

  return (
    <PageTransition>
      <PageHeader title="Territoires" eyebrow="Tableau de bord" icon={MapPinned}>
        Répartition géographique de l&apos;offre, de la demande et du recrutement. Choisissez l&apos;indicateur et l&apos;échelon ;
        les couleurs sont réparties en classes de quantiles (chaque teinte regroupe un nombre comparable de territoires). Cliquez sur un territoire pour son détail.
      </PageHeader>
      <Suspense>
        <FilterBar options={filterOptions()} />
      </Suspense>
      <TerritoryExplorer
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        subtitle={`${scopeLabel({ ...scope, region: undefined })} · ${f.session}${f.scope.region ? " (filtre région ignoré sur cette page)" : ""}`}
        metrics={MAP_METRICS.map((id) => ({ id, label: METRICS[id].label, unit: METRICS[id].unit, description: METRICS[id].description }))}
        regions={{ shapes: regionShapes, rows: regionRows }}
        departements={{ rows: depRows }}
        session={f.session}
      />
      <div className="mt-6">
        <Insights items={insights} />
      </div>
    </PageTransition>
  );
}
