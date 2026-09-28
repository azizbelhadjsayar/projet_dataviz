import { Users } from "lucide-react";
import { Suspense } from "react";
import { ChartCard } from "@/components/ChartCard";
import { FilterBar } from "@/components/FilterBar";
import { HBarChart } from "@/components/charts/HBarChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { Insights, PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { aggregate, labeled, type Row } from "@/lib/data/query";
import type { MetricId } from "@/lib/data/schema";
import { parseFilters, type SearchParams } from "@/lib/filters";
import { fmtPct } from "@/lib/format";
import { filterOptions, scopeLabel } from "@/lib/page-data";

const n = (r: Row, k: string) => (r[k] as number | null) ?? 0;

const BAC = [
  { key: "general", label: "Bac général", color: "var(--series-1)" },
  { key: "techno", label: "Bac technologique", color: "var(--series-2)" },
  { key: "pro", label: "Bac professionnel", color: "var(--series-3)" },
];
const MENTIONS = [
  { key: "part_sans_mention", label: "Sans mention", color: "var(--ord-1)" },
  { key: "part_mention_ab", label: "Assez bien", color: "var(--ord-2)" },
  { key: "part_mention_b", label: "Bien", color: "var(--ord-3)" },
  { key: "part_mention_tb", label: "Très bien (+ félicitations)", color: "var(--ord-5)" },
  { key: "part_mention_inconnue", label: "Non renseignée", color: "var(--neutral)" },
];

