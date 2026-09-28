"use client";

import { memo, useMemo, useState } from "react";
import { DataTable } from "@/components/ChartCard";
import { AgentChart } from "./AgentChart";
import { AgentAvatar, ChartIcon, CheckIcon, ChevronIcon, CopyIcon, DatabaseIcon, RefreshIcon, Spinner, XIcon } from "./icons";
import { Markdown } from "./Markdown";
import { finalAnswer, modelLabel, splitSuggestions, toSegments, type Message, type Step } from "./model";
import { SqlCode } from "./SqlCode";

const fmtCell = (v: string | number | boolean | null) =>
  typeof v === "number" ? v.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : v === null ? null : String(v);
const fmtSec = (s: number) => `${s.toLocaleString("fr-FR", { maximumFractionDigits: s < 10 ? 1 : 0 })} s`;



function StepDot({ state }: { state: "running" | "ok" | "error" | "chart" }) {
  const cls = {
    running: "text-accent ring-accent/40",
    ok: "text-good ring-line",
    error: "text-bad ring-bad/40",
    chart: "text-accent ring-line",
  }[state];
  return (
    <span className={`absolute left-0 top-[3px] z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface ring-1 ${cls}`}>
      {state === "running" ? <Spinner className="h-3 w-3" /> : state === "ok" ? <CheckIcon width={11} height={11} strokeWidth={2.5} />
        : state === "error" ? <XIcon width={10} height={10} strokeWidth={2.5} /> : <ChartIcon width={10} height={10} strokeWidth={2.25} />}
    </span>
  );
}

