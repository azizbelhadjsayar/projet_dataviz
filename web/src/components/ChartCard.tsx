"use client";

import { ChartColumn, Download, Sparkles, Table2 } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

export interface TableData {
  columns: string[];
  rows: (string | number | null)[][];
}

interface Props {
  title: string;
  subtitle?: string;
  /** Vue tableau équivalente (accessibilité) ; les valeurs sont déjà formatées. */
  table?: TableData;
  note?: ReactNode;
  className?: string;
  actions?: ReactNode;
  /** Question pré-remplie pour l'agent : ajoute le bouton « Analyser avec l'IA ». */
  aiQuestion?: string;
  children: ReactNode;
}

/** Valeurs formatées à la française -> CSV lisible par Excel (séparateur « ; », décimale « , »). */
function toCsv(t: TableData) {
  const cell = (v: string | number | null) => {
    if (v === null || v === undefined) return "";
    let s = String(v).trim();
    if (/^[−-]?[\d\s  ]+(,\d+)?\s?%?$/.test(s)) s = s.replace(/[\s  %]/g, "").replace("−", "-");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [t.columns, ...t.rows].map((r) => r.map(cell).join(";")).join("\r\n");
}

function download(title: string, t: TableData) {
  const blob = new Blob(["﻿" + toCsv(t)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "donnees"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const iconBtn = "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink";

export function ChartCard({ title, subtitle, table, note, className = "", actions, aiQuestion, children }: Props) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className={`flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5 ${className}`}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[0.975rem] font-semibold leading-snug text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[0.8125rem] text-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {actions}
          {table && (
            <>
              <button type="button" onClick={() => setView(view === "chart" ? "table" : "chart")} className={iconBtn}
                aria-pressed={view === "table"} title={view === "chart" ? "Afficher le tableau de données" : "Afficher le graphique"}>
                {view === "chart" ? <Table2 size={15} /> : <ChartColumn size={15} />}
                <span className="hidden sm:inline">{view === "chart" ? "Tableau" : "Graphique"}</span>
              </button>
              <button type="button" onClick={() => download(title, table)} className={iconBtn} title="Télécharger les données (CSV)" aria-label="Télécharger les données en CSV">
                <Download size={15} />
              </button>
            </>
          )}
          {aiQuestion && (
            <Link href={`/assistant?q=${encodeURIComponent(aiQuestion)}`} title="Ouvrir l'agent d'analyse sur ce graphique"
              className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft/60 px-2.5 text-xs font-medium text-accent transition-colors hover:bg-accent-soft">
              <Sparkles size={14} /> <span className="hidden sm:inline">Analyser</span>
            </Link>
          )}
        </div>
      </header>
      <div className="min-w-0 flex-1">
        {view === "chart" || !table ? children : <DataTable table={table} />}
      </div>
      {note && <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">{note}</p>}
    </section>
  );
}

export function DataTable({ table, maxHeight = 420 }: { table: TableData; maxHeight?: number }) {
  return (
    <div className="overflow-auto rounded-lg" style={{ maxHeight }}>
      <table className="tabular w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr>
            {table.columns.map((c, i) => (
              <th key={c} className={`whitespace-nowrap px-3 py-2 text-xs font-semibold text-ink-2 ${i ? "text-right" : "text-left"}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className="border-b border-grid last:border-0 hover:bg-surface-2/60">
              {r.map((v, j) => (
                <td key={j} className={`px-3 py-2 ${j ? "whitespace-nowrap text-right" : "text-left text-ink"}`}>{v ?? "–"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
