import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { DIMENSIONS, METRICS, METRIC_IDS } from "@/lib/data/schema";

const unitLabel = { count: "effectif", pct: "%", ratio: "ratio" } as const;

export const metadata = { title: "Données & méthode" };

const PIPELINE = [
  { title: "Sources annuelles", text: "5 fichiers open data Parcoursup (2021 à 2025), 118 colonnes chacun.", file: "Data/2021…2025.xlsx" },
  { title: "Fusion contrôlée", text: "Mapping par nom, harmonisation des libellés, contrôle des sommes vs sources.", file: "scripts/01_fusion_parcoursup.py" },
  { title: "Formats d'analyse", text: "CSV/XLSX (Power BI), JSON colonnaire (tableaux de bord), Parquet (agent SQL).", file: "Data/processed · web/data" },
  { title: "Application", text: "Tableaux de bord Next.js et agent IA (Gemini + DuckDB) sur les mêmes données.", file: "web/" },
];

export default function MethodologiePage() {
  return (
    <PageTransition>
      <PageHeader title="Données & méthode" eyebrow="Ressources" icon={BookOpen}>
        Provenance des données, traitements appliqués, définitions des indicateurs et précautions de lecture.
      </PageHeader>

      <div className="grid max-w-5xl gap-4">
        {/* Pipeline des données */}
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Chaîne de traitement des données">
          {PIPELINE.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border border-line bg-surface p-4 shadow-card">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-semibold text-white">{i + 1}</span>
              <p className="mt-2.5 text-sm font-semibold text-ink">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">{s.text}</p>
              <p className="mt-2 font-mono text-[11px] text-muted">{s.file}</p>
            </li>
          ))}
        </ol>

        <section className="rounded-xl border border-line bg-surface p-5 shadow-card text-sm leading-relaxed text-ink-2">
          <h2 className="text-base font-semibold text-ink">Source et fusion</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Open data « Parcoursup : vœux de poursuite d&apos;études et admissions » (ministère de l&apos;Enseignement supérieur), un fichier par session de 2021 à 2025 (118 colonnes chacun).</li>
            <li>Fusion en un seul fichier de <strong className="text-ink">69 240 lignes × 79 colonnes</strong> (une ligne = une formation pour une session) : <code>scripts/01_fusion_parcoursup.py</code>.</li>
            <li>Colonnes associées <strong className="text-ink">par nom</strong> (l&apos;ordre change entre 2021 et 2022+). Les deux colonnes homonymes « Filière de formation » ont un sens inversé entre 2021 et 2022+ : elles sont distinguées automatiquement (filière agrégée vs intitulé).</li>
            <li>Harmonisation des libellés : régions (« Centre » → « Centre-Val de Loire », « Grand-Est » → « Grand Est », etc.), académies, types de formation ; région manquante 2024-2025 (Polynésie, étranger) déduite de l&apos;académie ; coordonnées GPS séparées en latitude / longitude.</li>
            <li>Colonnes retirées : pourcentages (recalculés à partir des effectifs), colonnes techniques et doublons.</li>
            <li>Contrôles automatiques : nombre de lignes, somme de chaque effectif et nombre de valeurs non nulles identiques aux fichiers sources, clé (session, cod_aff_form) unique.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 shadow-card text-sm leading-relaxed text-ink-2">
          <h2 className="text-base font-semibold text-ink">Précautions de lecture</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong className="text-ink">Vœux ≠ candidats.</strong> Chaque candidat formule plusieurs vœux ; les totaux de vœux ne sont pas des nombres de personnes.</li>
            <li><strong className="text-ink">Taux d&apos;accès 2021</strong> : libellé et définition source différents des sessions suivantes ; la comparaison 2021 → 2022 est en partie méthodologique.</li>
            <li>Les ratios sont calculés sur des sommes (ex. vœux totaux / places totales), jamais comme moyenne de ratios. Le taux d&apos;accès moyen est pondéré par les vœux en phase principale.</li>
            <li>Parts de boursiers, de mentions et de séries de bac chez les admis : dénominateur = admis néo-bacheliers (définition officielle, vérifiée sur les pourcentages sources).</li>
            <li>L&apos;offre évolue d&apos;une session à l&apos;autre (formations ouvertes, fermées, intégrées à Parcoursup) : une hausse des vœux peut refléter un élargissement du périmètre.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-base font-semibold">Indicateurs</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-ink-2">
                  <th className="border-b border-grid py-2 pr-3 font-semibold">Identifiant</th>
                  <th className="border-b border-grid py-2 pr-3 font-semibold">Libellé</th>
                  <th className="border-b border-grid py-2 pr-3 font-semibold">Unité</th>
                  <th className="border-b border-grid py-2 font-semibold">Définition</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_IDS.map((id) => (
                  <tr key={id} className="align-top">
                    <td className="border-b border-grid py-1.5 pr-3 font-mono text-xs">{id}</td>
                    <td className="border-b border-grid py-1.5 pr-3">{METRICS[id].label}</td>
                    <td className="border-b border-grid py-1.5 pr-3 text-ink-2">{unitLabel[METRICS[id].unit]}</td>
                    <td className="border-b border-grid py-1.5 text-ink-2">{METRICS[id].description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 shadow-card text-sm text-ink-2">
          <h2 className="text-base font-semibold text-ink">Dimensions d&apos;analyse</h2>
          <p className="mt-2">{Object.values(DIMENSIONS).join(" · ")}</p>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 shadow-card text-sm leading-relaxed text-ink-2">
          <h2 className="text-base font-semibold text-ink">Architecture</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Application Next.js ; les données (format colonnaire compact) sont chargées une fois en mémoire côté serveur et agrégées à la demande pour les tableaux de bord.</li>
            <li>Agent d&apos;analyse : modèle Gemini Flash dans une boucle autonome (jusqu&apos;à 12 étapes). Il écrit et exécute ses propres requêtes SQL sur une base DuckDB en mémoire (même fichier fusionné), lit les résultats, corrige ses erreurs, crée des graphiques et conclut.</li>
            <li>Contexte de l&apos;agent : schéma des 79 colonnes, valeurs des colonnes catégorielles, recettes de calcul des indicateurs (ratios de sommes), précautions de lecture et repères chiffrés ; les requêtes des échanges précédents servent de mémoire de travail.</li>
            <li>Sécurité : requêtes SELECT uniquement (vérifiées par le parseur DuckDB), accès aux fichiers et au réseau désactivé, délai et nombre de lignes plafonnés.</li>
          </ul>
        </section>
      </div>
    </PageTransition>
  );
}
