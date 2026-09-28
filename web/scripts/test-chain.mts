// Test de la chaîne d'accès Gemini -> Groq multi-clés, avec de faux serveurs locaux (aucun quota consommé).
// Usage : npm run test:chain
import http from "node:http";

type Captured = { server: string; key: string; body: Record<string, unknown> };
const captured: Captured[] = [];

const ok = (res: http.ServerResponse, text: string) => {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text }, finish_reason: "stop" }] })}\n\n`);
  res.end("data: [DONE]\n\n");
};

function serve(name: string, handler: (key: string, res: http.ServerResponse) => void) {
  return http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const key = String(req.headers.authorization ?? "").replace("Bearer ", "");
      captured.push({ server: name, key, body: raw ? JSON.parse(raw) : {} });
      handler(key, res);
    });
  });
}

const gemini = serve("gemini", (_key, res) => {
  // Gemini : quota gratuit épuisé (délai conseillé 40 s)
  res.writeHead(429, { "Content-Type": "application/json" });
  res.end(JSON.stringify([{ error: { code: 429, status: "RESOURCE_EXHAUSTED", details: [{ retryDelay: "40s" }] } }]));
});
const groq = serve("groq", (key, res) => {
  if (key === "gsk_A") { // clé A : quota épuisé
    res.writeHead(429, { "Content-Type": "application/json", "retry-after": "30" });
    return res.end(JSON.stringify({ error: { message: "Rate limit reached. Please try again in 30s.", type: "tokens", code: "rate_limit_exceeded" } }));
  }
  ok(res, `Réponse Groq (${key})`);
});
await Promise.all([new Promise<void>((r) => gemini.listen(4561, r)), new Promise<void>((r) => groq.listen(4562, r))]);

Object.assign(process.env, {
  GEMINI_BASE_URL: "http://127.0.0.1:4561", GROQ_BASE_URL: "http://127.0.0.1:4562",
  GEMINI_API_KEY: "g_test", GROQ_API_KEYS: "gsk_A, gsk_B, gsk_C",
});
delete process.env.LLM_BASE_URL;
delete process.env.LLM_MODEL;

const { streamCompletion } = await import("../src/lib/agent/llm");

// Historique contenant un appel d'outil SANS signature (comme s'il venait de Groq) + réponse d'outil nommée.
const history = [
  { role: "system" as const, content: "PROMPT COMPLET" },
  { role: "user" as const, content: "Combien de vœux en 2025 ?" },
  { role: "assistant" as const, content: null, tool_calls: [{ id: "c1", type: "function" as const, function: { name: "run_sql", arguments: "{\"sql\":\"SELECT 1\"}" } }] },
  { role: "tool" as const, tool_call_id: "c1", name: "run_sql", content: "{\"rows\":[[13052197]]}" },
];

async function run(label: string) {
  captured.length = 0;
  let text = "", provider = "", model = "";
  for await (const ev of streamCompletion(history, [], undefined, { compactSystem: "PROMPT COMPACT" })) {
    if (ev.type === "delta") text += ev.text;
    else { provider = ev.provider; model = ev.model; }
  }
  const path = captured.map((c) => `${c.server}:${c.key}:${c.body.model}`).join(" → ");
  console.log(`\n${label}\n  parcours : ${path}\n  réponse  : ${provider} ${model} « ${text} »`);
  return captured;
}

const first = await run("1) Gemini en quota épuisé, clé Groq A épuisée");
const toGroq = first.find((c) => c.server === "groq" && c.key !== "gsk_A")!;
const gm = toGroq.body.messages as Record<string, unknown>[];
const asst = gm.find((m) => m.role === "assistant") as { tool_calls: Record<string, unknown>[] };
console.log("  Groq reçoit le prompt compact :", (gm[0].content as string) === "PROMPT COMPACT");
console.log("  Groq : champs non standard retirés :", !("extra_content" in asst.tool_calls[0]) && !("name" in (gm.find((m) => m.role === "tool") ?? {})));
const toGemini = first.find((c) => c.server === "gemini")!;
const gAsst = (toGemini.body.messages as Record<string, unknown>[]).find((m) => m.role === "assistant") as { tool_calls: { extra_content?: { google?: { thought_signature?: string } } }[] };
console.log("  Gemini reçoit la signature neutre :", gAsst.tool_calls[0].extra_content?.google?.thought_signature === "skip_thought_signature_validator");
console.log("  Gemini reçoit le prompt complet :", ((toGemini.body.messages as Record<string, unknown>[])[0].content as string) === "PROMPT COMPLET");

const second = await run("2) Requête suivante : les accès en pause sont sautés sans être réessayés");
console.log("  Gemini réessayé ? ", second.some((c) => c.server === "gemini"), "| clé A réessayée ?", second.some((c) => c.key === "gsk_A"));

gemini.close();
groq.close();
