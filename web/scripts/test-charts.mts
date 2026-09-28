// Test des graphiques de l'agent sur de vraies requêtes DuckDB (aucun appel au modèle).
// Mêmes exemples que la galerie /assistant/graphiques, plus un cas d'erreur attendu.
// Usage : npm run test:charts
const { runQuery } = await import("../src/lib/agent/db");
const { buildChart, chartSize } = await import("../src/lib/agent/charts");
const { CHART_EXAMPLES } = await import("../src/lib/agent/chart-examples");

const cases = [
  ...CHART_EXAMPLES,
  {
    name: "Erreur attendue : taux d'accès multiplié par 100 (bug 6 420 %)",
    sql: `SELECT filiere, secteur, round(100 * sum(taux_acces*voeux_pp) FILTER (WHERE taux_acces IS NOT NULL) / sum(voeux_pp) FILTER (WHERE taux_acces IS NOT NULL), 1) AS taux_acces_moyen
          FROM formations WHERE session = 2025 AND type_formation = 'Licence' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 8`,
    args: { type: "bar", x: "filiere", y: ["taux_acces_moyen"], color_by: "secteur", unit: "pct", title: "t" },
  },
  {
    name: "Évolution > 100 % acceptée (vraie croissance)",
    sql: `SELECT 'Formation test' AS formation, 150.0 AS evolution_voeux_pct`,
    args: { type: "bar", x: "formation", y: ["evolution_voeux_pct"], unit: "pct", title: "t" },
  },
  {
    name: "Erreur attendue : heatmap sans color_by",
    sql: "SELECT session, count(*) AS n FROM formations GROUP BY 1",
    args: { type: "heatmap", x: "session", y: ["n"], unit: "count", title: "t" },
  },
  {
    name: "Erreur attendue : barres à 100 % avec une seule part",
    sql: "SELECT type_formation, sum(voeux_pp) AS voeux_pp FROM formations GROUP BY 1",
    args: { type: "stacked_bar_100", x: "type_formation", y: ["voeux_pp"], unit: "count", title: "t" },
  },
  {
    name: "Erreur attendue : carte avec plusieurs sessions par territoire",
    sql: "SELECT session, region, sum(voeux_pp) AS voeux_pp FROM formations GROUP BY 1, 2",
    args: { type: "map", x: "region", y: ["voeux_pp"], unit: "count", title: "t" },
  },
  {
    name: "Erreur attendue : carte par académie (pas de contours)",
    sql: "SELECT academie, sum(voeux_pp) AS voeux_pp FROM formations WHERE session = 2025 GROUP BY 1",
    args: { type: "map", x: "academie", y: ["voeux_pp"], unit: "count", title: "t" },
  },
  {
    name: "Carte des régions (codes INSEE résolus par le nom)",
    sql: "SELECT region, round(100 * sum(admis_meme_academie) / sum(admis_neobac), 1) AS part_meme_academie FROM formations WHERE session = 2025 GROUP BY 1",
    args: { type: "map", x: "region", y: ["part_meme_academie"], unit: "pct", title: "t" },
  },
  {
    name: "Anneau en format large (une colonne par part)",
    sql: "SELECT sum(admis_bac_general) AS general, sum(admis_bac_techno) AS techno, sum(admis_bac_pro) AS pro FROM formations WHERE session = 2025",
    args: { type: "pie", y: ["general", "techno", "pro"], unit: "count", title: "t" },
  },
];

let failures = 0;
for (const c of cases) {
  const expectError = c.name.startsWith("Erreur attendue");
  try {
    const res = await runQuery(c.sql, { maxRows: 200 });
    const ch = buildChart(res, c.args, "c1");
    const shape = ch.heat ? `heatmap ${ch.heat.rows.length}×${ch.heat.cols.length}`
      : ch.map ? `carte ${ch.map.level} : ${ch.map.areas.length} territoires (${ch.map.areas.filter((a) => a.code).length} avec code)`
      : ch.tiles ? `${ch.tiles.length} tuiles (${ch.tiles.map((t) => `${t.label} = ${t.value}`).join(" ; ")})`
      : ch.facets ? `${ch.facets.length} panneaux (${ch.facets.map((f) => `${f.label}:${f.data.length}`).join(", ")})`
      : `${ch.data.length} lignes (${ch.data.slice(0, 4).map((d) => `${d.label}: ${ch.series.map((s) => d[s.key]).map((v) => typeof v === "number" ? Math.round(v * 10) / 10 : v).join("/")}`).join(" ; ")}${ch.data.length > 4 ? " ; …" : ""})`;
    console.log(`${expectError ? "✗" : "✓"} ${c.name}\n    ${shape} · séries : ${ch.series.map((s) => s.label).join(" | ")} · ${chartSize(ch)} points${ch.note ? ` · note : ${ch.note}` : ""}`);
    if (expectError) failures++;
  } catch (e) {
    console.log(`${expectError ? "✓" : "✗"} ${c.name}\n    ${(e as Error).message}`);
    if (!expectError) failures++;
  }
}
console.log(failures ? `\n${failures} échec(s)` : "\nTous les graphiques sont conformes.");
process.exit(failures ? 1 : 0);