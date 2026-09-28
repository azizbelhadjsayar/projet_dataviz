import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { PREFS_SCRIPT } from "@/components/shell/prefs-script";
import "./globals.css";

// Inter auto-hébergée par next/font (aucune requête vers Google côté visiteur).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Parcoursup 2021-2025 · Tableau de bord", template: "%s · Parcoursup 2021-2025" },
  description: "Analyse des données Parcoursup 2021-2025 : offre de formation, demande, sélectivité, territoires et profils des admis, avec agent d'analyse IA.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Thème et barre latérale appliqués avant le premier rendu (pas de flash). */}
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-raised">
          Aller au contenu
        </a>
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar />
          <main id="contenu" className="flex min-w-0 flex-1 flex-col px-4 py-6 sm:px-6 lg:px-10">
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </main>
        </div>
      </body>
    </html>
  );
}