function StepItem({ step, recovered }: { step: Step; recovered: boolean }) {
  const [open, setOpen] = useState(false);
  if (step.kind === "chart") {
    return (
      <li className="animate-fade-up relative pl-7">
        <StepDot state="chart" />
        <p className="text-sm leading-relaxed text-ink-2">{step.narration || "Création d'un graphique."}</p>
        <p className="mt-0.5 text-xs text-muted">Graphique : {step.chart.title}</p>
      </li>
    );
  }
  const b = step.block;
  const n = b.rows?.length ?? 0;
  return (
    <li className="animate-fade-up relative pl-7">
      <StepDot state={b.status} />
      <p className={`text-sm leading-relaxed ${b.status === "running" ? "text-ink" : "text-ink-2"}`}>{step.narration || b.purpose}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
        <DatabaseIcon width={12} height={12} />
        {b.status === "running" && <span className="text-shimmer">Requête en cours…</span>}
        {b.status === "ok" && <span>{n}{b.truncated ? "+" : ""} ligne{n > 1 ? "s" : ""} · {b.ms} ms</span>}
        {b.status === "error" && <span className="text-bad">Erreur SQL{recovered ? " · corrigée à l'étape suivante" : ""}</span>}
        <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-0.5 text-accent hover:underline">
          {open ? "Masquer" : "Voir la requête"}
          <ChevronIcon width={12} height={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="animate-fade-up mt-2 space-y-2">
          {step.narration && <p className="text-xs text-muted">Objectif : {b.purpose}</p>}
          <SqlCode sql={b.sql} />
          {b.error && <p className="rounded-md bg-surface-2 px-3 py-2 font-mono text-xs text-bad">{b.error}</p>}
          {b.columns && b.rows && n > 0 && (
            <div className="rounded-lg border border-line">
              <DataTable maxHeight={240} table={{ columns: b.columns, rows: b.rows.map((r) => r.map(fmtCell)) }} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function StepList({ steps, pending, live }: { steps: Step[]; pending?: string; live: boolean }) {
  return (
    <ol className="relative space-y-3 py-1">
      {/* fil vertical reliant les étapes */}
      <span aria-hidden className="absolute bottom-3 left-[8.5px] top-3 w-px bg-line" />
      {steps.map((s, i) => (
        <StepItem key={s.kind === "sql" ? s.block.id : s.chart.id} step={s}
          recovered={s.kind === "sql" && s.block.status === "error" && i < steps.length - 1} />
      ))}
      {pending && (
        <li className="animate-fade-up relative pl-7">
          <StepDot state="running" />
          <p className={`text-sm leading-relaxed ${live ? "text-ink" : "text-ink-2"}`}>{pending}</p>
        </li>
      )}
    </ol>
  );
}

interface Props {
  m: Message;
  live: boolean;
  isLast: boolean;
  now: number;
  onRegenerate?: () => void;
}

// Mémoïsé : pendant le streaming, seul le dernier message change (les autres gardent la même référence).
export const AgentMessage = memo(function AgentMessage({ m, live, isLast, now, onRegenerate }: Props) {
  const segments = useMemo(() => toSegments(m.blocks ?? [], live), [m.blocks, live]);
  const blocks = m.blocks ?? [];
  const [showSteps, setShowSteps] = useState(true);
  const [copied, setCopied] = useState(false);

  const nSql = blocks.filter((b) => b.kind === "sql").length;
  const nCharts = blocks.filter((b) => b.kind === "chart").length;
  const elapsed = live && m.startedAt ? (now - m.startedAt) / 1000 : m.seconds ?? 0;
  const hasSteps = segments.some((s) => s.kind === "steps");
  const answer = splitSuggestions(finalAnswer(blocks)).body;
  const lastSeg = segments[segments.length - 1];

  return (
    <div className="flex gap-3">
      <div className="pt-0.5"><AgentAvatar /></div>
      <div className="min-w-0 flex-1 space-y-3">
        {/* Statut de l'analyse */}
        {(live || hasSteps) && (
          <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {live ? (
              <span className="inline-flex items-center gap-2 text-accent">
                <Spinner />
                <span className="text-shimmer font-medium">{nSql ? "Analyse des données en cours" : "Réflexion"}</span>
                <span className="tabular text-xs text-muted">{fmtSec(elapsed)}</span>
              </span>
            ) : (
              <button type="button" onClick={() => setShowSteps(!showSteps)} className="group inline-flex items-center gap-1.5 text-ink-2 hover:text-ink">
                <CheckIcon width={14} height={14} className="text-good" strokeWidth={2.25} />
                <span>
                  Analyse terminée · {nSql} requête{nSql > 1 ? "s" : ""}{nCharts ? ` · ${nCharts} graphique${nCharts > 1 ? "s" : ""}` : ""}
                  {m.seconds ? ` · ${fmtSec(m.seconds)}` : ""}
                </span>
                <ChevronIcon width={14} height={14} className={`text-muted transition-transform ${showSteps ? "rotate-90" : ""}`} />
              </button>
            )}
          </div>
        )}

        {segments.map((s, i) => {
          if (s.kind === "steps") return (live || showSteps) ? <StepList key={`s${i}`} steps={s.steps} pending={s.pending} live={live} /> : null;
          if (s.kind === "chart") return <div key={s.chart.id} className="animate-fade-up"><AgentChart chart={s.chart} /></div>;
          const { body } = splitSuggestions(s.text);
          return body ? <Markdown key={`a${i}`} text={body} streaming={live && s === lastSeg} /> : null;
        })}

        {live && !blocks.length && (
          <p className="text-shimmer text-sm">L&apos;agent prépare son analyse…</p>
        )}

        {m.error && (
          <div className="animate-fade-up flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bad/30 bg-surface px-3 py-2 text-sm">
            <span className="text-bad">{m.error}</span>
            {onRegenerate && isLast && (
              <button type="button" onClick={onRegenerate} className="inline-flex items-center gap-1 text-accent hover:underline">
                <RefreshIcon width={14} height={14} /> Réessayer
              </button>
            )}
          </div>
        )}
        {m.stopped && <p className="text-sm text-muted">Analyse interrompue.</p>}

        {!live && (answer || m.model) && (
          <div className="flex flex-wrap items-center gap-1 pt-1 text-xs text-muted">
            {answer && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(answer).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-surface-2 hover:text-ink"
              >
                {copied ? <CheckIcon width={13} height={13} /> : <CopyIcon width={13} height={13} />} {copied ? "Copié" : "Copier"}
              </button>
            )}
            {onRegenerate && isLast && (
              <button type="button" onClick={onRegenerate} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-surface-2 hover:text-ink">
                <RefreshIcon width={13} height={13} /> Relancer
              </button>
            )}
            {m.model && <span className="ml-1 whitespace-nowrap">{modelLabel(m.model, m.provider)} · {m.steps} étape{(m.steps ?? 0) > 1 ? "s" : ""}</span>}
          </div>
        )}
      </div>
    </div>
  );
});
