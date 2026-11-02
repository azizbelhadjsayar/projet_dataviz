import { ArrowRight, Lightbulb, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface Props {
  title: string;
  /** Sur-titre (section de navigation). */
  eyebrow?: string;
  icon?: LucideIcon;
  children?: ReactNode;
  actions?: ReactNode;
  /** Numéro de chapitre du parcours (ex. « 02 »), affiché en grand à côté du titre. */
  chapter?: string;
  /** Fil d'Ariane : [{label, href?}] */
  crumbs?: { label: string; href?: string }[];
}

export function PageHeader({ title, eyebrow, icon: Icon, children, actions, crumbs, chapter }: Props) {
  return (
    <header className="mb-6">
      {crumbs && (
        <nav aria-label="Fil d'Ariane" className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>/</span>}
              {c.href ? <Link href={c.href} className="hover:text-ink">{c.label}</Link> : <span className="text-ink-2">{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 max-w-4xl items-start gap-5">
          {chapter && <span aria-hidden className="chapter-num animate-fade-up hidden text-[6.5rem] sm:block">{chapter}</span>}
          <div className="min-w-0">
          {eyebrow && (
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
              {Icon && <Icon size={14} strokeWidth={2} />} {eyebrow}
            </p>
          )}
          <h1 className="title-gradient pb-1 text-3xl font-bold tracking-tight sm:text-[2.35rem] sm:leading-tight">{title}</h1>
          {children && <p className="mt-2 text-sm leading-relaxed text-ink-2 sm:text-[0.9375rem]">{children}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** « À retenir » : faits saillants calculés, présentés en cartes. */
export function Insights({ items, title = "À retenir" }: { items: ReactNode[]; title?: string }) {
  if (!items.length) return null;
  return (
    <section aria-label={title} className="reveal">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <span className="icon-chip flex h-7 w-7 items-center justify-center rounded-lg">
          <Lightbulb size={15} strokeWidth={2} />
        </span>
        {title}
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((it, i) => (
          <div key={i} className="card card-lift rounded-xl border border-line p-4 text-sm leading-relaxed text-ink-2 shadow-card">
            <span className="title-gradient mb-1.5 block text-lg font-bold tabular">{String(i + 1).padStart(2, "0")}</span>
            {it}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Fil de lecture : en bas d'un tableau de bord, la question suivante du parcours (filtres conservés). */
export function NextStep({ href, step, title, children }: { href: string; step: string; title: string; children?: ReactNode }) {
  return (
    <Link
      href={href}
      className="next-step card-lift reveal group mt-8 flex items-center justify-between gap-4 rounded-xl p-4 shadow-card transition-all hover:shadow-raised sm:p-5"
    >
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-wider text-accent">Étape suivante · {step}</span>
        <span className="mt-1 block text-base font-semibold text-ink">{title}</span>
        {children && <span className="mt-0.5 block text-sm text-ink-2">{children}</span>}
      </span>
      <span className="icon-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:translate-x-1.5 group-hover:scale-110">
        <ArrowRight size={18} />
      </span>
    </Link>
  );
}
