"use client";

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/agent/types";
import { AgentMessage } from "./AgentMessage";
import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";
import {
  deleteConversation, fallbackTitle, listConversations, loadConversation, newConversationId, patchMemory, patchMeta,
  pruneConversations, saveConversation, type ConversationMemory, type ConversationMeta,
} from "./history";
import { HistoryPanel } from "./HistoryPanel";
import { AgentAvatar, ArrowDownIcon, ChevronIcon, MemoryIcon, PanelIcon, PlusIcon } from "./icons";
import { Markdown } from "./Markdown";
import { finalAnswer, prettyModel, reduceEvent, splitSuggestions, type Message } from "./model";

// ── Réglages de la mémoire ──
/** Messages récents transmis en entier à l'agent (3 échanges question/réponse). */
const WINDOW = 6;
/** Plafond de messages transmis si le résumé n'a pas encore rattrapé. */
const MAX_SEND = 12;
/** Messages affichés à l'ouverture d'une longue conversation (les précédents à la demande). */
const PAGE = 12;

const ACTIVE_KEY = "parcoursup-agent-active";
const PANEL_KEY = "parcoursup-agent-panel";
const LEGACY_KEY = "parcoursup-agent-v2";

interface Props {
  model: string;
  provider: string;
  hasKey: boolean;
}

type Wire = { role: "user" | "assistant"; content: string; queries?: string[] };

/**
 * Contexte envoyé à l'agent : les derniers échanges en entier (+ leurs requêtes SQL), les plus anciens
 * étant couverts par la mémoire résumée. Les échanges en échec sont écartés.
 */
function buildContext(history: Message[], memory: ConversationMemory | null): Wire[] {
  let start = Math.max(memory?.upTo ?? 0, history.length - 1 - WINDOW, history.length - MAX_SEND);
  start = Math.min(Math.max(0, start), history.length - 1);
  if (history[start]?.role === "assistant" && start > 0) start--; // toujours commencer par une question
  const slice = history.slice(start);
  const out: Wire[] = [];
  for (let i = 0; i < slice.length; i++) {
    const m = slice[i];
    const next = slice[i + 1];
    if (m.role === "user" && next?.role === "assistant" && (next.error || !next.content.trim())) { i++; continue; }
    out.push({ role: m.role, content: m.content, queries: m.queries });
  }
  return out;
}

function remember(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* ignoré */ }
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("c", id);
  else url.searchParams.delete("c");
  window.history.replaceState(window.history.state, "", url);
}

const isOverlay = () => window.matchMedia("(max-width: 1279px)").matches;

