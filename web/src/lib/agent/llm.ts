import "server-only";

// Client streaming « chat/completions » compatible OpenAI, avec une CHAÎNE D'ACCÈS de secours :
//   Gemini (principal)  ->  Groq (plusieurs clés en rotation)  ->  modèles plus légers.
// Variables d'environnement :
//   GEMINI_API_KEY                  clé Google AI Studio (principal)
//   GROQ_API_KEYS=gsk_a,gsk_b,...   clés Groq (secours, utilisées à tour de rôle) — GROQ_API_KEY accepté aussi
//   LLM_MODEL / LLM_FALLBACK_MODELS modèles Gemini ; GROQ_MODELS modèles Groq ; LLM_REASONING_EFFORT
//   LLM_BASE_URL + LLM_API_KEY      remplace tout par un fournisseur compatible unique
// Un accès qui renvoie un 429 est mis en pause le temps indiqué par le fournisseur (pas réessayé à chaque étape).

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  /** Champs propres au fournisseur (ex. signature de raisonnement Gemini) à renvoyer tels quels. */
  [extra: string]: unknown;
}

export type LlmMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[]; [extra: string]: unknown }
  | { role: "tool"; tool_call_id: string; content: string; name?: string };

type Provider = "gemini" | "groq" | "custom";

interface Route {
  id: string;
  provider: Provider;
  providerLabel: string;
  baseUrl: string;
  apiKey: string;
  /** Numéro de clé (Groq), pour les journaux — jamais la clé elle-même. */
  keyNo: number;
  model: string;
  reasoning?: string;
  /** Prompt compact + résultats d'outils raccourcis (petits quotas de tokens). */
  compact: boolean;
  /** Taille maximale estimée d'une requête acceptée par le modèle (tokens). */
  maxRequestTokens?: number;
}

// Adresses surchargeables (tests avec de faux serveurs) ; valeurs par défaut = API officielles.
const GEMINI_URL = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai";
const GROQ_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"];
const GEMINI_UTILITY = ["gemini-3.5-flash-lite", "gemini-3.7-flash"];
const GROQ_MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"];
const GROQ_UTILITY = ["llama-3.1-8b-instant", "openai/gpt-oss-20b"];
/** Limites de tokens par minute du tier gratuit Groq (une requête plus grosse est refusée d'office). */
const GROQ_TPM: Record<string, number> = {
  "openai/gpt-oss-120b": 8000, "openai/gpt-oss-20b": 8000, "llama-3.3-70b-versatile": 12000, "llama-3.1-8b-instant": 6000,
};

const list = (v?: string) => (v ?? "").split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
const uniq = <T,>(a: T[]) => [...new Set(a)];

function keys() {
  const env = process.env;
  return {
    custom: env.LLM_BASE_URL ? { baseUrl: env.LLM_BASE_URL.replace(/\/$/, ""), apiKey: env.LLM_API_KEY ?? "" } : null,
    gemini: env.GEMINI_API_KEY?.trim() || "",
    groq: uniq([...list(env.GROQ_API_KEYS), ...list(env.GROQ_API_KEY)]),
  };
}

let rotation = 0;

/** Chaîne d'accès ordonnée pour une requête (les clés Groq tournent d'une requête à l'autre). */
function buildRoutes(kind: "agent" | "utility", rotate = true): Route[] {
  const env = process.env;
  const k = keys();
  if (k.custom) {
    const models = uniq([...list(env.LLM_MODEL), ...list(env.LLM_FALLBACK_MODELS)]);
    return models.map((model) => ({
      id: `custom:${model}`, provider: "custom", providerLabel: new URL(k.custom!.baseUrl).hostname,
      baseUrl: k.custom!.baseUrl, apiKey: k.custom!.apiKey, keyNo: 1, model, compact: false, reasoning: env.LLM_REASONING_EFFORT,
    }));
  }

  const geminiModels = kind === "utility"
    ? GEMINI_UTILITY
    : env.LLM_MODEL ? uniq([...list(env.LLM_MODEL), ...list(env.LLM_FALLBACK_MODELS)]) : GEMINI_MODELS;
  const gemini: Route[] = k.gemini
    ? geminiModels.map((model) => ({
        id: `gemini:1:${model}`, provider: "gemini", providerLabel: "Gemini", baseUrl: GEMINI_URL, apiKey: k.gemini, keyNo: 1, model,
        compact: false, reasoning: kind === "utility" ? "minimal" : env.LLM_REASONING_EFFORT || undefined,
      }))
    : [];

  const groqModels = kind === "utility" ? GROQ_UTILITY : env.GROQ_MODELS ? list(env.GROQ_MODELS) : GROQ_MODELS;
  const all = k.groq.map((key, i) => ({ key, no: i + 1 }));
  const start = all.length ? (rotate ? rotation++ : rotation) % all.length : 0;
  const groqKeys = [...all.slice(start), ...all.slice(0, start)];
  const groqFor = (model: string): Route[] => groqKeys.map(({ key, no }) => ({
    id: `groq:${no}:${model}`, provider: "groq", providerLabel: "Groq", baseUrl: GROQ_URL, apiKey: key, keyNo: no, model,
    compact: true, maxRequestTokens: GROQ_TPM[model],
    reasoning: model.startsWith("openai/gpt-oss") ? "low" : undefined,
  }));

  // Ordre : 2 meilleurs Gemini, puis 1er modèle Groq (toutes les clés), puis Gemini restants, puis Groq restants.
  return [
    ...gemini.slice(0, 2),
    ...groqModels.slice(0, 1).flatMap(groqFor),
    ...gemini.slice(2),
    ...groqModels.slice(1).flatMap(groqFor),
  ];
}

