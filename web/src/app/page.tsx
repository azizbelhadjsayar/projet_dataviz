import { GraduationCap, LayoutDashboard, Percent, Scale, Send, Ticket, UserCheck } from "lucide-react";
import { Suspense } from "react";
import { ChartCard } from "@/components/ChartCard";
import { FilterBar } from "@/components/FilterBar";
import { HBarChart } from "@/components/charts/HBarChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { HeroStat } from "@/components/HeroStat";
import { Insights, PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { StatTile } from "@/components/StatTile";
import { aggregate, labeled } from "@/lib/data/query";
import { METRICS, SESSIONS, type MetricId } from "@/lib/data/schema";
import { parseFilters, withSessionFilter, type SearchParams } from "@/lib/filters";
import { fmtCompact, fmtInt, fmtPct, fmtRatio } from "@/lib/format";
import { filterOptions, scopeLabel } from "@/lib/page-data";

const KPIS: { id: MetricId; icon: typeof Ticket }[] = [
  { id: "nb_formations", icon: GraduationCap },
  { id: "capacite", icon: Ticket },
  { id: "voeux_pp", icon: Send },
  { id: "admis_total", icon: UserCheck },
  { id: "taux_acces_moyen", icon: Percent },
  { id: "voeux_par_place", icon: Scale },
];

export default async function Overview({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const f = parseFilters(await searchParams);
  const ids = KPIS.map((k) => k.id);
  const cur = aggregate({ metrics: ids, filters: f.withSession }).rows[0] ?? {};
  const prev = f.previous ? aggregate({ metrics: ids, filters: withSessionFilter(f.scope, f.previous) }).rows[0] ?? {} : {};

  const evo = aggregate({
    groupBy: ["session"],
    metrics: ["voeux_pp", "capacite", "admis_total", "taux_acces_moyen", "nb_formations", "voeux_par_place"],
    filters: f.scope,
  }).rows;
  const trendOf = (m: MetricId) => SESSIONS.map((s) => (evo.find((r) => r.session === s)?.[m] as number | null) ?? null);
  const sessionIndex = (SESSIONS as readonly number[]).indexOf(f.session);
  const base = evo[0] ?? {};
  const indexed = evo.map((r) => ({
    session: r.session as number,
    voeux_pp: base.voeux_pp ? (100 * (r.voeux_pp as number)) / (base.voeux_pp as number) : null,
    capacite: base.capacite ? (100 * (r.capacite as number)) / (base.capacite as number) : null,
    admis_total: base.admis_total ? (100 * (r.admis_total as number)) / (base.admis_total as number) : null,
  }));

  const byType = labeled(aggregate({
    groupBy: ["type_formation"],
    metrics: ["voeux_pp", "taux_acces_moyen", "voeux_par_place", "nb_formations", "capacite"],
    filters: f.withSession,
    sortBy: "voeux_pp",
  }).rows, "type_formation");
  const byAccess = [...byType].filter((r) => r.taux_acces_moyen !== null).sort((a, b) => (a.taux_acces_moyen as number) - (b.taux_acces_moyen as number));

  // Faits saillants calculés sur le périmètre filtré
  const first = evo[0], last = evo.at(-1);
  const growth = (k: string) => first && last && first[k] ? (100 * ((last[k] as number) - (first[k] as number))) / (first[k] as number) : null;
  const gV = growth("voeux_pp"), gC = growth("capacite");
  const mostSelective = byAccess[0];
  const mostDemanded = [...byType].filter((r) => (r.nb_formations as number) >= 20).sort((a, b) => (b.voeux_par_place as number) - (a.voeux_par_place as number))[0];
  const signed = (v: number) => `${v >= 0 ? "+" : "−"}${fmtRatio(Math.abs(v))} %`;
  const insights = [
    gV !== null && gC !== null && (
      <>Entre {first!.session} et {last!.session}, les vœux en phase principale évoluent de <strong className="text-ink">{signed(gV)}</strong> contre <strong className="text-ink">{signed(gC)}</strong> pour les places : {gV > gC ? "la pression sur l'offre s'accroît." : "l'offre suit ou dépasse la demande."}</>
    ),
    mostSelective && (
      <>En {f.session}, le type de formation au taux d&apos;accès moyen le plus bas est <strong className="text-ink">{mostSelective.label}</strong> ({fmtPct(mostSelective.taux_acces_moyen as number)}).</>
    ),
    mostDemanded && (
      <>La demande par place est la plus forte en <strong className="text-ink">{mostDemanded.label}</strong> : {fmtRatio(mostDemanded.voeux_par_place as number)} vœux par place en {f.session}.</>
    ),
    <>Chaque candidat formule plusieurs vœux : les totaux de vœux ne sont <strong className="text-ink">pas</strong> des nombres de candidats.</>,
  ].filter(Boolean);

  const scope = scopeLabel(f.scope);
  const vNow = cur.voeux_pp as number | null;
  const vPrev = prev.voeux_pp as number | null | undefined;
  const heroDelta = vNow && vPrev ? (100 * (vNow - vPrev)) / vPrev : null;

  return (
    <PageTransition>
      <PageHeader title="Vue d'ensemble" eyebrow="Tableau de bord" icon={LayoutDashboard}>
        Offre de formation, demande et accès dans Parcoursup de 2021 à 2025. Les indicateurs portent sur la session
        choisie ; les courbes montrent l&apos;évolution sur les cinq sessions pour le même périmètre.
      </PageHeader>
      <Suspense>
        <FilterBar options={filterOptions()} />
      </Suspense>

      <HeroStat
        label={`Vœux en phase principale · session ${f.session}`}
        value={fmtCompact(vNow)}
        aside={
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <span className="text-muted">Places proposées</span>
            <span className="tabular text-right font-medium text-ink">{fmtInt(cur.capacite as number)}</span>
            <span className="text-muted">Vœux par place</span>
            <span className="tabular text-right font-medium text-ink">{fmtRatio(cur.voeux_par_place as number)}</span>
            <span className="text-muted">Formations</span>
            <span className="tabular text-right font-medium text-ink">{fmtInt(cur.nb_formations as number)}</span>
          </div>
        }
      >
        {heroDelta !== null
          ? <>{signed(heroDelta)} par rapport à {f.previous}. Périmètre : {scope}.</>
          : <>Première session de la série. Périmètre : {scope}.</>}
      </HeroStat>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((k) => (
          <StatTile
            key={k.id}
            icon={k.icon}
            label={METRICS[k.id].label}
            value={(cur[k.id] as number) ?? null}
            unit={METRICS[k.id].unit}
            previous={f.previous ? ((prev[k.id] as number) ?? null) : undefined}
            previousLabel={f.previous ? String(f.previous) : undefined}
            hint={METRICS[k.id].description}
            trend={trendOf(k.id)}
            trendIndex={sessionIndex}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Demande, offre et admissions"
          subtitle={`Indice base 100 en 2021 · ${scope}`}
          aiQuestion={`Analyse l'évolution 2021-2025 des vœux en phase principale, des places et des admis (périmètre : ${scope}). La demande progresse-t-elle plus vite que l'offre ? Quelles filières expliquent l'évolution, notamment en 2025 ?`}
          table={{
            columns: ["Session", "Vœux PP", "Places", "Admis", "Formations"],
            rows: evo.map((r) => [String(r.session), fmtInt(r.voeux_pp as number), fmtInt(r.capacite as number), fmtInt(r.admis_total as number), fmtInt(r.nb_formations as number)]),
          }}
          note="Indice = valeur de la session / valeur 2021 × 100. Les trois séries partagent donc le même axe."
        >
          <TrendChart
            data={indexed}
            unit="ratio"
            reference={100}
            series={[
              { key: "voeux_pp", label: "Vœux (PP)", color: "var(--series-1)" },
              { key: "capacite", label: "Places", color: "var(--series-2)" },
              { key: "admis_total", label: "Admis", color: "var(--series-3)" },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Taux d'accès moyen"
          subtitle="Pondéré par les vœux, par session"
          aiQuestion={`Pourquoi le taux d'accès moyen évolue-t-il ainsi entre 2021 et 2025 (périmètre : ${scope}) ? Distingue l'effet de la définition 2021 et les évolutions réelles par type de formation.`}
          table={{ columns: ["Session", "Taux d'accès"], rows: evo.map((r) => [String(r.session), fmtPct(r.taux_acces_moyen as number)]) }}
          note="Le taux d'accès 2021 repose sur une définition source différente : la rupture 2021 → 2022 est en partie méthodologique."
        >
          <TrendChart
            data={evo.map((r) => ({ session: r.session as number, taux: r.taux_acces_moyen as number }))}
            unit="pct"
            yDomain={[0, 100]}
            annotations={[{ x: 2021, label: "déf. différente" }]}
            series={[{ key: "taux", label: "Taux d'accès moyen", color: "var(--series-1)" }]}
          />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Où se portent les vœux"
          subtitle={`Vœux en phase principale par type de formation · ${f.session}`}
          aiQuestion={`Compare les types de formation en ${f.session} (périmètre : ${scope}) : vœux, places, vœux par place et taux d'accès. Lesquels sont sous tension ?`}
          table={{
            columns: ["Type", "Vœux PP", "Places", "Vœux / place", "Formations"],
            rows: byType.map((r) => [r.label, fmtInt(r.voeux_pp as number), fmtInt(r.capacite as number), fmtRatio(r.voeux_par_place as number), fmtInt(r.nb_formations as number)]),
          }}
        >
          <HBarChart data={byType} unit="count" labelWidth={140} series={[{ key: "voeux_pp", label: "Vœux (PP)", color: "var(--series-1)" }]} />
        </ChartCard>
        <ChartCard
          title="Accès selon le type de formation"
          subtitle={`Taux d'accès moyen par type de formation · ${f.session}`}
          aiQuestion={`Explique les écarts de taux d'accès moyen entre types de formation en ${f.session} (périmètre : ${scope}) : quels facteurs (pression, sélectivité, secteur) les expliquent ?`}
          table={{ columns: ["Type", "Taux d'accès moyen"], rows: byAccess.map((r) => [r.label, fmtPct(r.taux_acces_moyen as number)]) }}
          note="Taux d'accès : part des candidats d'une formation qui ont pu recevoir une proposition (rang du dernier appelé)."
        >
          <HBarChart data={byAccess} unit="pct" labelWidth={140} xDomain={[0, 100]} series={[{ key: "taux_acces_moyen", label: "Taux d'accès moyen", color: "var(--series-1)" }]} />
        </ChartCard>
      </div>

      <div className="mt-6">
        <Insights items={insights} />
      </div>
    </PageTransition>
  );
}