export default function AgentChat({ model, provider, hasKey }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [showJump, setShowJump] = useState(false);

  // Conversations
  const [convId, setConvId] = useState<string | null>(null);
  const [metas, setMetas] = useState<ConversationMeta[]>([]);
  const [metasLoading, setMetasLoading] = useState(true);
  const [memory, setMemory] = useState<ConversationMemory | null>(null);
  const [showMemory, setShowMemory] = useState(false);
  const [hiddenBefore, setHiddenBefore] = useState(0);
  const [panelOpen, setPanelOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(PANEL_KEY);
      if (saved) return saved === "1";
    } catch { /* ignoré */ }
    return window.innerWidth >= 1280;
  });

  // Références toujours à jour pour les tâches asynchrones (streaming, tâches de fond).
  const messagesRef = useRef<Message[]>([]);
  const convRef = useRef<string | null>(null);
  const memoryRef = useRef<ConversationMemory | null>(null);
  const metasRef = useRef<ConversationMeta[]>([]);
  const inflight = useRef(new Set<string>());
  const abortRef = useRef<AbortController | null>(null);
  const stick = useRef(true);
  /** Zone des messages : seule partie qui défile (en-tête et saisie restent fixes). */
  const scrollRef = useRef<HTMLDivElement>(null);

  const commit = useCallback((next: Message[] | ((prev: Message[]) => Message[])) => {
    const value = typeof next === "function" ? next(messagesRef.current) : next;
    messagesRef.current = value;
    setMessages(value);
  }, []);
  const updateMetas = useCallback((fn: (prev: ConversationMeta[]) => ConversationMeta[]) => {
    const value = fn(metasRef.current).sort((a, b) => b.updatedAt - a.updatedAt);
    metasRef.current = value;
    setMetas(value);
  }, []);
  const setMem = (m: ConversationMemory | null) => {
    memoryRef.current = m;
    setMemory(m);
  };

  // ── Planificateur d'affichage fluide (texte révélé en continu, étapes dans l'ordre) ──
  const queue = useRef<AgentEvent[]>([]);
  const raf = useRef<number | null>(null);
  const drained = useRef<(() => void)[]>([]);
  const reduced = useRef(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const applyBatch = useCallback((batch: AgentEvent[]) => {
    if (!batch.length) return;
    commit((prev) => {
      if (!prev.length) return prev;
      let m = prev[prev.length - 1];
      for (const ev of batch) m = reduceEvent(m, ev);
      return [...prev.slice(0, -1), m];
    });
  }, [commit]);

  const pump = useCallback(() => {
    const q = queue.current;
    const backlog = q.reduce((n, e) => n + (e.type === "text" ? e.delta.length : 0), 0);
    let budget = reduced.current ? Infinity : Math.min(90, Math.max(3, Math.ceil(backlog / 16)));
    const batch: AgentEvent[] = [];
    while (q.length && budget > 0) {
      const e = q[0];
      if (e.type === "text") {
        const take = e.delta.slice(0, budget);
        batch.push({ type: "text", delta: take });
        budget -= take.length;
        if (take.length >= e.delta.length) q.shift();
        else q[0] = { type: "text", delta: e.delta.slice(take.length) };
      } else {
        batch.push(e);
        q.shift();
      }
    }
    applyBatch(batch);
    if (q.length) raf.current = requestAnimationFrame(pump);
    else {
      raf.current = null;
      drained.current.splice(0).forEach((r) => r());
    }
  }, [applyBatch]);

  const enqueue = useCallback((e: AgentEvent) => {
    queue.current.push(e);
    if (raf.current === null) raf.current = requestAnimationFrame(pump);
  }, [pump]);
  const drain = () =>
    queue.current.length || raf.current !== null ? new Promise<void>((r) => drained.current.push(r)) : Promise.resolve();
  const flush = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    applyBatch(queue.current.splice(0));
    drained.current.splice(0).forEach((r) => r());
  };

  // Lancement d'une question reçue par lien (toujours la version à jour de `run`, sans relancer l'effet).
  const askFromLink = useEffectEvent((question: string) => { void run(question, []); });

  // ── Chargement initial : liste légère + conversation active (URL ?c= ou dernière ouverte) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Reprise de l'ancienne conversation d'onglet (avant l'historique), une seule fois.
      try {
        const legacy = sessionStorage.getItem(LEGACY_KEY);
        const msgs: Message[] = legacy ? JSON.parse(legacy) : [];
        if (msgs.length) {
          const id = newConversationId();
          const first = msgs.find((m) => m.role === "user")?.content ?? "Conversation";
          const t = Date.now();
          await saveConversation(
            { id, title: fallbackTitle(first), titleSource: "fallback", createdAt: t, updatedAt: t, turns: msgs.filter((m) => m.role === "user").length, preview: first.slice(0, 200) },
            { id, messages: msgs, memory: null },
          );
        }
        sessionStorage.removeItem(LEGACY_KEY);
      } catch { /* ignoré */ }

      const list = await listConversations().catch(() => [] as ConversationMeta[]);
      if (cancelled) return;
      updateMetas(() => list);
      setMetasLoading(false);

      // Arrivée depuis un graphique (« Analyser avec l'IA ») : nouvelle conversation lancée directement.
      const params = new URLSearchParams(window.location.search);
      const question = params.get("q");
      if (question) {
        const url = new URL(window.location.href);
        url.searchParams.delete("q");
        window.history.replaceState(window.history.state, "", url);
        askFromLink(question);
        return;
      }

      let wanted: string | null = params.get("c");
      try { wanted ??= localStorage.getItem(ACTIVE_KEY); } catch { /* ignoré */ }
      if (wanted && list.some((m) => m.id === wanted)) {
        const data = await loadConversation(wanted);
        if (cancelled || !data) return;
        convRef.current = wanted;
        setConvId(wanted);
        commit(data.messages);
        setMem(data.memory ?? null);
        setHiddenBefore(Math.max(0, data.messages.length - PAGE));
        requestAnimationFrame(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; });
      }
    })();
    return () => { cancelled = true; };
  }, [commit, updateMetas]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [busy]);

  // ── Défilement (zone des messages uniquement) : on suit la réponse tant que l'utilisateur est en bas ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const gap = el.scrollHeight - (el.scrollTop + el.clientHeight);
      stick.current = gap < 120;
      setShowJump(gap > 360);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && busy && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);
  const toBottom = (smooth = true) => {
    stick.current = true;
    const el = scrollRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  // ── Persistance et tâches de fond (titre, mémoire), après chaque réponse ──
  async function persist(id: string) {
    const msgs = messagesRef.current;
    const firstQ = msgs.find((m) => m.role === "user")?.content ?? "";
    const existing = metasRef.current.find((m) => m.id === id);
    const t = Date.now();
    const meta: ConversationMeta = {
      id,
      title: existing?.title ?? fallbackTitle(firstQ),
      titleSource: existing?.titleSource ?? "fallback",
      createdAt: existing?.createdAt ?? t,
      updatedAt: t,
      turns: msgs.filter((m) => m.role === "user").length,
      preview: firstQ.slice(0, 200),
      pinned: existing?.pinned,
    };
    updateMetas((prev) => [meta, ...prev.filter((m) => m.id !== id)]);
    try {
      await saveConversation(meta, { id, messages: msgs, memory: memoryRef.current });
      if (!existing || existing.turns === 0) {
        const pruned = await pruneConversations();
        if (pruned.length) updateMetas((prev) => prev.filter((m) => !pruned.includes(m.id)));
      }
    } catch { /* stockage plein ou indisponible : la conversation reste affichée */ }
  }

  async function backgroundTasks(id: string) {
    if (inflight.current.has(id)) return;
    inflight.current.add(id);
    const msgs = messagesRef.current;
    try {
      // 1. Titre automatique après le premier échange réussi
      const meta = metasRef.current.find((m) => m.id === id);
      const firstAnswer = msgs.find((m) => m.role === "assistant" && !m.error && m.content.trim());
      if (meta?.titleSource === "fallback" && firstAnswer) {
        const res = await fetch("/api/agent/memory", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: "title", question: meta.preview, answer: splitSuggestions(firstAnswer.content).body }),
        });
        const { title } = res.ok ? await res.json() : { title: null };
        if (title && metasRef.current.find((m) => m.id === id)?.titleSource === "fallback") {
          updateMetas((prev) => prev.map((m) => (m.id === id ? { ...m, title, titleSource: "auto" } : m)));
          await patchMeta(id, { title, titleSource: "auto" });
        }
      }

      // 2. Mémoire : résume les échanges sortis de la fenêtre récente (incrémental)
      const mem = convRef.current === id ? memoryRef.current : (await loadConversation(id))?.memory ?? null;
      let cut = msgs.length - WINDOW;
      if (msgs[cut]?.role === "assistant") cut--;
      const upTo = mem?.upTo ?? 0;
      if (cut - upTo >= 2) {
        const turns = msgs.slice(upTo, cut)
          .filter((m) => !m.error && m.content.trim())
          .map((m) => ({ role: m.role, content: m.role === "assistant" ? splitSuggestions(m.content).body : m.content, queries: m.queries }));
        const res = await fetch("/api/agent/memory", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: "summary", previous: mem?.summary ?? "", turns }),
        });
        const { summary } = res.ok ? await res.json() : { summary: null };
        if (summary) {
          const next = { summary, upTo: cut };
          if (convRef.current === id) setMem(next);
          await patchMemory(id, next);
        }
      }
    } catch { /* tâche de fond : sans effet si elle échoue, réessayée au prochain échange */ } finally {
      inflight.current.delete(id);
    }
  }

  // ── Envoi d'une question ──
  async function run(question: string, base: Message[]) {
    const q = question.trim();
    if (!q || busy) return;

    let id = convRef.current;
    if (!id) {
      id = newConversationId();
      convRef.current = id;
      setConvId(id);
      const t = Date.now();
      updateMetas((prev) => [{ id: id!, title: fallbackTitle(q), titleSource: "fallback", createdAt: t, updatedAt: t, turns: 0, preview: q.slice(0, 200) }, ...prev]);
      remember(id);
    }

    const history: Message[] = [...base, { role: "user", content: q }];
    const context = buildContext(history, memoryRef.current);
    commit([...history, { role: "assistant", content: "", blocks: [], startedAt: Date.now() }]);
    setInput("");
    setBusy(true);
    setNow(Date.now());
    requestAnimationFrame(() => toBottom());

    const controller = new AbortController();
    abortRef.current = controller;
    const t0 = performance.now();
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ messages: context, memory: memoryRef.current?.summary ?? "" }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `Erreur HTTP ${res.status}` }));
        enqueue({ type: "error", message: err.error ?? "Erreur" });
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) if (line.trim()) enqueue(JSON.parse(line) as AgentEvent);
        }
      }
      await drain();
    } catch (e) {
      flush();
      if (controller.signal.aborted) commit((p) => [...p.slice(0, -1), { ...p[p.length - 1], stopped: true }]);
      else enqueue({ type: "error", message: `Connexion impossible : ${(e as Error).message}` });
      await drain();
    } finally {
      commit((p) => {
        const m = p[p.length - 1];
        return [...p.slice(0, -1), { ...m, content: finalAnswer(m.blocks), seconds: (performance.now() - t0) / 1000 }];
      });
      abortRef.current = null;
      setBusy(false);
    }
    await persist(id);
    void backgroundTasks(id);
  }

  const send = (text: string) => run(text, messagesRef.current);
  const regenerate = () => {
    const msgs = messagesRef.current;
    const i = msgs.findLastIndex((m) => m.role === "user");
    if (i >= 0) run(msgs[i].content, msgs.slice(0, i));
  };

  // ── Gestion des conversations ──
  const closePanelIfOverlay = () => { if (isOverlay()) setPanelOpen(false); };

  async function openConversation(id: string) {
    if (busy) return;
    closePanelIfOverlay();
    if (id === convRef.current) return;
    const data = await loadConversation(id);
    if (!data) {
      updateMetas((prev) => prev.filter((m) => m.id !== id));
      return;
    }
    convRef.current = id;
    setConvId(id);
    commit(data.messages);
    setMem(data.memory ?? null);
    setShowMemory(false);
    setHiddenBefore(Math.max(0, data.messages.length - PAGE));
    setInput("");
    remember(id);
    requestAnimationFrame(() => toBottom(false));
  }

  function newConversation() {
    if (busy) return;
    convRef.current = null;
    setConvId(null);
    commit([]);
    setMem(null);
    setShowMemory(false);
    setHiddenBefore(0);
    setInput("");
    remember(null);
    closePanelIfOverlay();
    scrollRef.current?.scrollTo({ top: 0 });
  }

  async function removeConversation(id: string) {
    updateMetas((prev) => prev.filter((m) => m.id !== id));
    if (id === convRef.current) newConversation();
    await deleteConversation(id).catch(() => {});
  }
  async function renameConversation(id: string, title: string) {
    updateMetas((prev) => prev.map((m) => (m.id === id ? { ...m, title, titleSource: "user" } : m)));
    await patchMeta(id, { title, titleSource: "user" }).catch(() => {});
  }
  async function togglePin(id: string) {
    const pinned = !metasRef.current.find((m) => m.id === id)?.pinned;
    updateMetas((prev) => prev.map((m) => (m.id === id ? { ...m, pinned } : m)));
    await patchMeta(id, { pinned }).catch(() => {});
  }
  const togglePanel = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    try { localStorage.setItem(PANEL_KEY, next ? "1" : "0"); } catch { /* ignoré */ }
  };

  const activeMeta = metas.find((m) => m.id === convId);
  const last = messages[messages.length - 1];
  const followUps = !busy && last?.role === "assistant" && !last.error ? splitSuggestions(last.content).suggestions : [];
  let from = Math.min(hiddenBefore, messages.length);
  if (messages[from]?.role === "assistant" && from > 0) from--;
  const visible = messages.slice(from);

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] gap-6 lg:h-[calc(100dvh-3rem)]">
      {/* Historique : colonne fixe sur grand écran, tiroir sur petit écran */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 xl:hidden" onClick={togglePanel} aria-hidden />
          <aside className="animate-fade-up fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] border-r border-line bg-surface p-4 shadow-2xl xl:static xl:z-auto xl:h-full xl:w-72 xl:shrink-0 xl:rounded-xl xl:border xl:p-3 xl:shadow-none">
            <HistoryPanel
              metas={metas}
              activeId={convId}
              busy={busy}
              loading={metasLoading}
              onSelect={openConversation}
              onNew={newConversation}
              onRename={renameConversation}
              onDelete={removeConversation}
              onTogglePin={togglePin}
              onClose={togglePanel}
            />
          </aside>
        </>
      )}

      <div className="mx-auto flex h-full w-full min-w-0 max-w-4xl flex-1 flex-col">
        {/* En-tête */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex min-w-0 items-center gap-3">
            {!panelOpen && (
              <button type="button" onClick={togglePanel} aria-label="Afficher l'historique" title="Historique des conversations"
                className="rounded-md p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
                <PanelIcon width={18} height={18} />
              </button>
            )}
            <AgentAvatar size={34} />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold leading-tight">{activeMeta?.title ?? "Agent d'analyse"}</h1>
              <p className="truncate text-xs text-muted">
                {provider} · {prettyModel(model) || "modèle non configuré"} · base DuckDB · 69 240 lignes
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {memory && (
              <button type="button" onClick={() => setShowMemory(!showMemory)} aria-expanded={showMemory}
                title="Mémoire résumée de cette conversation"
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${showMemory ? "border-accent/50 bg-accent-soft text-ink" : "border-line text-ink-2 hover:bg-surface-2 hover:text-ink"}`}>
                <MemoryIcon width={14} height={14} /> <span className="hidden sm:inline">Mémoire</span>
              </button>
            )}
            {messages.length > 0 && (
              <button type="button" disabled={busy} onClick={newConversation}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50">
                <PlusIcon width={14} height={14} /> <span className="hidden sm:inline">Nouvelle</span>
              </button>
            )}
          </div>
        </header>

        {/* Zone défilante : mémoire, avertissements et messages */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pt-3 [scrollbar-gutter:stable]">
        {showMemory && memory && (
          <section className="animate-fade-up mb-3 rounded-xl border border-line bg-surface p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
              <MemoryIcon width={13} height={13} /> Mémoire de la conversation · {memory.upTo} messages anciens résumés,
              les {WINDOW / 2} derniers échanges sont transmis en entier à l&apos;agent
            </p>
            <Markdown text={memory.summary} className="text-sm" />
          </section>
        )}

        {!hasKey && (
          <div className="my-3 rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
            <p className="font-medium text-ink">Clé API manquante</p>
            <p className="mt-1">
              Ajoutez <code className="rounded bg-surface-2 px-1">GEMINI_API_KEY=…</code> dans <code className="rounded bg-surface-2 px-1">web/.env.local</code>{" "}
              (clé gratuite sur aistudio.google.com/apikey), puis redémarrez le serveur.
            </p>
          </div>
        )}

        {/* Conversation */}
        <div className="pb-6 pt-1" aria-live="polite">
          {!messages.length ? (
            <EmptyState onPick={send} />
          ) : (
            <div className="space-y-8">
              {from > 0 && (
                <div className="flex justify-center">
                  <button type="button" onClick={() => setHiddenBefore(Math.max(0, from - PAGE))}
                    className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
                    Afficher les {Math.min(from, PAGE)} messages précédents
                  </button>
                </div>
              )}
              {visible.map((m, j) => {
                const i = from + j;
                return m.role === "user" ? (
                  <div key={i} className="animate-fade-up flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent-soft px-4 py-2.5 text-[0.9375rem] leading-relaxed text-ink">
                      {m.content}
                    </p>
                  </div>
                ) : (
                  <AgentMessage
                    key={i}
                    m={m}
                    live={busy && i === messages.length - 1}
                    isLast={i === messages.length - 1}
                    now={busy && i === messages.length - 1 ? now : 0}
                    onRegenerate={!busy && i === messages.length - 1 ? regenerate : undefined}
                  />
                );
              })}
              {followUps.length > 0 && (
                <div className="animate-fade-up flex flex-wrap gap-2 pl-10">
                  {followUps.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-left text-sm text-ink-2 transition-colors hover:border-accent/50 hover:text-ink">
                      {s}
                      <ChevronIcon width={13} height={13} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        </div>

        {/* Saisie : toujours visible en bas (hors de la zone qui défile) */}
        <div className="relative shrink-0 pt-2">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-page to-transparent" />
          {showJump && (
            <button type="button" onClick={() => toBottom()} aria-label="Aller en bas"
              className="animate-fade-up absolute -top-12 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-md hover:text-ink">
              <ArrowDownIcon width={16} height={16} />
            </button>
          )}
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => send(input)}
            onStop={() => abortRef.current?.abort()}
            busy={busy}
            disabled={!hasKey}
          />
          <p className="mt-2 text-center text-[11px] text-muted">
            L&apos;agent peut se tromper : ses requêtes et résultats sont consultables sous chaque étape.
          </p>
        </div>
      </div>
    </div>
  );
}
