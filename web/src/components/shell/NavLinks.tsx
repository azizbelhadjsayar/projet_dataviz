"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { isActive, KEEP_PARAMS, NAV_SECTIONS } from "./nav";

/** Point discret affiché seulement si la navigation prend du temps. */
function PendingHint() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`link-hint ml-auto shrink-0 ${pending ? "is-pending" : ""}`} />;
}

function List({ qs, onNavigate }: { qs: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="space-y-5">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="sidebar-section mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{section.title}</p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.keepFilters && qs ? `${item.href}?${qs}` : item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                    className={`sidebar-item group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                      active ? "nav-active font-semibold text-ink" : "text-ink-2 hover:translate-x-0.5 hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    {active && <span aria-hidden className="bg-brand absolute -left-3 top-1.5 bottom-1.5 w-1 rounded-r-full" />}
                    <Icon size={18} strokeWidth={1.8} className={`shrink-0 ${active ? "text-accent" : "text-muted group-hover:text-ink-2"}`} />
                    <span className="sidebar-label truncate">{item.label}</span>
                    {item.badge && (
                      <span className="sidebar-label rounded-full bg-brand px-1.5 py-px text-[10px] font-semibold text-white">{item.badge}</span>
                    )}
                    <PendingHint />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ListWithFilters({ onNavigate }: { onNavigate?: () => void }) {
  const sp = useSearchParams();
  const kept = new URLSearchParams();
  for (const k of KEEP_PARAMS) {
    const v = sp.get(k);
    if (v) kept.set(k, v);
  }
  return <List qs={kept.toString()} onNavigate={onNavigate} />;
}

/** Liens de navigation ; les filtres globaux de l'URL suivent la navigation entre tableaux de bord. */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<List qs="" onNavigate={onNavigate} />}>
      <ListWithFilters onNavigate={onNavigate} />
    </Suspense>
  );
}
