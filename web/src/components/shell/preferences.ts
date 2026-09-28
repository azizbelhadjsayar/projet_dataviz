"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

// Préférences d'affichage (thème, barre latérale réduite) stockées dans localStorage et appliquées
// sur <html> par un script inline avant le premier rendu (pas de flash). Ce module les synchronise avec React.

export type Theme = "light" | "dark" | "system";

const EVENT = "prefs-change";


function read(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}
function applySidebar(collapsed: boolean) {
  const root = document.documentElement;
  if (collapsed) root.setAttribute("data-sidebar", "collapsed");
  else root.removeAttribute("data-sidebar");
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, () => (read("theme") as Theme | null) ?? "system", () => "system" as Theme);
  // En développement, React peut réinitialiser les attributs de <html> : on les réapplique depuis la source (localStorage).
  useLayoutEffect(() => { applyTheme((read("theme") as Theme | null) ?? "system"); }, []);
  const set = (t: Theme) => {
    try {
      if (t === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", t);
    } catch { /* ignoré */ }
    applyTheme(t);
    window.dispatchEvent(new Event(EVENT));
  };
  return [theme, set];
}

export function useSidebarCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(subscribe, () => read("sidebar") === "collapsed", () => false);
  useLayoutEffect(() => { applySidebar(read("sidebar") === "collapsed"); }, []);
  const toggle = () => {
    const next = !collapsed;
    try { localStorage.setItem("sidebar", next ? "collapsed" : "expanded"); } catch { /* ignoré */ }
    applySidebar(next);
    window.dispatchEvent(new Event(EVENT));
  };
  return [collapsed, toggle];
}
