// Test des graphiques de l'agent sur de vraies requêtes DuckDB (aucun appel au modèle).
// Mêmes exemples que la galerie /assistant/graphiques, plus un cas d'erreur attendu.
// Usage : npm run test:charts
const { runQuery } = await import("../src/lib/agent/db");
const { buildChart, chartSize } = await import("../src/lib/agent/charts");
const { CHART_EXAMPLES } = await import("../src/lib/agent/chart-examples");

const cases = [
  ...CHART_EXAMPLES,
  {
    name: "Erreur attendue : heatmap sans color_by",
    sql: "SELECT session, count(*) AS n FROM formations GROUP BY 1",
    args: { type: "heatmap", x: "session", y: ["n"], unit: "count", title: "t" },
  },
];

let failures = 0;
for (const c of cases) {
  const res = await runQuery(c.sql, { maxRows: 200 });
  const expectError = c.name.startsWith("Erreur attendue");
  try {
    const ch = buildChart(res, c.args, "c1");
    const shape = ch.heat ? `heatmap ${ch.heat.rows.length}×${ch.heat.cols.length}` : ch.facets ? `${ch.facets.length} panneaux (${ch.facets.map((f) => `${f.label}:${f.data.length}`).join(", ")})` : `${ch.data.length} lignes`;
    console.log(`${expectError ? "✗" : "✓"} ${c.name}\n    ${shape} · séries : ${ch.series.map((s) => s.label).join(" | ")} · ${chartSize(ch)} points${ch.note ? ` · note : ${ch.note}` : ""}`);
    if (expectError) failures++;
  } catch (e) {
    console.log(`${expectError ? "✓" : "✗"} ${c.name}\n    ${(e as Error).message}`);
    if (!expectError) failures++;
  }
}
console.log(failures ? `\n${failures} échec(s)` : "\nTous les graphiques sont conformes.");
process.exit(failures ? 1 : 0);