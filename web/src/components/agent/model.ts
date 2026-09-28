import type { AgentEvent, ChartPayload } from "@/lib/agent/types";

// Modèle d'affichage d'une conversation avec l'agent.

export type SqlBlock = {
  kind: "sql"; id: string; purpose: string; sql: string; status: "running" | "ok" | "error";
  columns?: string[]; rows?: (string | number | boolean | null)[][]; truncated?: boolean; ms?: number; error?: string;
};
export type Block = { kind: "text"; text: string } | SqlBlock | { kind: "chart"; chart: ChartPayload };

export interface Message {
  role: "user" | "assistant";
  /** Question (user) ou réponse finale (assistant, reconstituée à la fin). */
  content: string;
  blocks?: Block[];
  queries?: string[];
  model?: string;
  provider?: string;
  steps?: number;
  startedAt?: number;
  seconds?: number;
  error?: string;
  stopped?: boolean;
}

/** Applique un événement du flux à la réponse en cours (fonction pure). */
export function reduceEvent(m: Message, ev: AgentEvent): Message {
  const blocks = [...(m.blocks ?? [])];
  const last = blocks[blocks.length - 1];
  switch (ev.type) {
    case "text":
      if (last?.kind === "text") blocks[blocks.length - 1] = { kind: "text", text: last.text + ev.delta };
      else blocks.push({ kind: "text", text: ev.delta });
      return { ...m, blocks };
    case "sql":
      blocks.push({ kind: "sql", id: ev.id, purpose: ev.purpose, sql: ev.sql, status: "running" });
      return { ...m, blocks };
    case "sql_result":
    case "sql_error": {
      const i = blocks.findIndex((b) => b.kind === "sql" && b.id === ev.id);
      if (i < 0) return m;
      const b = blocks[i] as SqlBlock;
      blocks[i] = ev.type === "sql_result"
        ? { ...b, status: "ok", columns: ev.columns, rows: ev.rows, truncated: ev.truncated, ms: ev.ms }
        : { ...b, status: "error", error: ev.error };
      return { ...m, blocks, queries: ev.type === "sql_result" ? [...(m.queries ?? []), b.sql] : m.queries };
    }
    case "chart":
      blocks.push({ kind: "chart", chart: ev.chart });
      return { ...m, blocks };
    case "chart_error":
      return m;
    case "done":
      return { ...m, model: ev.model, provider: ev.provider, steps: ev.steps };
    case "error":
      return { ...m, error: ev.message };
  }
}

/** Réponse finale = texte qui suit la dernière étape (outil). */
export function finalAnswer(blocks: Block[] = []) {
  const lastStep = blocks.reduce((acc, b, i) => (b.kind !== "text" ? i : acc), -1);
  return blocks.slice(lastStep + 1).map((b) => (b.kind === "text" ? b.text : "")).join("");
}

/**
 * Retire les balises inventées par certains modèles pour « placer » un graphique ou un tableau
 * (<visualization chart_id="c1">, <chart/>, <figure>…) : les graphiques s'affichent déjà dans le fil.
 * Seules les balises à nom alphabétique sont visées (« < 5 % » ou « a<b » restent intacts).
 */
