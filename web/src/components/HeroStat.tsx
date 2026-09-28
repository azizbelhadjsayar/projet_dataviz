import type { ReactNode } from "react";

interface Props {
  /** Chiffre principal déjà formaté (ex. « 13,1 M »). */
  value: string;
  label: string;
  children?: ReactNode;
  aside?: ReactNode;
}

/** Chiffre « héros » : le nombre par lequel la page commence (un seul par vue). */
export function HeroStat({ value, label, children, aside }: Props) {
  return (
    <section className="relative mb-4 overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-7">
      {/* halo décoratif très discret aux couleurs de la marque */}
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand opacity-[0.07] blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 max-w-2xl">
          <p className="text-sm font-medium text-ink-2">{label}</p>
          <p className="mt-1 text-5xl font-semibold leading-none tracking-tight text-ink sm:text-6xl">{value}</p>
          {children && <p className="mt-3 text-sm leading-relaxed text-ink-2 sm:text-[0.9375rem]">{children}</p>}
        </div>
        {aside && <div className="relative shrink-0">{aside}</div>}
      </div>
    </section>
  );
}
