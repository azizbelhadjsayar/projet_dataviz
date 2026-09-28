import { ExternalLink, MapPin, Percent, Scale, Send, Sparkles, Ticket, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartCard } from "@/components/ChartCard";
import { HBarChart } from "@/components/charts/HBarChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { StatTile } from "@/components/StatTile";
import { Badge } from "@/components/ui/Badge";
import { aggregate, formationHistory } from "@/lib/data/query";
import { METRICS, SESSIONS, type MetricId } from "@/lib/data/schema";
import { fmtInt, fmtPct, fmtRatio } from "@/lib/format";

const HISTORY_METRICS: MetricId[] = [
  "capacite", "voeux_pp", "admis_total", "taux_acces_moyen", "voeux_par_place", "taux_remplissage",
  "part_boursiers_admis", "part_filles_admis", "part_mention_tb",
];
const TILES: { id: MetricId; icon: typeof Ticket }[] = [
  { id: "capacite", icon: Ticket },
  { id: "voeux_pp", icon: Send },
  { id: "admis_total", icon: UserCheck },
  { id: "voeux_par_place", icon: Scale },
  { id: "taux_acces_moyen", icon: Percent },
  { id: "part_boursiers_admis", icon: Users },
];
const COMPARE: MetricId[] = ["taux_acces_moyen", "taux_remplissage", "part_boursiers_admis", "part_mention_tb", "part_filles_admis"];

export default async function FormationPage({ params }: { params: Promise<{ cod: string }> }) {
  const { cod } = await params;
  const rows = formationHistory(decodeURIComponent(cod), HISTORY_METRICS);
  if (!rows.length) notFound();
  const last = rows.at(-1)!;
  const prev = rows.length > 1 ? rows.at(-2)! : null;
  const trendOf = (m: MetricId) => SESSIONS.map((s) => (rows.find((r) => r.session === s)?.[m] as number | null) ?? null);
  const lastIndex = (SESSIONS as readonly number[]).indexOf(Number(last.session));

  // Moyenne de la filière (même session) pour situer la formation
  const peer = aggregate({
    metrics: [...COMPARE, "voeux_par_place", "nb_formations"],
    filters: { filiere: [String(last.filiere)], session: [String(last.session)] },
  }).rows[0] ?? {};
  const compare = COMPARE.map((m) => ({ label: METRICS[m].label, formation: last[m] as number | null, filiere: peer[m] as number | null }));

  const name = String(last.formation);
  return (
    <PageTransition>
      <PageHeader
        title={name}
        crumbs={[{ label: "Explorer", href: "/explorer" }, { label: String(last.type_formation) }, { label: name.length > 60 ? `${name.slice(0, 58)}…` : name }]}
        actions={
          <>
            <a href={String(last.lien)} target="_blank" rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm text-ink-2 shadow-card hover:text-ink">
              <ExternalLink size={15} /> Fiche Parcoursup
            </a>
            <Link href={`/assistant?q=${encodeURIComponent(`Analyse la formation « ${name} » (${last.etablissement}, ${last.commune}, cod_aff_form ${cod}) : évolution 2021-2025, sélectivité, profil des admis, et comparaison avec les autres formations de la filière « ${last.filiere} ».`)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white shadow-card hover:opacity-90">
              <Sparkles size={15} /> Analyser avec l&apos;IA
            </Link>
          </>
        }
      >
        <span className="inline-flex flex-wrap items-center gap-x-1.5">
          <span className="font-medium text-ink">{last.etablissement}</span>
          <span className="inline-flex items-center gap-1"><MapPin size={13} /> {last.commune} ({last.departement}, {last.region})</span>
        </span>
      </PageHeader>

      <div className="-mt-3 mb-6 flex flex-wrap gap-1.5">
        <Badge tone="accent">{last.type_formation}</Badge>
        <Badge>{last.filiere}</Badge>
        <Badge>{last.selectivite}</Badge>
        <Badge tone="outline">{last.secteur}</Badge>
        <Badge tone="outline">Sessions {rows[0].session}–{last.session}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {TILES.map(({ id, icon }) => (
          <StatTile
            key={id}
            icon={icon}
            label={METRICS[id].label}
            value={last[id] as number | null}
            unit={METRICS[id].unit}
            previous={prev ? (prev[id] as number | null) : undefined}
            previousLabel={prev ? String(prev.session) : undefined}
            trend={trendOf(id)}
            trendIndex={lastIndex}
            hint={`${METRICS[id].description} (session ${last.session})`}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Places, vœux et admis"
          subtitle={`Sessions ${rows[0].session}–${last.session}`}
          table={{ columns: ["Session", "Places", "Vœux PP", "Admis"], rows: rows.map((r) => [String(r.session), fmtInt(r.capacite as number), fmtInt(r.voeux_pp as number), fmtInt(r.admis_total as number)]) }}
        >
          <TrendChart
            data={rows.map((r) => ({ session: r.session as number, voeux_pp: r.voeux_pp as number, capacite: r.capacite as number, admis_total: r.admis_total as number }))}
            unit="count"
            series={[
              { key: "voeux_pp", label: "Vœux (PP)", color: "var(--series-1)" },
              { key: "capacite", label: "Places", color: "var(--series-2)" },
              { key: "admis_total", label: "Admis", color: "var(--series-3)" },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Taux d'accès"
          subtitle="Part des candidats ayant pu recevoir une proposition"
          table={{ columns: ["Session", "Taux d'accès", "Vœux / place"], rows: rows.map((r) => [String(r.session), fmtPct(r.taux_acces_moyen as number), fmtRatio(r.voeux_par_place as number)]) }}
          note="Définition source différente en 2021."
        >
          <TrendChart
            data={rows.map((r) => ({ session: r.session as number, taux: r.taux_acces_moyen as number }))}
            unit="pct"
            yDomain={[0, 100]}
            annotations={rows[0].session === 2021 ? [{ x: 2021, label: "déf. différente" }] : undefined}
            series={[{ key: "taux", label: "Taux d'accès", color: "var(--series-1)" }]}
          />
        </ChartCard>
      </div>

      <div className="mt-4">
        <ChartCard
          title="Comparée à sa filière"
          subtitle={`Cette formation vs l'ensemble de la filière « ${last.filiere} » (${fmtInt(peer.nb_formations as number)} formations) · session ${last.session}`}
          table={{
            columns: ["Indicateur", "Cette formation", "Filière"],
            rows: [
              ...compare.map((c) => [c.label, fmtPct(c.formation), fmtPct(c.filiere)]),
              ["Vœux par place", fmtRatio(last.voeux_par_place as number), fmtRatio(peer.voeux_par_place as number)],
            ],
          }}
          note={<>Vœux par place : {fmtRatio(last.voeux_par_place as number)} pour cette formation, {fmtRatio(peer.voeux_par_place as number)} pour la filière. Moyennes de filière pondérées (ratios de sommes).</>}
        >
          <HBarChart
            data={compare}
            unit="pct"
            labelWidth={190}
            xDomain={[0, 100]}
            series={[
              { key: "formation", label: "Cette formation", color: "var(--series-1)" },
              { key: "filiere", label: "Moyenne de la filière", color: "var(--series-2)" },
            ]}
          />
        </ChartCard>
      </div>
    </PageTransition>
  );
}
