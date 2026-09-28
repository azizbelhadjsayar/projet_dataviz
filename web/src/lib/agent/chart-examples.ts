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
{
    name: "Combiné sur des catégories (combo, disposition horizontale)",
    question: "Montre les 10 écoles d'ingénieurs les plus demandées de 2021 à 2025 avec leur taux d'accès moyen.",
    sql: `SELECT etablissement, sum(voeux_pp) AS voeux_pp, ${TAUX} AS taux_acces_moyen
FROM formations WHERE type_formation = 'École d''ingénieurs'
GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    args: {
      type: "combo", x: "etablissement", y: ["voeux_pp", "taux_acces_moyen"], unit: "count", unit2: "pct",
      series_labels: ["Vœux en phase principale", "Taux d'accès moyen"],
      title: "Demande et accès des 10 écoles d'ingénieurs les plus demandées",
      subtitle: "Total des vœux PP 2021-2025 (barres) et taux d'accès moyen pondéré (points) · une échelle par indicateur",
    },
  },
  {
    name: "Colonnes à libellés longs (inclinaison automatique)",
    question: "Combien de vœux par filière de licence en 2025 ?",
    sql: `SELECT filiere, sum(voeux_pp) AS voeux_pp FROM formations
WHERE session = 2025 AND type_formation = 'Licence' GROUP BY 1 ORDER BY 2 DESC`,
    args: {
      type: "column", x: "filiere", y: ["voeux_pp"], unit: "count", series_labels: ["Vœux en phase principale"],
      title: "Vœux par filière de licence",
      subtitle: "Vœux en phase principale · session 2025",
    },
  },
{
    name: "Répartition en anneau (pie)",
    question: "Fais un graphique en cercle de la répartition du total des vœux par type de formation sur les 5 sessions.",
    sql: `SELECT type_formation, sum(voeux_pp) AS voeux_pp FROM formations GROUP BY 1`,
    args: {
      type: "pie", x: "type_formation", y: ["voeux_pp"], unit: "count", series_labels: ["Vœux PP 2021-2025"],
      title: "Répartition des vœux par type de formation",
      subtitle: "Total des vœux en phase principale, sessions 2021 à 2025",
    },
  },
  {
    name: "Barre de répartition unique (stacked_bar_100, format large)",
    question: "Quelle est la répartition des admis néo-bacheliers 2025 par série de bac ?",
    sql: `SELECT 'Admis 2025' AS perimetre, sum(admis_bac_general) AS general, sum(admis_bac_techno) AS techno,
       sum(admis_bac_pro) AS pro
FROM formations WHERE session = 2025`,
    args: {
      type: "stacked_bar_100", x: "perimetre", y: ["general", "techno", "pro"], unit: "count",
      series_labels: ["Bac général", "Bac technologique", "Bac professionnel"],
      title: "Deux admis néo-bacheliers sur trois viennent d'un bac général",
      subtitle: "Répartition des admis néo-bacheliers par série de bac · session 2025",
    },
  },
  {
    name: "Barres à 100 % par catégorie (stacked_bar_100)",
    question: "Compare la répartition des mentions au bac des admis selon le type de formation en 2025.",
    sql: `SELECT type_formation, sum(admis_sans_mention) AS sans_mention, sum(admis_mention_ab) AS assez_bien,
       sum(admis_mention_b) AS bien, sum(coalesce(admis_mention_tb, 0) + coalesce(admis_mention_tbf, 0)) AS tres_bien
FROM formations WHERE session = 2025 GROUP BY 1 ORDER BY sum(admis_neobac) DESC LIMIT 8`,
    args: {
      type: "stacked_bar_100", x: "type_formation", y: ["sans_mention", "assez_bien", "bien", "tres_bien"], unit: "count",
      series_labels: ["Sans mention", "Assez bien", "Bien", "Très bien (et félicitations)"],
      title: "Mentions au bac des admis : les CPGE recrutent surtout des mentions très bien",
      subtitle: "Répartition des admis néo-bacheliers par mention · 8 types de formation les plus importants · 2025",
    },
  },
  {
    name: "Colonnes à 100 % dans le temps (stacked_column_100 + color_by)",
    question: "Comment évolue la part du privé dans les vœux depuis 2021 ?",
    sql: `SELECT session, secteur, sum(voeux_pp) AS voeux_pp FROM formations GROUP BY 1, 2`,
    args: {
      type: "stacked_column_100", x: "session", y: ["voeux_pp"], color_by: "secteur", unit: "count",
      title: "Part des vœux adressés au public et au privé",
      subtitle: "Répartition des vœux en phase principale par secteur · 2021-2025",
    },
  },
  {
    name: "Aires empilées (area + color_by)",
    question: "Montre l'évolution du volume de vœux et sa composition par type de formation.",
    sql: `SELECT session, type_formation, sum(voeux_pp) AS voeux_pp FROM formations GROUP BY 1, 2`,
    args: {
      type: "area", x: "session", y: ["voeux_pp"], color_by: "type_formation", unit: "count",
      title: "Volume de vœux et composition par type de formation",
      subtitle: "Vœux en phase principale, aires empilées · 2021-2025",
    },
  },
  {
    name: "Treemap à deux niveaux (treemap + color_by)",
    question: "Fais un treemap des filières les plus demandées en 2025, regroupées par type de formation.",
    sql: `SELECT type_formation, filiere, sum(voeux_pp) AS voeux_pp FROM formations
WHERE session = 2025 GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 40`,
    args: {
      type: "treemap", x: "filiere", y: ["voeux_pp"], color_by: "type_formation", unit: "count", series_labels: ["Vœux PP 2025"],
      title: "Les 40 filières les plus demandées, par type de formation",
      subtitle: "Vœux en phase principale · session 2025 · surface proportionnelle aux vœux",
    },
  },
  {
    name: "Carte des départements (map)",
    question: "Montre sur une carte la pression (vœux par place) par département en 2025.",
    sql: `SELECT code_departement, departement, round(sum(voeux_pp) / sum(capacite), 1) AS voeux_par_place
FROM formations WHERE session = 2025 GROUP BY 1, 2`,
    args: {
      type: "map", x: "code_departement", y: ["voeux_par_place"], unit: "ratio", series_labels: ["Vœux par place"],
      title: "Pression de la demande par département",
      subtitle: "Vœux en phase principale par place · session 2025 · classes de quantiles",
    },
  },
  {
    name: "Cascade (waterfall)",
    question: "D'où vient la variation du nombre de vœux entre 2021 et 2025 ? Décompose par type de formation.",
    sql: `WITH t AS (
  SELECT type_formation, sum(voeux_pp) FILTER (WHERE session = 2021) AS v2021, sum(voeux_pp) FILTER (WHERE session = 2025) AS v2025
  FROM formations GROUP BY 1)
SELECT etape, voeux_pp FROM (
  SELECT '2021' AS etape, sum(v2021) AS voeux_pp, 0 AS ordre FROM t
  UNION ALL
  SELECT type_formation, coalesce(v2025, 0) - coalesce(v2021, 0), 1 FROM t
) ORDER BY ordre, abs(voeux_pp) DESC`,
    args: {
      type: "waterfall", x: "etape", y: ["voeux_pp"], unit: "count", total_label: "2025", series_labels: ["Vœux PP"],
      title: "De 2021 à 2025 : la variation des vœux type par type",
      subtitle: "Vœux en phase principale · départ 2021, variation par type de formation, arrivée 2025",
    },
  },
  {
    name: "Haltères avant / après (dumbbell + color_by)",
    question: "Compare le taux d'accès moyen par type de formation entre 2022 et 2025.",
    sql: `SELECT session, type_formation, ${TAUX} AS taux_acces_moyen
FROM formations WHERE session IN (2022, 2025) GROUP BY 1, 2`,
    args: {
      type: "dumbbell", x: "type_formation", y: ["taux_acces_moyen"], color_by: "session", unit: "pct",
      title: "Taux d'accès 2022 et 2025 par type de formation",
      subtitle: "Taux d'accès moyen pondéré · 2022 (définition homogène) vs 2025",
    },
  },
  {
    name: "Entonnoir (funnel, format large)",
    question: "Du vœu à l'admission : montre l'entonnoir de la procédure 2025.",
    sql: `SELECT sum(voeux_total) AS voeux, sum(propositions_total) AS propositions, sum(admis_total) AS admis
FROM formations WHERE session = 2025`,
    args: {
      type: "funnel", y: ["voeux", "propositions", "admis"], unit: "count",
      series_labels: ["Vœux (toutes phases)", "Propositions d'admission", "Admis"],
      title: "Du vœu à l'admission en 2025",
      subtitle: "Vœux, propositions et admis, toutes formations · session 2025",
    },
  },
  {
    name: "Histogramme (histogram)",
    question: "Comment se distribuent les taux d'accès des formations en 2025 ?",
    sql: `SELECT least(floor(taux_acces / 5) * 5, 95) AS classe_taux_acces, count(*) AS formations
FROM formations WHERE session = 2025 AND taux_acces IS NOT NULL GROUP BY 1 ORDER BY 1`,
    args: {
      type: "histogram", x: "classe_taux_acces", y: ["formations"], unit: "count", series_labels: ["Formations"],
      title: "La plupart des formations ont un taux d'accès élevé",
      subtitle: "Nombre de formations par classe de taux d'accès (5 points) · session 2025",
    },
  },
  {
    name: "Chiffres clés avec évolution (kpi)",
    question: "Donne-moi les chiffres clés de 2025 et leur évolution.",
    sql: `SELECT session, count(*) AS formations, sum(capacite) AS places, sum(voeux_pp) AS voeux_pp, ${TAUX} AS taux_acces_moyen
FROM formations GROUP BY 1 ORDER BY 1`,
    args: {
      type: "kpi", x: "session", y: ["formations", "places", "voeux_pp", "taux_acces_moyen"], unit: "count",
      y_units: ["count", "count", "count", "pct"],
      series_labels: ["Formations", "Places", "Vœux PP", "Taux d'accès moyen"],
      title: "Parcoursup 2025 en quatre chiffres",
      subtitle: "Session 2025, variation par rapport à 2024 · mini-courbe 2021-2025",
    },
  },
  {
    name: "Bulles (bubble)",
    question: "Par académie, croise la pression, le taux d'accès et le volume de vœux en 2025.",
    sql: `SELECT academie, round(sum(voeux_pp) / sum(capacite), 1) AS voeux_par_place, ${TAUX} AS taux_acces_moyen, sum(voeux_pp) AS voeux_pp
FROM formations WHERE session = 2025 AND zone <> 'Étranger'
GROUP BY 1 HAVING count(*) >= 20`,
    args: {
      type: "bubble", x: "voeux_par_place", y: ["taux_acces_moyen"], size: "voeux_pp", label_column: "academie", unit: "pct",
      series_labels: ["Taux d'accès moyen", "Vœux PP"],
      title: "Plus de pression, moins d'accès : les académies",
      subtitle: "Académies (≥ 20 formations) · pression (x), taux d'accès (y), vœux (taille des bulles) · 2025",
    },
  },
];
