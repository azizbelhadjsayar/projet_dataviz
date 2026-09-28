import { getShapes } from "@/lib/geo";

// GET /api/geo/regions | /api/geo/departements — contours projetés (chemins SVG), mis en cache par le navigateur.
// Permet de ne pas embarquer les 100 départements dans le premier chargement de la page Territoires.

export async function GET(_req: Request, ctx: RouteContext<"/api/geo/[level]">) {
  const { level } = await ctx.params;
  if (level !== "regions" && level !== "departements") return Response.json({ error: "Échelon inconnu" }, { status: 404 });
  return Response.json(getShapes(level), {
    headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