/** Résumé de configuration pour l'interface (aucune clé exposée). */
export function llmSummary() {
  const agent = buildRoutes("agent", false);
  const k = keys();
  const primary = agent[0];
  return {
    hasKey: agent.length > 0,
    label: primary?.providerLabel ?? "Aucun fournisseur",
    model: primary?.model ?? "",
    fallback: k.groq.length && k.gemini ? `secours Groq · ${k.groq.length} clé${k.groq.length > 1 ? "s" : ""}` : "",
  };
}

// ── État des accès (par instance serveur) : pauses après 429 ──
const cooldown = new Map<string, number>();
const COOLDOWN_DEFAULT_S = 20;
/** Pause après épuisement d'un quota journalier (réessai au plus toutes les heures). */
const DAILY_COOLDOWN_MS = 60 * 60_000;
/** Accès dont le quota du jour est épuisé (message d'erreur explicite). */
const dailyExhausted = new Set<string>();

/** Réinitialise pauses et quotas mémorisés (tests, ou après ajout de clés). */
export function resetAccessState() {
  cooldown.clear();
  dailyExhausted.clear();
}

export function routeStatus(kind: "agent" | "utility" = "agent") {
  const now = Date.now();
  return buildRoutes(kind, false).map((r) => ({
    provider: r.providerLabel, key: r.keyNo, model: r.model,
    pausedFor: Math.max(0, Math.round(((cooldown.get(r.id) ?? 0) - now) / 1000)),
  }));
}

/** Vérifie chaque clé (GET /models : ne consomme pas de quota de génération). */
export async function probeKeys() {
  const k = keys();
  const targets = [
    ...(k.gemini ? [{ provider: "Gemini", no: 1, baseUrl: GEMINI_URL, key: k.gemini }] : []),
    ...k.groq.map((key, i) => ({ provider: "Groq", no: i + 1, baseUrl: GROQ_URL, key })),
    ...(k.custom ? [{ provider: "custom", no: 1, baseUrl: k.custom.baseUrl, key: k.custom.apiKey }] : []),
  ];
  return Promise.all(targets.map(async (t) => {
    try {
      const r = await fetch(`${t.baseUrl}/models`, { headers: { Authorization: `Bearer ${t.key}` }, signal: AbortSignal.timeout(10_000) });
      return { provider: t.provider, key: t.no, ok: r.ok, status: r.status };
    } catch (e) {
      return { provider: t.provider, key: t.no, ok: false, status: 0, error: (e as Error).message };
    }
  }));
}

export class LlmError extends Error {}

export type StreamEvent =
  | { type: "delta"; text: string }
  | {
      type: "final"; content: string; toolCalls: ToolCall[]; extras: Record<string, unknown>;
      model: string; provider: string;
      /** Motif d'arrêt renvoyé par le fournisseur (stop, length, tool_calls…). */
      finishReason: string | null;
      /** Flux coupé avant la fin (erreur glissée dans le flux, pas de [DONE]). */
      interrupted: boolean;
    };

const retryable = (status: number, body: string) =>
  status === 429 || status === 404 || status === 413 || status === 503 || status === 500 || status === 502 ||
  /RESOURCE_EXHAUSTED|model_not_found|decommission|not found for API version|overloaded|UNAVAILABLE|rate_limit|too large/i.test(body);

