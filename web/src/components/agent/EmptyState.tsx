"use client";

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { AgentAvatar, MapIcon, ScaleIcon, SparklesIcon, TrendIcon, UsersIcon, BookIcon } from "./icons";

// Questions de départ : le même parcours que les tableaux de bord (ampleur → où → pour qui → décision).
const STARTERS: { icon: ComponentType<SVGProps<SVGSVGElement>>; tag: string; q: string }[] = [
  { icon: TrendIcon, tag: "Ampleur", q: "La demande progresse-t-elle plus vite que l'offre entre 2021 et 2025 ? Décompose la hausse des vœux par type de formation." },
  { icon: ScaleIcon, tag: "Où · filières", q: "Quelles filières combinent une forte demande par place et un faible taux d'accès en 2025 ?" },
  { icon: MapIcon, tag: "Où · territoires", q: "Montre sur une carte la pression (vœux par place) par département en 2025." },
  { icon: UsersIcon, tag: "Pour qui · boursiers", q: "Les boursiers reçoivent-ils moins de propositions que les non-boursiers ? Où l'écart est-il le plus fort ?" },
  { icon: BookIcon, tag: "Pour qui · séries de bac", q: "Comment a évolué la part des bacheliers professionnels parmi les admis en BTS depuis 2021 ?" },
  { icon: SparklesIcon, tag: "Décision", q: "Où faudrait-il ouvrir des places en priorité ? Croise la pression, le taux d'accès et la taille des filières en 2025." },
];

export function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="animate-fade-up mx-auto flex max-w-3xl flex-col items-center py-8 text-center sm:py-12">
      <AgentAvatar size={52} />
      <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">Que voulez-vous analyser ?</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2 sm:text-base">
        L&apos;agent planifie son analyse, écrit et exécute ses propres requêtes SQL sur les 69 240 formations × sessions,
        vérifie ses résultats, crée des graphiques et vous explique ce qu&apos;il trouve.
      </p>
      <p className="mt-3 max-w-xl rounded-lg bg-accent-soft/60 px-3 py-2 text-sm text-ink-2">
        <span className="font-semibold text-ink">Question centrale :</span> la demande progresse plus vite que l&apos;offre ; où et pour qui l&apos;accès se resserre-t-il ?
      </p>
      <div className="mt-8 grid w-full gap-3 text-left sm:grid-cols-2">
        {STARTERS.map(({ icon: Icon, tag, q }) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="group flex gap-3 rounded-xl border border-line bg-surface p-3.5 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_6px_20px_-10px_rgba(42,120,214,0.45)]"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Icon width={16} height={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-muted">{tag}</span>
              <span className="mt-0.5 block text-sm leading-snug text-ink-2 group-hover:text-ink">{q}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted">
        <SparklesIcon width={13} height={13} /> Chaque requête et chaque résultat restent consultables : l&apos;agent peut se tromper, vérifiez.
      </p>
      <Link href="/assistant/graphiques" className="mt-2 text-xs font-medium text-accent hover:underline">
        Voir la galerie des graphiques que l&apos;agent sait produire →
      </Link>
    </div>
  );
}