export function cleanAnswer(text: string) {
  return text
    .replace(/<\/?(?!suggestions\b)[a-z][\w-]*(?:\s[^<>]*)?\/?>/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** Sépare la réponse de son bloc <suggestions> (affiché en boutons de relance). */
export function splitSuggestions(text: string) {
  const i = text.indexOf("<suggestions>");
  if (i < 0) {
    // Pendant le streaming, on masque un début de balise en cours d'écriture (quelle qu'elle soit).
    const lt = text.lastIndexOf("<");
    const partialTag = lt >= 0 && /^<\/?[a-z][\w-]*(?:\s[^<>]*)?$/i.test(text.slice(lt));
    return { body: cleanAnswer(partialTag ? text.slice(0, lt) : text), suggestions: [] as string[] };
  }
  const inner = text.slice(i + "<suggestions>".length).split("</suggestions>")[0];
  return {
    body: cleanAnswer(text.slice(0, i)).trimEnd(),
    suggestions: inner.split("\n").map((s) => s.replace(/^[-*•\d.)\s]+/, "").trim()).filter((s) => s.length > 3).slice(0, 3),
  };
}

// ── Découpage en segments d'affichage (flux continu, dans l'ordre des événements) ──

export type Step =
  | { kind: "sql"; block: SqlBlock; narration: string }
  | { kind: "chart"; chart: ChartPayload; narration: string };

export type Segment =
  | { kind: "steps"; steps: Step[]; pending?: string }
  | { kind: "chart"; chart: ChartPayload }
  | { kind: "answer"; text: string };

/**
 * Annonce d'étape propre : si le modèle a enchaîné sur l'appel d'outil au milieu d'une phrase
 * (« … (Lille et Amiens) Je compare les »), on garde la dernière phrase complète.
 */
function cleanNarration(t: string) {
  const s = t.trim();
  if (!s || /[.!?…:)»]$/.test(s)) return s;
  const lastEnd = Math.max(s.lastIndexOf(". "), s.lastIndexOf(": "), s.lastIndexOf("! "), s.lastIndexOf("? "), s.lastIndexOf(") "));
  return lastEnd > 20 ? s.slice(0, lastEnd + 1) : `${s}…`;
}

/** Texte en cours qui ressemble à l'annonce d'une étape plutôt qu'à la réponse finale. */
const looksLikeNarration = (t: string) => {
  const s = t.trim();
  return s.length < 260 && !s.includes("\n\n") && !/^(\*\*|#|\||-\s|\d+\.)/.test(s);
};

export function toSegments(blocks: Block[], live: boolean): Segment[] {
  const segs: Segment[] = [];
  let pending = "";
  for (const b of blocks) {
    if (b.kind === "text") { pending += b.text; continue; }
    let group = segs[segs.length - 1];
    if (group?.kind !== "steps") segs.push((group = { kind: "steps", steps: [] }));
    const narration = cleanNarration(cleanAnswer(pending));
    pending = "";
    if (b.kind === "sql") group.steps.push({ kind: "sql", block: b, narration });
    else {
      group.steps.push({ kind: "chart", chart: b.chart, narration });
      segs.push({ kind: "chart", chart: b.chart });
    }
  }
  if (pending.trim()) {
    if (live && looksLikeNarration(pending)) {
      const group = segs[segs.length - 1];
      const p = cleanAnswer(pending).trim();
      if (group?.kind === "steps") group.pending = p;
      else segs.push({ kind: "steps", steps: [], pending: p });
    } else {
      segs.push({ kind: "answer", text: pending });
    }
  }
  return segs;
}

// ── Libellés des modèles ──

/** Nom lisible d'un modèle : gemini-3.5-flash-lite → « Gemini 3.5 Flash-Lite », openai/gpt-oss-120b → « GPT-OSS 120B ». */
export function prettyModel(id?: string) {
  if (!id) return "";
  return id.split("/").pop()!
    .replace(/-(versatile|instant|preview|latest)$/i, "")
    .replace(/flash-lite/i, "Flash‑Lite") // tiret insécable : préservé par le découpage ci-dessous
    .replace(/gpt-oss/i, "GPT‑OSS")
    .split("-")
    .map((w) => (/^\d+(\.\d+)?b$/i.test(w) ? w.toUpperCase() : /^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** « Groq · GPT-OSS 120B », mais « Gemini 3.8 Flash » (sans répéter le fournisseur déjà présent dans le nom). */
export function modelLabel(model?: string, provider?: string) {
  const name = prettyModel(model);
  return provider && !name.toLowerCase().startsWith(provider.toLowerCase()) ? `${provider} · ${name}` : name;
}
