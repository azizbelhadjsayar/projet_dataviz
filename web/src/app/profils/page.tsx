import { Users } from "lucide-react";
import { Suspense } from "react";
import { ChartCard } from "@/components/ChartCard";
import { FilterBar } from "@/components/FilterBar";
import { Dumbbell } from "@/components/charts/Dumbbell";
import { HBarChart } from "@/components/charts/HBarChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { Insights, NextStep, PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { aggregate, labeled, type Row } from "@/lib/data/query";
import type { MetricId } from "@/lib/data/schema";
import { parseFilters, type SearchParams } from "@/lib/filters";
import { fmtPct, fmtRatio } from "@/lib/format";
import { filterOptions, scopeLabel } from "@/lib/page-data";

// « Pour qui l'accès se resserre-t-il ? » : la page se limite à l'équité sociale (boursiers) et scolaire
// (série du bac), les deux profils sur lesquels une décision d'ouverture de places peut agir.

const n = (r: Row, k: string) => (r[k] as number | null) ?? 0;

const BAC = [
  { key: "general", label: "Bac général", color: "var(--series-1)" },
  { key: "techno", label: "Bac technologique", color: "var(--series-2)" },
  { key: "pro", label: "Bac professionnel", color: "var(--series-3)" },
];

export default async function ProfilsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const sub = `${scopeLabel(f.scope)} · ${f.session}`;

  const metrics: MetricId[] = [
    "voeux_pp", "part_admis_bac_general", "part_admis_bac_techno", "part_admis_bac_pro",
    "part_boursiers_voeux", "part_boursiers_admis", "taux_proposition_boursiers", "taux_proposition_non_boursiers",
  ];
  const byType = labeled(aggregate({ groupBy: ["type_formation"], metrics, filters: f.withSession, sortBy: "voeux_pp" }).rows, "type_formation");
  const total = aggregate({ metrics, filters: f.withSession }).rows[0] ?? {};

  // Haltères triées par écart décroissant : le message est l'écart, pas les niveaux.
  const gapOf = (r: Row) => n(r, "taux_proposition_non_boursiers") - n(r, "taux_proposition_boursiers");
  const bourse = byType
    .filter((r) => r.taux_proposition_boursiers !== null && r.taux_proposition_non_boursiers !== null)
    .sort((a, b) => gapOf(b) - gapOf(a))
    .map((r) => ({ label: r.label as string, y0: n(r, "taux_proposition_boursiers"), y1: n(r, "taux_proposition_non_boursiers") }));
  const widest = bourse[0];

  const bacAdmis = [...byType]
    .sort((a, b) => n(b, "part_admis_bac_pro") - n(a, "part_admis_bac_pro"))
    .map((r) => ({ label: r.label, general: n(r, "part_admis_bac_general"), techno: n(r, "part_admis_bac_techno"), pro: n(r, "part_admis_bac_pro") }));

  const evo = aggregate({ groupBy: ["session"], metrics: ["part_boursiers_voeux", "part_boursiers_admis"], filters: f.scope }).rows;
  const lastEvo = evo.at(-1);
  const evoGap = lastEvo ? n(lastEvo, "part_boursiers_admis") - n(lastEvo, "part_boursiers_voeux") : 0;
  const boursiersTitle = !lastEvo ? "Part de boursiers parmi les vœux et les admis"
    : evoGap > 0.5 ? "Les boursiers pèsent plus parmi les admis que parmi les vœux"
    : evoGap < -0.5 ? "Les boursiers pèsent moins parmi les admis que parmi les vœux"
    : "Les boursiers pèsent autant parmi les admis que parmi les vœux";

  const gap = n(total, "taux_proposition_non_boursiers") - n(total, "taux_proposition_boursiers");
  const insights = [
    <>En {f.session}, les vœux de néo-bacheliers boursiers débouchent sur une proposition dans <strong className="text-ink">{fmtPct(total.taux_proposition_boursiers as number)}</strong> des cas, contre {fmtPct(total.taux_proposition_non_boursiers as number)} pour les non-boursiers ({gap >= 0 ? "écart de " : "écart inversé de "}{fmtRatio(Math.abs(gap))} points).</>,
    <>Les boursiers représentent {fmtPct(total.part_boursiers_voeux as number)} des vœux de néo-bacheliers et {fmtPct(total.part_boursiers_admis as number)} des admis néo-bacheliers.</>,
    bacAdmis[0] && <>Les bacheliers professionnels sont surtout admis en <strong className="text-ink">{bacAdmis[0].label}</strong> ({fmtPct(bacAdmis[0].pro)} des admis néo-bacheliers).</>,
    <>Ces écarts sont des constats, pas des preuves de discrimination : ils reflètent aussi les choix de vœux et les résultats scolaires des candidats.</>,
  ].filter(Boolean);

  return (
    <PageTransition>
      <PageHeader title="Profils & équité" eyebrow="Pour qui ?" chapter="04" icon={Users}>
        Pour qui l&apos;accès se resserre-t-il ? Accès des boursiers et origine scolaire des admis. Les parts d&apos;admis portent sur
        les admis néo-bacheliers (bac de l&apos;année).
      </PageHeader>
      <Suspense>
        <FilterBar options={filterOptions()} />
      </Suspense>

      <ChartCard
        title={widest && bourse.length > 1 && widest.y1 > widest.y0 ? `Les boursiers reçoivent moins de propositions, surtout en ${widest.label}` : "Accès aux propositions : boursiers et non-boursiers"}
        aiQuestion={`Les boursiers reçoivent-ils moins de propositions que les non-boursiers (${sub}) ? Dans quels types de formation et filières l'écart est-il le plus fort ?`}
        subtitle={`Part des vœux de terminale ayant reçu une proposition, triée par écart · ${sub}`}
        table={{
          columns: ["Type", "Boursiers", "Non-boursiers", "Écart (points)"],
          rows: bourse.map((r) => [r.label, fmtPct(r.y0), fmtPct(r.y1), fmtRatio(r.y1 - r.y0)]),
        }}
        note="Haltères : seule la position des points compte, l'échelle est donc resserrée sur les valeurs. Propositions reçues par les candidats en terminale rapportées à leurs vœux en phase principale."
      >
        <Dumbbell
          data={bourse}
          unit="pct"
          series={[
            { key: "boursiers", label: "Boursiers", color: "var(--series-2)" },
            { key: "non_boursiers", label: "Non-boursiers", color: "var(--series-1)" },
          ]}
        />
      </ChartCard>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title={boursiersTitle}
          aiQuestion={`Analyse l'évolution 2021-2025 de la part de boursiers parmi les vœux et parmi les admis néo-bacheliers (${scopeLabel(f.scope)}).`}
          subtitle={`Part de boursiers parmi les néo-bacheliers, 2021-2025 · ${scopeLabel(f.scope)}`}
          table={{
            columns: ["Session", "Boursiers (vœux)", "Boursiers (admis)"],
            rows: evo.map((r) => [String(r.session), fmtPct(r.part_boursiers_voeux as number), fmtPct(r.part_boursiers_admis as number)]),
          }}
        >
          <TrendChart
            data={evo.map((r) => ({
              session: r.session as number,
              part_boursiers_voeux: r.part_boursiers_voeux as number,
              part_boursiers_admis: r.part_boursiers_admis as number,
            }))}
            unit="pct"
            yDomain={[0, "auto"]}
            series={[
              { key: "part_boursiers_voeux", label: "Vœux", color: "var(--series-1)" },
              { key: "part_boursiers_admis", label: "Admis", color: "var(--series-2)" },
            ]}
          />
        </ChartCard>
        <ChartCard
          title={bacAdmis.length > 1 ? `${bacAdmis[0].label} : la plus forte part de bacheliers professionnels` : "Origine scolaire des admis néo-bacheliers"}
          aiQuestion={`Compare la série de bac des candidats (vœux) et des admis par type de formation (${sub}) : quelles filières sélectionnent davantage selon la série du bac ?`}
          subtitle={`Admis néo-bacheliers par série de bac, trié par part de bac pro · ${sub}`}
          table={{ columns: ["Type", ...BAC.map((s) => s.label)], rows: bacAdmis.map((r) => [r.label, ...BAC.map((s) => fmtPct(r[s.key as keyof typeof r] as number))]) }}
        >
          <HBarChart data={bacAdmis} series={BAC} unit="pct" stacked labelWidth={140} />
        </ChartCard>
      </div>

      <div className="mt-6">
        <Insights items={insights} />
      </div>
      <NextStep href="/assistant" step="Aller plus loin" title="Posez vos propres questions à l’agent d’analyse">Il écrit ses requêtes SQL, vérifie ses résultats et trace les graphiques adaptés.</NextStep>
    </PageTransition>
  );
}
