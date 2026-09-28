import { GraduationCap } from "lucide-react";
import { Suspense } from "react";
import { ChartCard } from "@/components/ChartCard";
import { FilterBar } from "@/components/FilterBar";
import { HBarChart } from "@/components/charts/HBarChart";
import { ScatterPlot } from "@/components/charts/ScatterPlot";
import { Insights, PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { SortableTable } from "@/components/SortableTable";
import { aggregate, labeled } from "@/lib/data/query";
import { parseFilters, type SearchParams } from "@/lib/filters";
import { fmtInt, fmtPct, fmtRatio } from "@/lib/format";
import { filterOptions, scopeLabel } from "@/lib/page-data";

const MIN_FORMATIONS = 10;

export default async function FormationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const f = parseFilters(await searchParams);
  const sub = `${scopeLabel(f.scope)} · ${f.session}`;

  const overall = aggregate({ metrics: ["voeux_par_place", "taux_acces_moyen"], filters: f.withSession }).rows[0] ?? {};
  const filieres = labeled(aggregate({
    groupBy: ["filiere"],
    metrics: ["nb_formations", "capacite", "voeux_pp", "voeux_par_place", "taux_acces_moyen", "taux_remplissage", "part_formations_selectives", "admis_total"],
    filters: f.withSession,
    minFormations: MIN_FORMATIONS,
    sortBy: "voeux_pp",
  }).rows, "filiere");

  const points = filieres
    .filter((r) => r.voeux_par_place !== null && r.taux_acces_moyen !== null && (r.voeux_par_place as number) > 0)
    .map((r) => ({
      label: r.label as string,
      group: `${fmtInt(r.voeux_pp as number)} vœux · ${fmtInt(r.capacite as number)} places`,
      x: r.voeux_par_place as number,
      y: r.taux_acces_moyen as number,
      n: r.nb_formations as number,
    }));

  const topDemand = [...filieres].filter((r) => r.voeux_par_place !== null)
    .sort((a, b) => (b.voeux_par_place as number) - (a.voeux_par_place as number)).slice(0, 12);
  const leastAccess = [...filieres].filter((r) => r.taux_acces_moyen !== null)
    .sort((a, b) => (a.taux_acces_moyen as number) - (b.taux_acces_moyen as number)).slice(0, 12);

  const selectivite = labeled(aggregate({
    groupBy: ["selectivite"],
    metrics: ["nb_formations", "capacite", "voeux_pp", "voeux_par_place", "taux_acces_moyen", "taux_remplissage"],
    filters: f.withSession,
  }).rows, "selectivite");
  const sel = selectivite.find((r) => r.label === "Sélective");
  const nonSel = selectivite.find((r) => r.label === "Non sélective");

  const insights = [
    topDemand[0] && <>La filière la plus demandée par place est <strong className="text-ink">{topDemand[0].label}</strong> ({fmtRatio(topDemand[0].voeux_par_place as number)} vœux par place).</>,
    leastAccess[0] && <>La moins accessible : <strong className="text-ink">{leastAccess[0].label}</strong>, avec un taux d&apos;accès moyen de {fmtPct(leastAccess[0].taux_acces_moyen as number)}.</>,
    sel && nonSel && <>Les formations sélectives représentent {fmtInt(sel.nb_formations as number)} formations ({fmtRatio(sel.voeux_par_place as number)} vœux par place, taux d&apos;accès {fmtPct(sel.taux_acces_moyen as number)}), contre {fmtInt(nonSel.nb_formations as number)} non sélectives ({fmtRatio(nonSel.voeux_par_place as number)} vœux par place, taux d&apos;accès {fmtPct(nonSel.taux_acces_moyen as number)}).</>,
    <>Une forte demande par place ne garantit pas un faible taux d&apos;accès : le taux dépend aussi du rang du dernier appelé, donc des désistements et de l&apos;attractivité relative des formations.</>,
  ].filter(Boolean);

  return (
    <PageTransition>
      <PageHeader title="Formations & sélectivité" eyebrow="Tableau de bord" icon={GraduationCap}>
        Pression de la demande (vœux par place) et accessibilité (taux d&apos;accès) des filières.
        Seules les filières comptant au moins {MIN_FORMATIONS} formations sont représentées pour éviter les ratios instables.
      </PageHeader>
      <Suspense>
        <FilterBar options={filterOptions()} />
      </Suspense>

      <ChartCard
        title="Demande par place et accessibilité des filières"
        subtitle={`Chaque point est une filière · ${sub}`}
        aiQuestion={`Y a-t-il un lien entre la pression de la demande (vœux par place) et le taux d'accès selon les filières (${sub}) ? Calcule la corrélation et identifie les filières atypiques.`}
        note="Axe horizontal en échelle logarithmique. Les lignes grises repèrent la valeur globale du périmètre : en haut à gauche, filières peu demandées et accessibles ; en bas à droite, filières très demandées et sélectives."
        table={{
          columns: ["Filière", "Vœux / place", "Taux d'accès moyen", "Formations"],
          rows: points.map((p) => [p.label, fmtRatio(p.x), fmtPct(p.y), fmtInt(p.n)]),
        }}
      >
        <ScatterPlot
          data={points}
          xLabel="Vœux par place"
          yLabel="Taux d'accès moyen"
          xUnit="ratio"
          yUnit="pct"
          xLog
          refX={overall.voeux_par_place as number | null}
          refY={overall.taux_acces_moyen as number | null}
          height={420}
        />
      </ChartCard>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Filières les plus demandées"
          subtitle={`Vœux en phase principale par place · ${sub}`}
          aiQuestion={`Pourquoi ces filières sont-elles les plus demandées par place (${sub}) ? Compare leur évolution depuis 2021 et leur taux d'accès.`}
          table={{ columns: ["Filière", "Vœux / place"], rows: topDemand.map((r) => [r.label, fmtRatio(r.voeux_par_place as number)]) }}
        >
          <HBarChart data={topDemand} unit="ratio" labelWidth={230} series={[{ key: "voeux_par_place", label: "Vœux par place", color: "var(--series-1)" }]} />
        </ChartCard>
        <ChartCard
          title="Filières les moins accessibles"
          subtitle={`Taux d'accès moyen, du plus bas au plus haut · ${sub}`}
          aiQuestion={`Analyse les filières au taux d'accès le plus bas (${sub}) : public vs privé, évolution depuis 2022, profil des admis (mentions, boursiers).`}
          table={{ columns: ["Filière", "Taux d'accès"], rows: leastAccess.map((r) => [r.label, fmtPct(r.taux_acces_moyen as number)]) }}
        >
          <HBarChart data={leastAccess} unit="pct" labelWidth={230} xDomain={[0, 100]} series={[{ key: "taux_acces_moyen", label: "Taux d'accès moyen", color: "var(--series-1)" }]} />
        </ChartCard>
      </div>

      <div className="mt-4">
        <ChartCard title="Toutes les filières" subtitle={`Cliquez sur un en-tête pour trier · ${sub}`}>
          <SortableTable
            rows={filieres}
            initialSort="voeux_pp"
            columns={[
              { key: "label", label: "Filière" },
              { key: "nb_formations", label: "Formations", unit: "count" },
              { key: "capacite", label: "Places", unit: "count" },
              { key: "voeux_pp", label: "Vœux PP", unit: "count" },
              { key: "voeux_par_place", label: "Vœux / place", unit: "ratio" },
              { key: "taux_acces_moyen", label: "Taux d'accès", unit: "pct" },
              { key: "taux_remplissage", label: "Remplissage", unit: "pct" },
              { key: "part_formations_selectives", label: "Sélectives", unit: "pct" },
            ]}
          />
        </ChartCard>
      </div>

      <div className="mt-6">
        <Insights items={insights} />
      </div>
    </PageTransition>
  );
}
