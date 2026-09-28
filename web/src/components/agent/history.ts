// Historique des conversations, stocké dans le navigateur (IndexedDB, asynchrone, sans bloquer l'interface).
// Deux magasins :
//   meta  : liste légère (titre, dates, aperçu) chargée au démarrage pour le panneau d'historique
//   data  : messages complets + mémoire résumée, chargés uniquement à l'ouverture d'une conversation
// Repli en mémoire si IndexedDB est indisponible (navigation privée stricte…).

import type { Message } from "./model";

export interface ConversationMeta {
  id: string;
  title: string;
  /** fallback = début de la question ; auto = généré par le modèle ; user = renommé. */
  titleSource: "fallback" | "auto" | "user";
  createdAt: number;
  updatedAt: number;
  turns: number;
  /** Première question (sert à la recherche). */
  preview: string;
  pinned?: boolean;
}

export interface ConversationMemory {
  /** Résumé des échanges anciens (hors fenêtre récente). */
  summary: string;
  /** Nombre de messages couverts par le résumé (depuis le début). */
  upTo: number;
}

export interface ConversationData {
  id: string;
  messages: Message[];
  memory?: ConversationMemory | null;
}

const DB_NAME = "parcoursup-agent";
const MAX_CONVERSATIONS = 150;
const MAX_STORED_ROWS = 50;

let dbPromise: Promise<IDBDatabase | null> | null = null;
const fallback = { meta: new Map<string, ConversationMeta>(), data: new Map<string, ConversationData>() };

function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "id" });
          if (!db.objectStoreNames.contains("data")) db.createObjectStore("data", { keyPath: "id" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

const wrap = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

/** Allège une conversation avant stockage : résultats SQL limités à 50 lignes (les graphiques gardent leurs données). */
function compact(messages: Message[]): Message[] {
  return messages.map((m) => {
    if (!m.blocks) return m;
    return {
      ...m,
      blocks: m.blocks.map((b) =>
        b.kind === "sql" && b.rows && b.rows.length > MAX_STORED_ROWS
          ? { ...b, rows: b.rows.slice(0, MAX_STORED_ROWS), truncated: true }
          : b),
    };
  });
}

export async function listConversations(): Promise<ConversationMeta[]> {
  const db = await openDb();
  const all = db ? await wrap(db.transaction("meta").objectStore("meta").getAll() as IDBRequest<ConversationMeta[]>) : [...fallback.meta.values()];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadConversation(id: string): Promise<ConversationData | undefined> {
  const db = await openDb();
  if (!db) return fallback.data.get(id);
  return wrap(db.transaction("data").objectStore("data").get(id) as IDBRequest<ConversationData | undefined>);
}

export async function saveConversation(meta: ConversationMeta, data: ConversationData) {
  const stored = { ...data, messages: compact(data.messages) };
  const db = await openDb();
  if (!db) {
    fallback.meta.set(meta.id, meta);
    fallback.data.set(meta.id, stored);
    return;
  }
  const tx = db.transaction(["meta", "data"], "readwrite");
  tx.objectStore("meta").put(meta);
  tx.objectStore("data").put(stored);
  await done(tx);
}

export async function patchMeta(id: string, patch: Partial<ConversationMeta>) {
  const db = await openDb();
  if (!db) {
    const cur = fallback.meta.get(id);
    if (cur) fallback.meta.set(id, { ...cur, ...patch });
    return;
  }
  const tx = db.transaction("meta", "readwrite");
  const store = tx.objectStore("meta");
  const cur = await wrap(store.get(id) as IDBRequest<ConversationMeta | undefined>);
  if (cur) store.put({ ...cur, ...patch });
  await done(tx);
}

export async function patchMemory(id: string, memory: ConversationMemory) {
  const db = await openDb();
  if (!db) {
    const cur = fallback.data.get(id);
    if (cur) fallback.data.set(id, { ...cur, memory });
    return;
  }
  const tx = db.transaction("data", "readwrite");
  const store = tx.objectStore("data");
  const cur = await wrap(store.get(id) as IDBRequest<ConversationData | undefined>);
  if (cur) store.put({ ...cur, memory });
  await done(tx);
}

export async function deleteConversation(id: string) {
  const db = await openDb();
  if (!db) {
    fallback.meta.delete(id);
    fallback.data.delete(id);
    return;
  }
  const tx = db.transaction(["meta", "data"], "readwrite");
  tx.objectStore("meta").delete(id);
  tx.objectStore("data").delete(id);
  await done(tx);
}

/** Garde les conversations épinglées et les plus récentes ; supprime les plus anciennes au-delà du plafond. */
export async function pruneConversations(max = MAX_CONVERSATIONS): Promise<string[]> {
  const all = await listConversations();
  const removable = all.filter((c) => !c.pinned).slice(Math.max(0, max - all.filter((c) => c.pinned).length));
  for (const c of removable) await deleteConversation(c.id);
  return removable.map((c) => c.id);
}

export const newConversationId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Titre provisoire : début de la question, coupé proprement. */
export function fallbackTitle(question: string) {
  const q = question.replace(/\s+/g, " ").trim();
  if (q.length <= 60) return q;
  const cut = q.slice(0, 60);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40))}…`;
}
