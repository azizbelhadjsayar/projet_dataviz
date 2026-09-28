"use client";

import { GraduationCap, Menu, PanelLeftClose, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { NavLinks } from "./shell/NavLinks";
import { useSidebarCollapsed } from "./shell/preferences";
import { ThemeToggle } from "./shell/ThemeToggle";

function Brand({ compactHidden = true }: { compactHidden?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3 rounded-lg outline-offset-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-card">
        <GraduationCap size={19} strokeWidth={1.9} />
      </span>
      <span className={`min-w-0 leading-tight ${compactHidden ? "sidebar-label" : ""}`}>
        <span className="block truncate text-[15px] font-semibold tracking-tight">Parcoursup</span>
        <span className="block truncate text-xs text-muted">Sessions 2021 – 2025</span>
      </span>
    </Link>
  );
}

/** Barre latérale (bureau, réductible) + barre supérieure avec menu tiroir (mobile). */
export function Sidebar() {
  const [collapsed, toggle] = useSidebarCollapsed();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Bureau */}
      <aside className="sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex">
        <div className="flex h-16 items-center px-4">
          <Brand />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <NavLinks />
        </div>
        <div className="space-y-2 border-t border-line p-3">
          <ThemeToggle />
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Déplier la barre latérale" : "Réduire la barre latérale"}
            title={collapsed ? "Déplier" : "Réduire"}
            className="sidebar-item flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <PanelLeftClose size={18} strokeWidth={1.8} className="sidebar-collapse-icon shrink-0 text-muted transition-transform" />
            <span className="sidebar-label">Réduire le menu</span>
          </button>
        </div>
      </aside>

      {/* Mobile / tablette */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/85 px-4 backdrop-blur-md lg:hidden">
        <Brand compactHidden={false} />
        <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open}
          className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink">
          <Menu size={20} />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="animate-fade-up absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-raised">
            <div className="flex h-14 items-center justify-between px-4">
              <Brand compactHidden={false} />
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2">
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-line p-3">
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
