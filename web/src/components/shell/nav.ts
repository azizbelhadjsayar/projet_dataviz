import { BookOpen, ChartColumnBig, GraduationCap, LayoutDashboard, MapPinned, Search, Sparkles, Users, type LucideIcon } from "lucide-react";

// Structure de navigation partagée (barre latérale, menu mobile, fil d'Ariane).

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  /** Conserve les filtres globaux (session, type…) en naviguant. */
  keepFilters?: boolean;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Tableaux de bord",
    items: [
      { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard, keepFilters: true },
      { href: "/formations", label: "Formations & sélectivité", icon: GraduationCap, keepFilters: true },
      { href: "/territoires", label: "Territoires", icon: MapPinned, keepFilters: true },
      { href: "/profils", label: "Profils & équité", icon: Users, keepFilters: true },
    ],
  },
  {
    title: "Exploration",
    items: [
      { href: "/explorer", label: "Explorer les formations", icon: Search, keepFilters: true },
      { href: "/assistant", label: "Agent d'analyse", icon: Sparkles, badge: "IA" },
    ],
  },
  {
    title: "Ressources",
    items: [
      { href: "/powerbi", label: "Rapport Power BI", icon: ChartColumnBig },
      { href: "/methodologie", label: "Données & méthode", icon: BookOpen },
    ],
  },
];

export const KEEP_PARAMS = ["session", "type", "secteur", "selectivite", "region"];

export const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

export function sectionOf(pathname: string) {
  for (const s of NAV_SECTIONS) for (const it of s.items) if (isActive(pathname, it.href)) return { section: s.title, item: it };
  return null;
}
