// Exemples de graphiques de l'agent (galerie /assistant/graphiques et tests `npm run test:charts`).
// Chaque exemple = une requête SQL réelle + les paramètres que l'agent passerait à create_chart.

const TAUX = "round(sum(taux_acces*voeux_pp) FILTER (WHERE taux_acces IS NOT NULL) / sum(voeux_pp) FILTER (WHERE taux_acces IS NOT NULL), 1)";

export interface ChartExample {
  name: string;
  /** Question en langage naturel qui mènerait l'agent à ce graphique. */
  question: string;
  sql: string;
  args: Record<string, unknown>;
}

export const CHART_EXAMPLES: ChartExample[] = [
  {
    name: "Petits multiples par année (facet_by)",
    question: "Compare le taux d'accès moyen par type de formation pour les sessions 2023, 2024 et 2025.",
    sql: `SELECT session, type_formation, ${TAUX} AS taux_acces_moyen
FROM formations WHERE session >= 2023 GROUP BY 1, 2 ORDER BY 1, 3`,
    args: {
      type: "bar", x: "type_formation", y: ["taux_acces_moyen"], facet_by: "session", unit: "pct",
      series_labels: ["Taux d'accès moyen"],
      title: "Taux d'accès par type de formation, année par année",
      subtitle: "Taux d'accès moyen pondéré par type de formation · sessions 2023 à 2025",
    },
  },
  {
    name: "3e dimension + petits multiples (color_by + facet_by)",
    question: "Compare la pression (vœux par place) du public et du privé par type de formation, en 2021 et en 2025.",
    sql: `SELECT session, type_formation, secteur, round(sum(voeux_pp) / sum(capacite), 1) AS voeux_par_place
FROM formations WHERE session IN (2021, 2025) GROUP BY ALL ORDER BY 1, 2`,
    args: {
      type: "bar", x: "type_formation", y: ["voeux_par_place"], color_by: "secteur", facet_by: "session", unit: "ratio",
      title: "Pression de la demande : public et privé, 2021 et 2025",
      subtitle: "Vœux en phase principale par place, par type de formation et secteur · 2021 vs 2025",
    },
  },
  {
    name: "Évolution par catégorie (line + color_by)",
    question: "Comment le taux d'accès a-t-il évolué depuis 2021 dans le public et dans le privé ?",
    sql: `SELECT session, secteur, ${TAUX} AS taux_acces_moyen FROM formations GROUP BY 1, 2 ORDER BY 1, 2`,
    args: {
      type: "line", x: "session", y: ["taux_acces_moyen"], color_by: "secteur", unit: "pct",
      title: "Taux d'accès moyen du public et du privé depuis 2021",
      subtitle: "Taux d'accès moyen pondéré par secteur · 2021-2025 (définition 2021 différente)",
    },
  },
  {
    name: "Graphique combiné, deux unités (combo)",
    question: "Montre l'évolution des vœux et du taux d'accès moyen depuis 2021.",
    sql: `SELECT session, sum(voeux_pp) AS voeux_pp, ${TAUX} AS taux_acces_moyen FROM formations GROUP BY 1 ORDER BY 1`,
    args: {
      type: "combo", x: "session", y: ["voeux_pp", "taux_acces_moyen"], unit: "count", unit2: "pct",
      series_labels: ["Vœux en phase principale", "Taux d'accès moyen"],
      title: "Plus de vœux en 2025, un accès plus difficile",
      subtitle: "Vœux (effectif, en haut) et taux d'accès moyen (%, en bas) · 2021-2025",
    },
  },
  {
    name: "Carte de chaleur (heatmap)",
    question: "Fais une carte de chaleur de la pression (vœux par place) par région et par session.",
    sql: `SELECT region, session, round(sum(voeux_pp) / sum(capacite), 1) AS voeux_par_place
FROM formations WHERE zone = 'Métropole' GROUP BY 1, 2 ORDER BY 1, 2`,
    args: {
      type: "heatmap", x: "session", color_by: "region", y: ["voeux_par_place"], unit: "ratio",
      series_labels: ["Vœux par place"],
      title: "Pression de la demande par région et par session",
      subtitle: "Vœux en phase principale par place · régions métropolitaines × session",
    },
  },
  {
    name: "Colonnes empilées + repli « Autres » (stacked_column + color_by)",
    question: "Comment se répartissent les vœux entre types de formation depuis 2021 ?",
    sql: `SELECT session, type_formation, sum(voeux_pp) AS voeux_pp FROM formations GROUP BY 1, 2`,
    args: {
      type: "stacked_column", x: "session", y: ["voeux_pp"], color_by: "type_formation", unit: "count",
      title: "Répartition des vœux par type de formation",
      subtitle: "Vœux en phase principale par type de formation · 2021-2025",
    },
  },
  {
    name: "Nuage de points coloré (scatter + color_by)",
    question: "Y a-t-il un lien entre la pression et le taux d'accès selon les filières, public et privé séparés ?",
    sql: `SELECT filiere, secteur, round(sum(voeux_pp) / sum(capacite), 1) AS voeux_par_place, ${TAUX} AS taux_acces_moyen
FROM formations WHERE session = 2025 GROUP BY 1, 2 HAVING count(*) >= 10`,
    args: {
      type: "scatter", x: "voeux_par_place", y: ["taux_acces_moyen"], color_by: "secteur", label_column: "filiere", unit: "pct",
      title: "Pression et accessibilité des filières, public et privé",
      subtitle: "Filières (≥ 10 formations) · vœux par place (x) et taux d'accès moyen (y) · 2025",
    },
  },
];
