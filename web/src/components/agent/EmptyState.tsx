"use client";

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { AgentAvatar, MapIcon, ScaleIcon, SparklesIcon, TrendIcon, UsersIcon, LinkIcon, BookIcon } from "./icons";

const STARTERS: { icon: ComponentType<SVGProps<SVGSVGElement>>; tag: string; q: string }[] = [
  { icon: ScaleIcon, tag: "Sélectivité", q: "À filière égale, les formations privées sont-elles plus sélectives que les publiques ?" },
  { icon: TrendIcon, tag: "Tendances", q: "Quelles formations ont vu leur taux d'accès chuter le plus entre 2022 et 2025 ?" },
  { icon: UsersIcon, tag: "Équité", q: "Les boursiers reçoivent-ils moins de propositions que les non-boursiers ? Où l'écart est-il le plus fort ?" },
  { icon: LinkIcon, tag: "Corrélations", q: "Y a-t-il un lien entre la pression de la demande (vœux par place) et le taux d'accès selon les filières ?" },
  { icon: BookIcon, tag: "Profils", q: "Comment a évolué la part des bacheliers professionnels parmi les admis en BTS depuis 2021 ?" },
  { icon: MapIcon, tag: "Territoires", q: "Quelles académies recrutent le plus localement, et est-ce lié à la taille de leur offre ?" },
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
