"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Pied de page (masqué sur l'agent, dont la zone de saisie occupe le bas de l'écran). */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/assistant")) return null;
  return (
    <footer className="mt-14 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line pt-5 pb-1 text-xs text-muted">
      <p>
        Données : open data Parcoursup (ministère de l&apos;Enseignement supérieur), sessions 2021 à 2025 — 69 240 formations × sessions.
      </p>
      <p className="flex gap-4">
        <Link href="/methodologie" className="hover:text-ink">Données & méthode</Link>
        <span>Projet Dataviz · Master 2</span>
      </p>
    </footer>
  );
}
