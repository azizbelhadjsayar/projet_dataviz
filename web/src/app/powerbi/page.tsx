import { ChartColumnBig, CircleAlert, ExternalLink } from "lucide-react";
import { connection } from "next/server";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";

// Emplacement réservé au rapport Power BI (« Publier sur le web » ou lien d'incorporation).
// Renseigner POWERBI_EMBED_URL dans web/.env.local pour l'afficher.

export const metadata = { title: "Rapport Power BI" };

const STEPS = [
  <>Dans Power BI Desktop : <em>Obtenir les données → Excel</em> → <code className="rounded bg-surface-2 px-1">parcoursup_2021_2025.xlsx</code> (feuille « parcoursup »).</>,
  <>Publier le rapport sur le service Power BI (app.powerbi.com).</>,
  <><em>Fichier → Incorporer le rapport → Publier sur le web</em> (lien public) ou <em>Site web ou portail</em> (connexion requise).</>,
  <>Copier l&apos;URL de l&apos;iframe dans <code className="rounded bg-surface-2 px-1">web/.env.local</code> : <code className="rounded bg-surface-2 px-1">POWERBI_EMBED_URL=https://app.powerbi.com/view?r=…</code></>,
  <>Redémarrer le serveur : le rapport s&apos;affiche ici.</>,
];

export default async function PowerBiPage() {
  await connection();
  const url = process.env.POWERBI_EMBED_URL?.trim();
  const valid = !!url && /^https:\/\/(app\.powerbi\.com|app\.fabric\.microsoft\.com)\//.test(url);

  return (
    <PageTransition>
      <PageHeader
        title="Rapport Power BI"
        eyebrow="Ressources"
        icon={ChartColumnBig}
        actions={valid ? (
          <a href={url} target="_blank" rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm text-ink-2 shadow-card hover:text-ink">
            <ExternalLink size={15} /> Ouvrir en plein écran
          </a>
        ) : undefined}
      >
        Rapport complémentaire construit sous Power BI Desktop à partir du même fichier fusionné
        (<code className="rounded bg-surface-2 px-1">Data/processed/parcoursup_2021_2025.xlsx</code>).
      </PageHeader>
      {valid ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          <iframe title="Rapport Power BI Parcoursup" src={url} className="block aspect-[16/10] w-full" allowFullScreen />
        </div>
      ) : (
        <div className="max-w-3xl rounded-xl border border-line bg-surface p-6 shadow-card">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><ChartColumnBig size={20} /></span>
            <div>
              <p className="font-semibold text-ink">Rapport pas encore connecté</p>
              <p className="mt-0.5 text-sm text-ink-2">Cinq étapes pour l&apos;intégrer à cette page :</p>
            </div>
          </div>
          <ol className="mt-5 space-y-3">
            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-2">
                <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-xs font-semibold text-ink">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
          {url && !valid && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
              <CircleAlert size={15} /> L&apos;URL configurée n&apos;est pas une adresse app.powerbi.com valide.
            </p>
          )}
        </div>
      )}
    </PageTransition>
  );
}
