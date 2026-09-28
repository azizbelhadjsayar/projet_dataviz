// Test du client LLM face à un flux coupé (reproduction de l'incident Gemini) — faux serveur local.
import http from "node:http";

const scenarios: Record<string, (res: http.ServerResponse) => void> = {
  // 1. Texte puis erreur JSON brute au milieu du flux, sans [DONE]
  cut: (res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write('data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"En 2025, la région regroupe 1 272 formations "}}]}\n\n');
    res.write('data: {"choices":[{"index":0,"delta":{"content":"pour"}}]}\n\n');
    res.end('[{\n  "error": {\n    "code": 503,\n    "message": "This model is currently experiencing high demand.",\n    "status": "UNAVAILABLE"\n  }\n}\n]');
  },
  // 2. Flux normal dont la dernière ligne n'a pas de retour à la ligne final
  noNewline: (res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write('data: {"choices":[{"index":0,"delta":{"content":"Réponse complète."}}]}\n\n');
    res.end('data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}');
  },
  // 3. Arrêt pour longueur
  length: (res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write('data: {"choices":[{"index":0,"delta":{"content":"Début de réponse"},"finish_reason":"length"}]}\n\n');
    res.end("data: [DONE]\n\n");
  },
  // 4. Coupure AVANT tout texte au 1er essai, puis succès au 2e (reprise automatique attendue)
  cutThenOk: (() => {
    let n = 0;
    return (res: http.ServerResponse) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      if (n++ === 0) { res.end('{"error":{"code":503,"status":"UNAVAILABLE"}}'); return; }
      res.write('data: {"choices":[{"index":0,"delta":{"content":"OK après reprise."},"finish_reason":"stop"}]}\n\n');
      res.end("data: [DONE]\n\n");
    };
  })(),
};

let current = "cut";
const server = http.createServer((req, res) => {
  req.resume();
  req.on("end", () => scenarios[current](res));
});
await new Promise<void>((r) => server.listen(4555, r));
process.env.LLM_BASE_URL = "http://127.0.0.1:4555";
process.env.LLM_API_KEY = "test";
process.env.LLM_MODEL = "modele-test";

const { streamCompletion } = await import("../src/lib/agent/llm");
for (const name of Object.keys(scenarios)) {
  current = name;
  let text = "";
  let final: { interrupted: boolean; finishReason: string | null } | null = null;
  try {
    for await (const ev of streamCompletion([{ role: "user", content: "test" }], [])) {
      if (ev.type === "delta") text += ev.text;
      else final = ev;
    }
    console.log(`${name.padEnd(10)} texte=${JSON.stringify(text)} interrupted=${final?.interrupted} finish=${final?.finishReason}`);
  } catch (e) {
    console.log(`${name.padEnd(10)} ERREUR ${(e as Error).message}`);
  }
}
server.close();
