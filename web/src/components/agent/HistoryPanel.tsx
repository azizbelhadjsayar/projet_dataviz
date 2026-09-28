"use client";

import { useMemo, useState } from "react";
import type { ConversationMeta } from "./history";
import { ChatIcon, CheckIcon, PanelIcon, PencilIcon, PinIcon, PlusIcon, SearchIcon, Spinner, TrashIcon, XIcon } from "./icons";

interface Props {
  metas: ConversationMeta[];
  activeId: string | null;
  busy: boolean;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onClose: () => void;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Regroupe les conversations par ancienneté (comme les assistants grand public). */
function groupByDate(metas: ConversationMeta[]) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const day = 86_400_000;
  const groups: { label: string; items: ConversationMeta[] }[] = [
    { label: "Épinglées", items: [] },
    { label: "Aujourd'hui", items: [] },
    { label: "Hier", items: [] },
    { label: "7 derniers jours", items: [] },
    { label: "30 derniers jours", items: [] },
    { label: "Plus ancien", items: [] },
  ];
  for (const m of metas) {
    const t = m.updatedAt;
    const g = m.pinned ? 0 : t >= startOfToday ? 1 : t >= startOfToday - day ? 2 : t >= startOfToday - 7 * day ? 3 : t >= startOfToday - 30 * day ? 4 : 5;
    groups[g].items.push(m);
  }
  return groups.filter((g) => g.items.length);
}

function Item({ meta, active, busy, onSelect, onRename, onDelete, onTogglePin }: {
  meta: ConversationMeta; active: boolean; busy: boolean;
} & Pick<Props, "onSelect" | "onRename" | "onDelete" | "onTogglePin">) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(meta.title);
  const [confirm, setConfirm] = useState(false);
  const locked = busy && !active;

  if (editing) {
    return (
      <form
        className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1.5"
        onSubmit={(e) => { e.preventDefault(); if (draft.trim()) onRename(meta.id, draft.trim()); setEditing(false); }}
      >
        <input
          autoFocus
          value={draft}
          maxLength={80}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") { setDraft(meta.title); setEditing(false); } }}
          onBlur={() => { if (draft.trim()) onRename(meta.id, draft.trim()); setEditing(false); }}
          aria-label="Nouveau titre"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
        />
        <button type="submit" aria-label="Valider" className="text-good"><CheckIcon width={14} height={14} /></button>
      </form>
    );
  }

  if (confirm) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm">
        <span className="truncate text-ink-2">Supprimer ?</span>
        <span className="flex shrink-0 gap-1">
          <button type="button" onClick={() => onDelete(meta.id)} className="rounded px-2 py-0.5 font-medium text-bad hover:bg-surface">Supprimer</button>
          <button type="button" onClick={() => setConfirm(false)} className="rounded px-2 py-0.5 text-ink-2 hover:bg-surface">Annuler</button>
        </span>
      </div>
    );
  }

  return (
    <div className={`group relative flex items-center rounded-lg transition-colors ${active ? "bg-accent-soft" : "hover:bg-surface-2"}`}>
      <button
        type="button"
        disabled={locked}
        onClick={() => onSelect(meta.id)}
        title={locked ? "Une analyse est en cours" : meta.title}
        className={`min-w-0 flex-1 truncate py-2 pl-2.5 pr-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${active ? "font-medium text-ink" : "text-ink-2"}`}
      >
        {active && busy && <Spinner className="-mt-0.5 mr-1.5 inline h-3 w-3 text-accent" />}
        {meta.pinned && !(active && busy) && <PinIcon width={12} height={12} className="-mt-0.5 mr-1 inline text-muted" />}
        {meta.title}
      </button>
      <div className={`flex shrink-0 items-center gap-0.5 pr-1 ${active ? "flex" : "hidden group-focus-within:flex group-hover:flex"}`}>
        <button type="button" onClick={() => onTogglePin(meta.id)} aria-label={meta.pinned ? "Désépingler" : "Épingler"} title={meta.pinned ? "Désépingler" : "Épingler"}
          className={`rounded p-1 hover:bg-surface hover:text-ink ${meta.pinned ? "text-accent" : "text-muted"}`}>
          <PinIcon width={13} height={13} />
        </button>
        <button type="button" onClick={() => { setDraft(meta.title); setEditing(true); }} aria-label="Renommer" title="Renommer"
          className="rounded p-1 text-muted hover:bg-surface hover:text-ink">
          <PencilIcon width={13} height={13} />
        </button>
        <button type="button" disabled={active && busy} onClick={() => setConfirm(true)} aria-label="Supprimer" title="Supprimer"
          className="rounded p-1 text-muted hover:bg-surface hover:text-bad disabled:opacity-40">
          <TrashIcon width={13} height={13} />
        </button>
      </div>
    </div>
  );
}

export function HistoryPanel(props: Props) {
  const { metas, activeId, busy, loading, onNew, onClose } = props;
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = norm(query.trim());
    const filtered = q ? metas.filter((m) => norm(`${m.title} ${m.preview}`).includes(q)) : metas;
    return groupByDate(filtered);
  }, [metas, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 pb-3">
        <p className="text-sm font-semibold">Conversations</p>
        <button type="button" onClick={onClose} aria-label="Masquer l'historique" title="Masquer l'historique"
          className="rounded-md p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
          <PanelIcon width={16} height={16} />
        </button>
      </div>

      <button type="button" onClick={onNew} disabled={busy}
        className="mb-3 inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/50 hover:bg-surface-2 disabled:opacity-50">
        <PlusIcon width={15} height={15} /> Nouvelle conversation
      </button>

      <label className="relative mb-3 block">
        <span className="sr-only">Rechercher une conversation</span>
        <SearchIcon width={14} height={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
          className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-2 text-sm outline-none focus-visible:border-accent/60"
        />
      </label>

      <nav className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 pb-2" aria-label="Historique des conversations">
        {loading && <p className="px-2 text-sm text-muted">Chargement…</p>}
        {!loading && !metas.length && (
          <div className="px-2 py-6 text-center text-sm text-muted">
            <ChatIcon width={22} height={22} className="mx-auto mb-2 text-muted" />
            Vos conversations apparaîtront ici.
          </div>
        )}
        {!loading && metas.length > 0 && !groups.length && (
          <p className="flex items-center gap-1.5 px-2 text-sm text-muted"><XIcon width={13} height={13} /> Aucun résultat.</p>
        )}
        {groups.map((g) => (
          <section key={g.label}>
            <h3 className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.label}</h3>
            <div className="space-y-0.5">
              {g.items.map((m) => (
                <Item key={m.id} meta={m} active={m.id === activeId} busy={busy}
                  onSelect={props.onSelect} onRename={props.onRename} onDelete={props.onDelete} onTogglePin={props.onTogglePin} />
              ))}
            </div>
          </section>
        ))}
      </nav>
      <p className="border-t border-line pt-2 text-[11px] leading-snug text-muted">
        Stockées dans ce navigateur uniquement. Les {150} plus récentes sont conservées, les épinglées toujours.
      </p>
    </div>
  );
}