/** Délai conseillé après un 429 (« retryDelay: "12s" », « try again in 1m7.6s », en-tête retry-after), en secondes. */
function retryDelaySeconds(body: string, header: string | null): number | null {
  if (header && Number.isFinite(Number(header))) return Number(header);
  const groq = body.match(/try again in\s*(?:(\d+)m)?(\d+(?:\.\d+)?)s/i);
  if (groq) return Number(groq[1] ?? 0) * 60 + Number(groq[2]);
  const google = body.match(/retry(?:Delay)?["\s:]*(?:in\s*)?"?(\d+(?:\.\d+)?)s/i);
  return google ? Number(google[1]) : null;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new Error("aborted")); }, { once: true });
  });

/** Fusion récursive (pour reconstituer les champs supplémentaires envoyés par morceaux). */
function merge(target: Record<string, unknown>, src: Record<string, unknown>) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      target[k] = merge((target[k] as Record<string, unknown>) ?? {}, v as Record<string, unknown>);
    } else if (typeof v === "string" && typeof target[k] === "string" && k !== "id" && k !== "type" && k !== "name") {
      target[k] = (target[k] as string) + v;
    } else {
      target[k] = v;
    }
  }
  return target;
}

/**
 * Messages adaptés au fournisseur visé :
 *  - Gemini : chaque appel d'outil doit porter une signature de raisonnement ; ceux produits par un autre
 *    modèle reçoivent la signature neutre acceptée par Google (« skip_thought_signature_validator ») ;
 *  - autres : champs non standard retirés (extra_content, name…) ;
 *  - accès « compact » : prompt compact et résultats d'outils raccourcis.
 */
function prepare(messages: LlmMessage[], route: Route, compactSystem?: string): LlmMessage[] {
  return messages.map((m, i) => {
    if (i === 0 && m.role === "system" && route.compact && compactSystem) return { role: "system", content: compactSystem };
    if (m.role === "assistant") {
      const toolCalls = m.tool_calls?.map((tc) => {
        const base = { id: tc.id, type: "function" as const, function: { name: tc.function.name, arguments: tc.function.arguments } };
        if (route.provider !== "gemini") return base;
        const sig = (tc.extra_content as { google?: { thought_signature?: string } } | undefined)?.google?.thought_signature
          ?? "skip_thought_signature_validator";
        return { ...base, extra_content: { google: { thought_signature: sig } } };
      });
      if (route.provider === "gemini") return toolCalls ? { ...m, tool_calls: toolCalls } : m;
      return toolCalls?.length
        ? { role: "assistant", content: m.content ?? null, tool_calls: toolCalls }
        : { role: "assistant", content: m.content ?? "" };
    }
    if (m.role === "tool") {
      const content = route.compact && m.content.length > 2500 ? `${m.content.slice(0, 2500)}…(tronqué)` : m.content;
      return route.provider === "gemini" ? { ...m, content } : { role: "tool", tool_call_id: m.tool_call_id, content };
    }
    return m;
  });
}

const estimateTokens = (body: unknown) => Math.round(JSON.stringify(body).length / 3.4);

/**
 * Appel en streaming sur la chaîne d'accès, avec reprise sur incident :
 *  - 503 / flux coupé avant tout texte : même accès une fois, puis accès suivant ;
 *  - 429 : accès mis en pause (délai du fournisseur) et accès suivant ; si tout est en pause, attente du plus court ;
 *  - 413 / requête trop grosse pour un modèle : ce modèle est sauté pour toutes les clés ;
 *  - flux coupé APRÈS du texte affiché : renvoyé avec interrupted=true (l'appelant fait reprendre la suite).
 */
