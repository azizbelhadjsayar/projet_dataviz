import { completeText, LlmError } from "@/lib/agent/llm";

// POST /api/agent/memory — tâches annexes de l'historique, sur un modèle léger :
//   { task: "title", question, answer }          -> { title }    titre court de la conversation
//   { task: "summary", previous, turns: [...] }  -> { summary }  mémoire résumée des anciens échanges
// Le résumé remplace les échanges anciens dans le contexte de l'agent : la taille des requêtes reste
// constante quelle que soit la longueur de la conversation.

export const maxDuration = 60;

interface Turn {
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
  return recent.length > 20;
}

const SUMMARY_SYSTEM = `Tu maintiens la MÉMOIRE d'une conversation entre un utilisateur et un agent d'analyse des données Parcoursup 2021-2025 (base SQL, table formations).
À partir de la mémoire précédente et des nouveaux échanges, produis une mémoire mise à jour, en français, en 250 mots maximum, sous forme de puces courtes regroupées ainsi :
- Sujets et questions traités
- Résultats clés : chiffres EXACTS avec leur périmètre (session, filtres, unité)
- Choix d'analyse retenus : définitions, filtres, seuils, colonnes SQL utiles
- Préférences de l'utilisateur (format, niveau de détail…) et pistes restant à explorer
Garde les chiffres tels quels, n'invente rien, supprime les redondances, pas de SQL complet. Réponds uniquement avec la mémoire.`;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return Response.json({ error: "Trop de requêtes." }, { status: 429 });

  let body: { task?: string; question?: string; answer?: string; previous?: string; turns?: Turn[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    if (body.task === "title") {
      const question = String(body.question ?? "").slice(0, 1000);
      if (!question) return Response.json({ error: "Question manquante." }, { status: 400 });
      const raw = await completeText([
        { role: "system", content: "Tu donnes un titre à une conversation d'analyse de données. Réponds UNIQUEMENT par un titre en français de 3 à 6 mots, sans guillemets, sans point final, avec une majuscule initiale." },
        { role: "user", content: `Question : ${question}\n\nDébut de la réponse : ${String(body.answer ?? "").slice(0, 600)}` },
      ], req.signal);
      const title = raw.split("\n")[0].replace(/^["'«»*#\s]+|["'«»*.\s]+$/g, "").slice(0, 70);
      return Response.json({ title: title || null });
    }

    if (body.task === "summary") {
      const turns = (Array.isArray(body.turns) ? body.turns : []).slice(0, 12);
      if (!turns.length) return Response.json({ error: "Aucun échange à résumer." }, { status: 400 });
      const transcript = turns.map((t) => {
        if (t.role === "user") return `UTILISATEUR : ${String(t.content).slice(0, 1200)}`;
        const q = (t.queries ?? []).slice(-3).map((s) => `  · ${String(s).replace(/\s+/g, " ").slice(0, 300)}`).join("\n");
        return `AGENT : ${String(t.content).slice(0, 2500)}${q ? `\n  (requêtes utilisées)\n${q}` : ""}`;
      }).join("\n\n");
      const summary = await completeText([
        { role: "system", content: SUMMARY_SYSTEM },
        { role: "user", content: `MÉMOIRE PRÉCÉDENTE :\n${String(body.previous ?? "(aucune)").slice(0, 4000)}\n\nNOUVEAUX ÉCHANGES À INTÉGRER :\n${transcript}` },
      ], req.signal);
      return Response.json({ summary: summary.slice(0, 5000) || null });
    }

    return Response.json({ error: "Tâche inconnue." }, { status: 400 });
  } catch (e) {
    const message = e instanceof LlmError ? e.message : (e as Error).message;
    return Response.json({ error: message }, { status: 502 });
  }
}
