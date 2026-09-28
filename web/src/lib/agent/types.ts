// Types partagés serveur / client pour l'agent.

export type ChartUnit = "count" | "pct" | "ratio";
export type ChartType = "bar" | "stacked_bar" | "column" | "stacked_column" | "line" | "scatter" | "combo" | "heatmap" | "pie";
export const CHART_TYPES: ChartType[] = ["bar", "stacked_bar", "column", "stacked_column", "line", "scatter", "combo", "heatmap", "pie"];

export type ChartRow = Record<string, string | number | null>;

export interface ChartPayload {
  id: string;
  type: ChartType;
  title: string;
  subtitle?: string;
  /** Unité de l'indicateur principal (et de toutes les séries, sauf la 2e d'un « combo »). */
  unit: ChartUnit;
  /** Unité du 2e indicateur d'un graphique combiné (panneau du bas). */
  unit2?: ChartUnit;
  /** Libellé de l'axe X (scatter : indicateur X ; autres : colonne des catégories). */
  xLabel: string;
  /** Séries tracées : colonnes y (clés y0…) ou valeurs d'une colonne catégorielle (clés s0…). */
  series: { key: string; label: string }[];
  /** Lignes normalisées : label (catégorie / point), x (valeur X), puis une valeur par clé de série. */
  data: ChartRow[];
  /** Petits multiples : un panneau par valeur de la colonne de séparation (en-têtes en haut). */
  facetLabel?: string;
  facets?: { label: string; data: ChartRow[] }[];
  /** Carte de chaleur : tableau croisé lignes × colonnes. */
  heat?: { rowLabel: string; colLabel: string; rows: string[]; cols: string[]; values: (number | null)[][] };
  note?: string;
}

/** Événements NDJSON envoyés par /api/agent. */
export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "sql"; id: string; purpose: string; sql: string }
  | { type: "sql_result"; id: string; columns: string[]; rows: (string | number | boolean | null)[][]; truncated: boolean; ms: number }
  | { type: "sql_error"; id: string; error: string }
  | { type: "chart"; chart: ChartPayload }
  | { type: "chart_error"; error: string }
  | { type: "done"; model: string; provider?: string; steps: number }
  | { type: "error"; message: string };
