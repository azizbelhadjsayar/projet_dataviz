import { LlmError, streamCompletion, type LlmMessage, type StreamEvent } from "@/lib/agent/llm";
import { agentSystemPrompt } from "@/lib/agent/prompt";
import { AGENT_TOOLS, AgentSession } from "@/lib/agent/tools";
import type { AgentEvent } from "@/lib/agent/types";

// POST /api/agent — agent d'analyse autonome.
// Boucle : le modèle raisonne, écrit du SQL, lit les résultats, corrige, crée des graphiques, puis conclut.
// Chaque étape est diffusée en direct au navigateur (NDJSON, un AgentEvent par ligne).

export const maxDuration = 120;

const MAX_STEPS = 12;
const MAX_TURNS = 10;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
  queries?: string[];
}

const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 10;
}

/** Historique : réponses finales + SQL exécuté aux tours précédents (mémoire de travail de l'agent). */
function toHistory(messages: IncomingMessage[]): LlmMessage[] {
  return messages.slice(-MAX_TURNS).map((m) => {
    if (m.role === "user") return { role: "user", content: m.content.slice(0, 3000) };
    const answer = m.content.replace(/<suggestions>[\s\S]*?(<\/suggestions>|$)/g, "").trim().slice(0, 4000);
    const queries = (m.queries ?? []).slice(-6).map((q) => q.slice(0, 800));
    return {
      role: "assistant",
      content: queries.length
        ? `${answer}\n\n[Mémoire de travail — requêtes SQL exécutées pour cette réponse :\n${queries.join("\n---\n")}]`
        : answer || "(réponse vide)",
    };
  });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return Response.json({ error: "Trop de requêtes : patientez une minute." }, { status: 429 });

  let incoming: IncomingMessage[];
  let memory = "";
  try {
    const body = await req.json();
    incoming = (Array.isArray(body.messages) ? body.messages : []).filter(
      (m: IncomingMessage) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string");
    memory = typeof body.memory === "string" ? body.memory.slice(0, 5000) : "";
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (!incoming.length || incoming.at(-1)!.role !== "user" || !incoming.at(-1)!.content.trim()) {
    return Response.json({ error: "Le dernier message doit être une question." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (e: AgentEvent) => {
        if (!closed) controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      };
      const session = new AgentSession();
      let recoveries = 0; // reprises après une réponse incomplète
      try {
        // Contexte = prompt système (+ mémoire résumée des anciens échanges) + derniers échanges complets.
        // Deux variantes : complète (Gemini) et compacte (secours Groq, petit quota de tokens).
        const withMemory = (s: string) => memory
          ? `${s}\n\n# Mémoire de cette conversation (résumé des échanges plus anciens)\nUtilise-la pour la continuité (chiffres déjà établis, choix d'analyse, préférences). Revérifie par SQL si un chiffre est déterminant.\n${memory}`
          : s;
        const [system, compactSystem] = (await Promise.all([agentSystemPrompt("full"), agentSystemPrompt("compact")])).map(withMemory);
        const messages: LlmMessage[] = [{ role: "system", content: system }, ...toHistory(incoming)];
        for (let step = 1; step <= MAX_STEPS; step++) {
          if (req.signal.aborted) return;
          // Dernière étape : plus d'outils, l'agent doit conclure avec ce qu'il a.
          const last = step === MAX_STEPS;
          if (last) messages.push({ role: "user", content: "Tu as atteint la limite d'étapes : rédige maintenant ta réponse finale avec les résultats obtenus." });

          let final: Extract<StreamEvent, { type: "final" }> | undefined;
          for await (const ev of streamCompletion(messages, last ? [] : AGENT_TOOLS, req.signal, { compactSystem })) {
            if (ev.type === "delta") send({ type: "text", delta: ev.text });
            else final = ev;
          }
          if (!final) throw new LlmError("Réponse vide du modèle.");

          if (!final.toolCalls.length) {
            // Réponse incomplète : flux coupé par le fournisseur, arrêt pour longueur, ou simple annonce
            // (« Je vais comparer… ») sans exécuter l'étape. Une réponse finale se termine toujours par
            // le bloc <suggestions> : sinon on fait reprendre le modèle exactement là où il s'est arrêté.
            const text = final.content;
            const cut = final.interrupted || final.finishReason === "length" || final.finishReason === "max_tokens";
            const complete = text.includes("</suggestions>") || (text.includes("<suggestions>") && !cut);
            const endsClean = /[.!?…:»)\]*`]\s*$/.test(text.trim());
            if (!last && recoveries < 3 && !complete && (cut || text.length < 600 || !endsClean)) {
              recoveries++;
              console.warn(`[agent] étape ${step} : réponse incomplète (${cut ? `coupée, finish=${final.finishReason ?? "?"}` : "annonce sans outil"}), reprise ${recoveries}/3 (${final.model})`);
              messages.push({ role: "assistant", content: text || "(vide)" });
              messages.push({
                role: "user",
                content: cut
                  ? "Ton message précédent a été coupé avant la fin (incident technique). Reprends EXACTEMENT au mot où il s'arrête, sans rien répéter de ce qui est déjà écrit, puis termine normalement, bloc <suggestions> compris. S'il te restait une étape d'analyse, appelle l'outil."
                  : "Poursuis : s'il reste une étape d'analyse, exécute-la maintenant avec run_sql ; sinon, continue ta réponse là où elle s'arrête (sans rien répéter) et termine par le bloc <suggestions>.",
              });
              // Le texte reprend à la suite : espace si on est au milieu d'une phrase, sinon nouveau paragraphe.
              if (text) send({ type: "text", delta: endsClean ? "\n\n" : /[\p{L}\p{N}]$/u.test(text) ? " " : "" });
              continue;
            }
            if (final.finishReason && !["stop", "tool_calls"].includes(final.finishReason)) {
              console.warn(`[agent] fin inhabituelle : finish=${final.finishReason} (${final.model})`);
            }
            send({ type: "done", model: final.model, provider: final.provider, steps: step });
            return;
          }

          messages.push({ role: "assistant", content: final.content || null, tool_calls: final.toolCalls, ...final.extras });
          for (const call of final.toolCalls) {
            let args: Record<string, unknown> = {};
            let result: unknown;
            try {
              args = JSON.parse(call.function.arguments || "{}");
            } catch {
              result = { error: "Arguments JSON invalides." };
            }
            if (!result) {
              if (call.function.name === "run_sql") result = await session.runSql(args, send);
              else if (call.function.name === "create_chart") result = session.createChart(args, send);
              else result = { error: `Outil inconnu : ${call.function.name}` };
            }
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(result),
              name: call.function.name, // utile à Gemini ; retiré pour les autres fournisseurs
            });
          }
        }
      } catch (e) {
        if (req.signal.aborted) return;
        const message = e instanceof LlmError ? e.message : `Erreur serveur : ${(e as Error).message}`;
        send({ type: "error", message });
      } finally {
        closed = true;
        try { controller.close(); } catch { /* déjà fermé */ }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
