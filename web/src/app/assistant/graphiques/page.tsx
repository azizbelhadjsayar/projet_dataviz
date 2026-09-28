import { ArrowLeft, ChartColumnBig, Sparkles } from "lucide-react";
import Link from "next/link";
import { AgentChart } from "@/components/agent/AgentChart";
import { SqlCode } from "@/components/agent/SqlCode";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { buildChart } from "@/lib/agent/charts";
import { CHART_EXAMPLES } from "@/lib/agent/chart-examples";
import { runQuery } from "@/lib/agent/db";
import type { ChartPayload } from "@/lib/agent/types";

export const metadata = { title: "Galerie des graphiques de l'agent" };

// Galerie : chaque graphique est construit exactement comme par l'agent (même SQL DuckDB, même create_chart),
// sans appeler de modèle — aucun quota consommé.
export default async function ChartGalleryPage() {
  const examples = await Promise.all(CHART_EXAMPLES.map(async (ex, i) => {
    try {
      const res = await runQuery(ex.sql, { maxRows: 200 });
      return { ...ex, chart: buildChart(res, ex.args, `g${i + 1}`) as ChartPayload, error: null };
    } catch (e) {
      return { ...ex, chart: null, error: (e as Error).message };
    }
  }));

  const params = (a: Record<string, unknown>) =>
    (["type", "x", "y", "color_by", "facet_by", "unit", "unit2"] as const)
      .filter((k) => a[k] !== undefined)
      .map((k) => [k, Array.isArray(a[k]) ? (a[k] as string[]).join(", ") : String(a[k])]);

  return (
    <PageTransition>
      <PageHeader
        title="Galerie des graphiques"
        eyebrow="Agent d'analyse"
        icon={ChartColumnBig}
        crumbs={[{ label: "Agent d'analyse", href: "/assistant" }, { label: "Galerie des graphiques" }]}
        actions={
          <Link href="/assistant" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm text-ink-2 shadow-card hover:text-ink">
            <ArrowLeft size={15} /> Retour à l&apos;agent
          </Link>
        }
      >
        Tous les types de graphiques que l&apos;agent peut créer, construits sur les vraies données avec les mêmes paramètres que lui
        (panneaux par année, 3ᵉ dimension en couleur, graphique combiné, carte de chaleur…). Aucun modèle n&apos;est appelé ici.
      </PageHeader>

      <nav aria-label="Exemples" className="mb-6 flex flex-wrap gap-2">
        {examples.map((ex, i) => (
          <a key={i} href={`#ex-${i + 1}`} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-2 hover:border-accent/50 hover:text-ink">
            {i + 1}. {ex.name}
          </a>
        ))}
      </nav>

      <div className="space-y-10">
        {examples.map((ex, i) => (
          <section key={i} id={`ex-${i + 1}`} className="scroll-mt-24">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-ink">
                <span className="tabular mr-2 text-muted">{String(i + 1).padStart(2, "0")}</span>{ex.name}
              </h2>
              <Link href={`/assistant?q=${encodeURIComponent(ex.question)}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft/60 px-2.5 text-xs font-medium text-accent hover:bg-accent-soft">
                <Sparkles size={14} /> Poser la question à l&apos;agent
              </Link>
            </div>
            <p className="mb-2 text-sm text-ink-2">« {ex.question} »</p>
            <div className="mb-1 flex flex-wrap gap-1.5">
              {params(ex.args).map(([k, v]) => (
                <span key={k} className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-2">
                  <span className="text-muted">{k}</span> = {v}
                </span>
              ))}
            </div>
            {ex.chart ? (
              <AgentChart chart={ex.chart} />
            ) : (
              <p className="my-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">Erreur : {ex.error}</p>
            )}
            <details className="rounded-lg border border-line bg-surface">
              <summary className="cursor-pointer px-3 py-2 text-xs text-ink-2">Requête SQL</summary>
              <div className="border-t border-line p-3"><SqlCode sql={ex.sql} /></div>
            </details>
          </section>
        ))}
      </div>
    </PageTransition>
  );
}