export default async function ProfilsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const f = parseFilters(await searchParams);
  const sub = `${scopeLabel(f.scope)} · ${f.session}`;

  const metrics: MetricId[] = [
    "voeux_pp", "part_voeux_bac_general", "part_voeux_bac_techno", "part_voeux_bac_pro",
    "part_admis_bac_general", "part_admis_bac_techno", "part_admis_bac_pro",
    "part_sans_mention", "part_mention_ab", "part_mention_b", "part_mention_tb", "part_mention_inconnue",
    "part_boursiers_voeux", "part_boursiers_admis", "taux_proposition_boursiers", "taux_proposition_non_boursiers",
    "part_filles_voeux", "part_filles_admis", "part_admis_avant_bac", "part_admis_ouverture",
  ];
  const byType = labeled(aggregate({ groupBy: ["type_formation"], metrics, filters: f.withSession, sortBy: "voeux_pp" }).rows, "type_formation");
  const total = aggregate({ metrics, filters: f.withSession }).rows[0] ?? {};

  // Composition des vœux vs des admis néo-bacheliers par série de bac (parts à 100 %).
  // Les vœux incluent les « autres candidats » (réorientations...), d'où une 4e catégorie.
  const bacSeriesVoeux = [...BAC, { key: "autres", label: "Autres candidats", color: "var(--series-4)" }];
  const bacVoeux = byType.map((r) => ({
    label: r.label,
    general: n(r, "part_voeux_bac_general"), techno: n(r, "part_voeux_bac_techno"), pro: n(r, "part_voeux_bac_pro"),
    autres: Math.max(0, 100 - n(r, "part_voeux_bac_general") - n(r, "part_voeux_bac_techno") - n(r, "part_voeux_bac_pro")),
  }));
  const bacAdmis = byType.map((r) => ({
    label: r.label, general: n(r, "part_admis_bac_general"), techno: n(r, "part_admis_bac_techno"), pro: n(r, "part_admis_bac_pro"),
  }));
  const mentions = byType.map((r) => Object.fromEntries([["label", r.label], ...MENTIONS.map((m) => [m.key, n(r, m.key)])]));
  const byMentionTb = [...byType].sort((a, b) => n(b, "part_mention_tb") - n(a, "part_mention_tb"));

  const evo = aggregate({
    groupBy: ["session"],
    metrics: ["part_boursiers_voeux", "part_boursiers_admis", "part_filles_voeux", "part_filles_admis", "part_admis_avant_bac"],
    filters: f.scope,
  }).rows;

  const gap = n(total, "taux_proposition_non_boursiers") - n(total, "taux_proposition_boursiers");
  const insights = [
    <>En {f.session}, les vœux de néo-bacheliers boursiers débouchent sur une proposition dans <strong className="text-ink">{fmtPct(total.taux_proposition_boursiers as number)}</strong> des cas, contre {fmtPct(total.taux_proposition_non_boursiers as number)} pour les non-boursiers ({gap >= 0 ? "écart de " : "écart inversé de "}{fmtPct(Math.abs(gap))} points).</>,
    <>Les boursiers représentent {fmtPct(total.part_boursiers_voeux as number)} des vœux de néo-bacheliers et {fmtPct(total.part_boursiers_admis as number)} des admis néo-bacheliers.</>,
    byMentionTb[0] && <>Les admis les plus souvent titulaires d&apos;une mention Très bien se trouvent en <strong className="text-ink">{byMentionTb[0].label}</strong> ({fmtPct(byMentionTb[0].part_mention_tb as number)}).</>,
    <>Les candidates formulent {fmtPct(total.part_filles_voeux as number)} des vœux et représentent {fmtPct(total.part_filles_admis as number)} des admis.</>,
  ].filter(Boolean);

  return (
    <PageTransition>
      <PageHeader title="Profils & équité" eyebrow="Tableau de bord" icon={Users}>
        Qui candidate et qui est admis : série du bac, mention, statut de boursier et genre. Les parts d&apos;admis par bac et par mention
        portent sur les admis néo-bacheliers (bac de l&apos;année).
      </PageHeader>
      <Suspense>
        <FilterBar options={filterOptions()} />
      </Suspense>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Origine scolaire des vœux"
          aiQuestion={`Analyse l'origine scolaire des vœux (bac général, techno, pro, autres) par type de formation (${sub}) et son évolution depuis 2021.`}
          subtitle={`Répartition des vœux en phase principale · ${sub}`}
          table={{ columns: ["Type", ...bacSeriesVoeux.map((s) => s.label)], rows: bacVoeux.map((r) => [r.label, ...bacSeriesVoeux.map((s) => fmtPct(r[s.key as keyof typeof r] as number))]) }}
        >
          <HBarChart data={bacVoeux} series={bacSeriesVoeux} unit="pct" stacked labelWidth={140} />
        </ChartCard>
        <ChartCard
          title="Origine scolaire des admis néo-bacheliers"
          aiQuestion={`Compare la série de bac des candidats (vœux) et des admis par type de formation (${sub}) : quelles filières sélectionnent davantage selon la série du bac ?`}
          subtitle={`Répartition par série de bac · ${sub}`}
          table={{ columns: ["Type", ...BAC.map((s) => s.label)], rows: bacAdmis.map((r) => [r.label, ...BAC.map((s) => fmtPct(r[s.key as keyof typeof r] as number))]) }}
          note="Comparer aux vœux : un écart signale une sélection différenciée selon la série du bac (ex. bacheliers professionnels en BTS vs en licence)."
        >
          <HBarChart data={bacAdmis} series={BAC} unit="pct" stacked labelWidth={140} />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Mention au bac des admis"
          aiQuestion={`Analyse la répartition des mentions au bac des admis par type de formation (${sub}) : où se concentrent les mentions Très bien, et comment cela évolue-t-il depuis 2021 ?`}
          subtitle={`Admis néo-bacheliers · ${sub}`}
          table={{ columns: ["Type", ...MENTIONS.map((m) => m.label)], rows: mentions.map((r) => [String(r.label), ...MENTIONS.map((m) => fmtPct(r[m.key] as number))]) }}
        >
          <HBarChart data={mentions} series={MENTIONS} unit="pct" stacked labelWidth={140} />
        </ChartCard>
        <ChartCard
          title="Accès aux propositions : boursiers et non-boursiers"
          aiQuestion={`Les boursiers reçoivent-ils moins de propositions que les non-boursiers (${sub}) ? Dans quels types de formation et filières l'écart est-il le plus fort ?`}
          subtitle={`Part des vœux de terminale ayant reçu une proposition · ${sub}`}
          table={{
            columns: ["Type", "Boursiers", "Non-boursiers"],
            rows: byType.map((r) => [r.label, fmtPct(r.taux_proposition_boursiers as number), fmtPct(r.taux_proposition_non_boursiers as number)]),
          }}
          note="Propositions reçues par les candidats en terminale rapportées à leurs vœux en phase principale."
        >
          <HBarChart
            data={byType}
            unit="pct"
            labelWidth={140}
            xDomain={[0, 100]}
            series={[
              { key: "taux_proposition_boursiers", label: "Boursiers", color: "var(--series-1)" },
              { key: "taux_proposition_non_boursiers", label: "Non-boursiers", color: "var(--series-2)" },
            ]}
          />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Part des filles : vœux et admis"
          aiQuestion={`Compare la part de filles parmi les vœux et parmi les admis par type de formation (${sub}) : où l'écart est-il le plus marqué et comment évolue-t-il ?`}
          subtitle={`Par type de formation · ${sub}`}
          table={{ columns: ["Type", "Vœux", "Admis"], rows: byType.map((r) => [r.label, fmtPct(r.part_filles_voeux as number), fmtPct(r.part_filles_admis as number)]) }}
        >
          <HBarChart
            data={byType}
            unit="pct"
            labelWidth={140}
            xDomain={[0, 100]}
            series={[
              { key: "part_filles_voeux", label: "Vœux", color: "var(--series-1)" },
              { key: "part_filles_admis", label: "Admis", color: "var(--series-2)" },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Évolution de la mixité sociale et de genre"
          aiQuestion={`Analyse l'évolution 2021-2025 de la part de boursiers et de filles parmi les vœux et les admis (${scopeLabel(f.scope)}).`}
          subtitle={`2021-2025 · ${scopeLabel(f.scope)}`}
          table={{
            columns: ["Session", "Boursiers (vœux)", "Boursiers (admis)", "Filles (vœux)", "Filles (admis)"],
            rows: evo.map((r) => [String(r.session), fmtPct(r.part_boursiers_voeux as number), fmtPct(r.part_boursiers_admis as number), fmtPct(r.part_filles_voeux as number), fmtPct(r.part_filles_admis as number)]),
          }}
        >
          <TrendChart
            data={evo.map((r) => ({
              session: r.session as number,
              part_boursiers_voeux: r.part_boursiers_voeux as number,
              part_boursiers_admis: r.part_boursiers_admis as number,
              part_filles_voeux: r.part_filles_voeux as number,
              part_filles_admis: r.part_filles_admis as number,
            }))}
            unit="pct"
            yDomain={[0, 100]}
            series={[
              { key: "part_boursiers_voeux", label: "Boursiers · vœux", color: "var(--series-1)" },
              { key: "part_boursiers_admis", label: "Boursiers · admis", color: "var(--series-2)" },
              { key: "part_filles_voeux", label: "Filles · vœux", color: "var(--series-3)" },
              { key: "part_filles_admis", label: "Filles · admis", color: "var(--series-4)" },
            ]}
          />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Proposition reçue avant les résultats du bac"
          aiQuestion={`Quels types de formation et filières donnent le plus de propositions avant le bac (${sub}) ? Est-ce lié à la sélectivité ou au profil des candidats ?`}
          subtitle={`Part des admis · ${sub}`}
          table={{ columns: ["Type", "Avant le bac", "Dès l'ouverture"], rows: byType.map((r) => [r.label, fmtPct(r.part_admis_avant_bac as number), fmtPct(r.part_admis_ouverture as number)]) }}
          note="Une proposition précoce reflète la position du candidat dans le classement et le calendrier d'acceptation des autres candidats."
        >
          <HBarChart
            data={[...byType].sort((a, b) => n(b, "part_admis_avant_bac") - n(a, "part_admis_avant_bac"))}
            unit="pct"
            labelWidth={140}
            xDomain={[0, 100]}
            series={[{ key: "part_admis_avant_bac", label: "Avant le bac", color: "var(--series-1)" }]}
          />
        </ChartCard>
        <Insights items={insights} />
      </div>
    </PageTransition>
  );
}