export async function* streamCompletion(
  messages: LlmMessage[], tools: unknown[], signal?: AbortSignal,
  opts: { utility?: boolean; compactSystem?: string } = {},
): AsyncGenerator<StreamEvent> {
  const routes = buildRoutes(opts.utility ? "utility" : "agent");
  if (!routes.length) throw new LlmError("Aucune clé API configurée : ajoutez GEMINI_API_KEY (et/ou GROQ_API_KEYS) dans web/.env.local puis redémarrez le serveur.");

  let lastError = "";
  const retried = new Set<string>();
  const tooLarge = new Set<string>();
  const queue: { route: Route; waitMs?: number }[] = [];
  const paused: Route[] = [];
  for (const route of routes) {
    if ((cooldown.get(route.id) ?? 0) > Date.now()) paused.push(route);
    else queue.push({ route });
  }
  const started = Date.now();
  const resumed = new Set<string>();
  const resumeSoonest = () => {
    // Tous les accès disponibles ont échoué : on attend le moins longtemps possible (≤ 30 s) un accès en pause.
    // Chaque accès n'est repris qu'UNE fois et l'attente totale est plafonnée (sinon : boucle 429 → attente → 429…).
    const now = Date.now();
    if (now - started > 45_000) return false;
    const next = paused.filter((r) => !tooLarge.has(r.model) && !resumed.has(r.id))
      .map((r) => ({ r, wait: (cooldown.get(r.id) ?? now) - now })).filter((c) => c.wait <= 30_000)
      .sort((a, b) => a.wait - b.wait)[0];
    if (!next) return false;
    resumed.add(next.r.id);
    paused.splice(paused.indexOf(next.r), 1);
    console.warn(`[agent] tous les accès sont saturés : attente de ${Math.ceil(next.wait / 1000)} s (${next.r.providerLabel} #${next.r.keyNo} ${next.r.model})`);
    queue.push({ route: next.r, waitMs: Math.max(0, next.wait) + 300 });
    return true;
  };

  while (queue.length || resumeSoonest()) {
    const { route, waitMs } = queue.shift()!;
    if (tooLarge.has(route.model)) continue;
    if (waitMs) await sleep(waitMs, signal);
    const tag = `${route.providerLabel} #${route.keyNo} ${route.model}`;

    const body: Record<string, unknown> = { model: route.model, messages: prepare(messages, route, opts.compactSystem), stream: true, temperature: 0.2 };
    if (tools.length) Object.assign(body, { tools, tool_choice: "auto" });
    if (route.reasoning) body.reasoning_effort = route.reasoning;
    if (route.maxRequestTokens) {
      const est = estimateTokens(body);
      if (est > route.maxRequestTokens * 0.95) {
        tooLarge.add(route.model);
        console.warn(`[agent] ${tag} : requête ≈ ${est} tokens > limite ${route.maxRequestTokens}, modèle sauté`);
        continue;
      }
    }

    let res: Response;
    try {
      res = await fetch(`${route.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${route.apiKey}` },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      lastError = `${tag} → réseau : ${(e as Error).message}`;
      console.warn(`[agent] ${lastError}`);
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      lastError = `${tag} → HTTP ${res.status} : ${text.slice(0, 400)}`;
      // Quota précis (ex. GenerateRequestsPerDayPerProjectPerModel-FreeTier) : utile au diagnostic.
      const quota = text.match(/"quotaId"\s*:\s*"([^"]+)"/)?.[1];
      console.warn(`[agent] ${tag} → HTTP ${res.status}${quota ? ` · quota ${quota}` : ""} : ${text.replace(/\s+/g, " ").slice(0, 160)}`);
      if (res.status === 401 || res.status === 403) {
        // Clé invalide : on ne bloque pas toute la chaîne s'il reste d'autres accès.
        if (routes.length > 1) { cooldown.set(route.id, Date.now() + 10 * 60_000); continue; }
        throw new LlmError(`Clé API refusée (${res.status}) pour ${route.providerLabel}. Vérifiez web/.env.local.`);
      }
      if (!retryable(res.status, text)) throw new LlmError(lastError);
      if (res.status === 413 || /too large|reduce your message size|context_length/i.test(text)) {
        tooLarge.add(route.model);
      } else if (res.status === 429 || /RESOURCE_EXHAUSTED|rate_limit/i.test(text)) {
        if (/PerDay|per[ _]day|requests per day|\bRPD\b|daily/i.test(text)) {
          // Quota JOURNALIER : le délai conseillé (« 15 s ») est trompeur ; pause d'une heure, pas de reprise.
          cooldown.set(route.id, Date.now() + DAILY_COOLDOWN_MS);
          dailyExhausted.add(`${route.providerLabel} ${route.model}`);
        } else {
          const s = retryDelaySeconds(text, res.headers.get("retry-after")) ?? COOLDOWN_DEFAULT_S;
          cooldown.set(route.id, Date.now() + s * 1000);
          paused.push(route);
        }
      } else if (!retried.has(route.id)) {
        retried.add(route.id);
        queue.unshift({ route, waitMs: 1500 }); // surcharge passagère : même accès, une fois
      } else {
        cooldown.set(route.id, Date.now() + 10_000);
      }
      continue;
    }

    let content = "";
    let finishReason: string | null = null;
    let sawDone = false;
    let strayText = ""; // texte hors format SSE (ex. erreur JSON glissée dans le flux)
    const calls: Record<string, unknown>[] = [];
    const extras: Record<string, unknown> = {};

    const absorb = (json: Record<string, unknown>, whole = false) => {
      if (json.error) throw new LlmError(`${tag} : ${JSON.stringify(json.error).slice(0, 300)}`);
      const choice = (json.choices as Record<string, unknown>[] | undefined)?.[0];
      if (typeof choice?.finish_reason === "string") finishReason = choice.finish_reason;
      const delta = ((whole ? choice?.message : choice?.delta) ?? {}) as Record<string, unknown>;
      const out: string[] = [];
      if (typeof delta.content === "string" && delta.content) {
        content += delta.content;
        out.push(delta.content);
      }
      const tcs = delta.tool_calls as Record<string, unknown>[] | undefined;
      tcs?.forEach((tc, pos) => {
        // Certains fournisseurs omettent « index » : chaque appel complet arrive alors d'un bloc.
        const idx = typeof tc.index === "number" ? tc.index : tc.id || (tc.function as Record<string, unknown>)?.name ? calls.length : Math.max(0, calls.length - 1 + pos);
        const { index: _index, ...rest } = tc;
        void _index;
        calls[idx] = merge(calls[idx] ?? {}, rest);
      });
      for (const [k, v] of Object.entries(delta)) {
        if (!["role", "content", "tool_calls", "reasoning", "reasoning_content", "refusal"].includes(k) && v !== null && v !== undefined) {
          merge(extras, { [k]: v });
        }
      }
      return out;
    };
    const readLine = (line: string): string[] => {
      const m = line.match(/^data:\s?(.*)$/);
      if (!m) {
        if (line.trim()) strayText += line;
        return [];
      }
      if (!m[1]) return [];
      if (m[1].trim() === "[DONE]") { sawDone = true; return []; }
      try {
        return absorb(JSON.parse(m[1]));
      } catch (e) {
        if (e instanceof LlmError) throw e;
        strayText += m[1];
        return [];
      }
    };

    const ctype = res.headers.get("content-type") ?? "";
    if (!ctype.includes("text/event-stream")) {
      // Réponse non streamée (certains fournisseurs avec outils)
      for (const t of absorb(await res.json(), true)) yield { type: "delta", text: t };
      sawDone = true;
    } else {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) for (const t of readLine(line)) yield { type: "delta", text: t };
      }
      buffer += decoder.decode();
      for (const t of readLine(buffer)) yield { type: "delta", text: t }; // dernière ligne sans retour final
    }

    // Flux coupé : erreur glissée dans le flux, ou ni [DONE] ni motif d'arrêt.
    const interrupted = /"error"/.test(strayText) || (!sawDone && !finishReason);
    if (interrupted) {
      const reason = strayText.match(/"message"\s*:\s*"([^"]+)"/)?.[1] ?? "flux interrompu";
      console.warn(`[agent] ${tag} : flux interrompu (${reason.slice(0, 120)}) après ${content.length} caractères`);
      if (!content && !calls.length) {
        // Rien n'a encore été affiché : on retente proprement.
        lastError = `${tag} → flux interrompu : ${reason}`;
        if (!retried.has(route.id)) { retried.add(route.id); queue.unshift({ route, waitMs: 1500 }); }
        continue;
      }
    }

    const toolCalls: ToolCall[] = (interrupted ? [] : calls).filter(Boolean).map((c, i) => {
      const fn = (c.function ?? {}) as { name?: string; arguments?: string };
      return {
        ...c,
        id: (c.id as string) || `call_${Date.now().toString(36)}_${i}`,
        type: "function",
        function: { ...fn, name: fn.name ?? "", arguments: fn.arguments || "{}" },
      };
    });
    yield { type: "final", content, toolCalls, extras, model: route.model, provider: route.providerLabel, finishReason, interrupted };
    return;
  }
  const allDaily = routes.every((r) => (cooldown.get(r.id) ?? 0) - Date.now() > 30 * 60_000);
  throw new LlmError(
    allDaily && dailyExhausted.size
      ? "Quota gratuit du jour épuisé sur tous les modèles configurés. Il se réinitialise chaque jour (vers 9 h, heure de Paris) ; pour continuer dès maintenant, ajoutez des clés de secours (GROQ_API_KEYS) ou activez la facturation Gemini."
      : /429|RESOURCE_EXHAUSTED|rate_limit/i.test(lastError) || paused.length
      ? "Quota atteint sur tous les accès configurés (Gemini et Groq). Patientez une minute puis réessayez."
      : /503|UNAVAILABLE|interrompu/.test(lastError)
        ? "Les serveurs des fournisseurs sont momentanément surchargés. Réessayez dans quelques instants."
        : `Aucun modèle disponible. Dernière erreur : ${lastError}`,
  );
}

/** Complétion simple sans outils (titres, résumés) sur les modèles utilitaires. */
export async function completeText(messages: LlmMessage[], signal?: AbortSignal) {
  let text = "";
  for await (const ev of streamCompletion(messages, [], signal, { utility: true })) {
    if (ev.type === "final") text = ev.content;
  }
  return text.trim();
}
