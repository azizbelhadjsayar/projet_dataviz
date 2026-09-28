import "server-only";
import { runQuery, SqlError, type QueryResult } from "./db";
import { buildChart, chartSize, outOfRangePct } from "./charts";
import { CHART_TYPES, type AgentEvent } from "./types";

// Outils de l'agent : exécution SQL libre (lecture seule) et création de graphiques.
// Les schémas restent simples (sous-ensemble JSON Schema accepté par Gemini).

export const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "run_sql",
      description:
        "Exécute UNE requête SQL SELECT (dialecte DuckDB) sur la table formations. Renvoie un result_id, les colonnes et jusqu'à 40 lignes (200 conservées pour les graphiques).",
      parameters: {
        type: "object",
        properties: {
          purpose: { type: "string", description: "Ce que vérifie cette requête, en une phrase courte (affichée à l'utilisateur)." },
          sql: { type: "string", description: "Requête SELECT ou WITH … SELECT, une seule instruction." },
        },
        required: ["purpose", "sql"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_chart",
      description: "Affiche un graphique à partir d'un résultat run_sql (result_id). Données au format long (color_by, facet_by) ou large (plusieurs colonnes y) acceptées.",
      parameters: {
        type: "object",
        properties: {
          result_id: { type: "string", description: "Identifiant renvoyé par run_sql, ex. r2" },
          type: { type: "string", enum: CHART_TYPES },
          title: { type: "string", description: "Message principal du graphique" },
          subtitle: { type: "string", description: "Périmètre : session, filtres, unité" },
          x: { type: "string", description: "Catégories / axe horizontal (scatter, bubble : indicateur numérique ; heatmap : colonnes ; map : region, departement ou code_departement ; histogram : borne basse des classes). Facultatif pour kpi et en format large" },
          y: { type: "array", items: { type: "string" }, description: "Indicateurs numériques : 1 à 4 de même unité ; combo, dumbbell : 2 ; format large (pie, treemap, funnel, kpi, *_100) : une colonne par part / étape / indicateur" },
          color_by: { type: "string", description: "3e dimension : une série par valeur de cette colonne (≤ 4 ; ≤ 6 pour *_100) ; heatmap : colonne des lignes ; treemap : groupe ; dumbbell : les 2 valeurs comparées (ex. session)" },
          facet_by: { type: "string", description: "Petits multiples : un panneau par valeur (ex. session), en-têtes en haut, même échelle" },
          series_labels: { type: "array", items: { type: "string" }, description: "Libellés lisibles des séries, dans l'ordre de y" },
          unit: { type: "string", enum: ["count", "pct", "ratio"] },
          unit2: { type: "string", enum: ["count", "pct", "ratio"], description: "combo : unité du 2e indicateur" },
          y_units: { type: "array", items: { type: "string", enum: ["count", "pct", "ratio"] }, description: "kpi : unité de chaque indicateur, dans l'ordre de y" },
          label_column: { type: "string", description: "scatter, bubble : colonne qui nomme chaque point" },
          size: { type: "string", description: "bubble : colonne numérique de la taille des bulles (ex. voeux_pp)" },
          total_label: { type: "string", description: "waterfall : libellé de la barre d'arrivée (ex. 2025)" },
        },
        required: ["result_id", "type", "title", "y", "unit"],
      },
    },
  },
];

const MODEL_ROWS = 40;

/** État d'une requête d'agent : résultats conservés pour les graphiques. */
export class AgentSession {
  private results = new Map<string, QueryResult>();
  private n = 0;
  private charts = 0;
  queries: string[] = [];

  async runSql(args: Record<string, unknown>, emit: (e: AgentEvent) => void) {
    const id = `r${++this.n}`;
    const sql = String(args.sql ?? "");
    const purpose = String(args.purpose ?? "Requête");
    emit({ type: "sql", id, purpose, sql });
    try {
      const res = await runQuery(sql, { maxRows: 200 });
      this.results.set(id, res);
      this.queries.push(sql);
      emit({ type: "sql_result", id, columns: res.columns, rows: res.rows, truncated: res.truncated, ms: res.ms });
      const rows = res.rows.slice(0, MODEL_ROWS).map((r) =>
        r.map((v) => (typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 100) / 100 : typeof v === "string" && v.length > 90 ? `${v.slice(0, 90)}…` : v)));
      // Avertissement immédiat si un taux / une part dépasse 100 (typiquement taux_acces × 100 en trop).
      const scale = outOfRangePct(res.columns, res.rows);
      return {
        result_id: id,
        columns: res.columns,
        rows,
        ...(scale.length ? {
          warning: `ÉCHELLE ANORMALE : ${scale.map((s) => `${s.column} atteint ${Math.round(s.max)}`).join(", ")} alors qu'un taux / une part doit être entre 0 et 100. taux_acces est DÉJÀ en % : retire le « 100 * » et relance run_sql avant de conclure ou de tracer.`,
        } : {}),
        row_count: res.truncated ? `plus de ${res.rows.length}` : res.rows.length,
        ...(res.rows.length > MODEL_ROWS ? { note: `Seules les ${MODEL_ROWS} premières lignes sont montrées ici (${res.rows.length} disponibles pour un graphique).` } : {}),
        ...(res.rows.length === 0 ? { note: "Aucune ligne : vérifie les filtres (valeurs exactes, accents, casse)." } : {}),
      };
    } catch (e) {
      const error = e instanceof SqlError ? e.message : `Erreur : ${(e as Error).message}`;
      emit({ type: "sql_error", id, error });
      return { result_id: id, error, hint: "Corrige la requête et relance run_sql." };
    }
  }

  createChart(args: Record<string, unknown>, emit: (e: AgentEvent) => void) {
    try {
      const chart = this.buildChart(args);
      emit({ type: "chart", chart });
      return { ok: true, chart_id: chart.id, points: chartSize(chart), ...(chart.note ? { note: chart.note } : {}) };
    } catch (e) {
      const error = (e as Error).message;
      emit({ type: "chart_error", error });
      return { ok: false, error };
    }
  }

  private buildChart(args: Record<string, unknown>) {
    const res = this.results.get(String(args.result_id));
    if (!res) throw new Error(`result_id inconnu : ${args.result_id}. Utilise l'identifiant renvoyé par run_sql.`);
    if (this.charts >= 3) throw new Error("3 graphiques maximum par réponse.");
    const chart = buildChart(res, args, `c${this.charts + 1}`);
    this.charts++;
    return chart;
  }
}