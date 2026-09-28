"use client";

import { useEffect, useRef } from "react";
import { ArrowUpIcon, StopIcon } from "./icons";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  disabled?: boolean;
}

/** Zone de saisie flottante : hauteur automatique, Entrée pour envoyer, Maj+Entrée pour un saut de ligne. */
export function Composer({ value, onChange, onSubmit, onStop, busy, disabled }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    if (!busy) ref.current?.focus();
  }, [busy]);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!busy) onSubmit(); }}
      className="rounded-2xl border border-line bg-surface shadow-[0_4px_24px_-8px_rgba(0,0,0,0.18)] transition-shadow focus-within:border-accent/50 focus-within:shadow-[0_4px_28px_-8px_rgba(42,120,214,0.35)]"
    >
      <label htmlFor="agent-input" className="sr-only">Question pour l&apos;agent</label>
      <textarea
        id="agent-input"
        ref={ref}
        value={value}
        rows={1}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (!busy) onSubmit();
          }
        }}
        placeholder={busy ? "L'agent analyse… vous pouvez préparer la question suivante" : "Posez une question d'analyse sur Parcoursup 2021-2025…"}
        className="block max-h-[200px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[0.9375rem] leading-relaxed text-ink outline-none placeholder:text-muted"
      />
      <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
        <p className="hidden text-xs text-muted sm:block">
          <kbd className="rounded border border-line px-1 font-sans">Entrée</kbd> envoyer ·{" "}
          <kbd className="rounded border border-line px-1 font-sans">Maj</kbd>+<kbd className="rounded border border-line px-1 font-sans">Entrée</kbd> nouvelle ligne
        </p>
        {busy ? (
          <button type="button" onClick={onStop} aria-label="Arrêter l'analyse"
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-full bg-ink px-3.5 text-sm font-medium text-surface transition-opacity hover:opacity-85">
            <StopIcon width={12} height={12} /> Arrêter
          </button>
        ) : (
          <button type="submit" disabled={!value.trim() || disabled} aria-label="Envoyer"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition-all hover:opacity-90 disabled:bg-surface-2 disabled:text-muted">
            <ArrowUpIcon width={17} height={17} strokeWidth={2.25} />
          </button>
        )}
      </div>
    </form>
  );
}
