import { probeKeys, routeStatus } from "@/lib/agent/llm";

// GET /api/agent/status          -> chaîne d'accès (fournisseur, n° de clé, modèle, pause en cours)
// GET /api/agent/status?probe=1  -> + vérification de chaque clé (GET /models, sans consommer de quota de génération)
// Aucune clé n'est jamais renvoyée.

export async function GET(req: Request) {
  const probe = new URL(req.url).searchParams.get("probe") === "1";
  return Response.json(
    {
      agent: routeStatus("agent"),
      utility: routeStatus("utility"),
      ...(probe ? { keys: await probeKeys() } : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
