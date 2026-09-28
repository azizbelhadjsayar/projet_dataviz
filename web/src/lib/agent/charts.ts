// Construction des graphiques de l'agent à partir d'un résultat SQL (module pur, testable).
//
// Dimensions disponibles, comme dans Tableau / Power BI :
//   x         catégories ou axe horizontal
//   y         1 à 4 indicateurs (2 exactement pour « combo »)
//   color_by  3e dimension : une série par valeur d'une colonne catégorielle (≤ 4, ≤ 3 en nuage de points)
//   facet_by  petits multiples : un panneau par valeur (≤ 6), en-têtes en haut, échelle commune
// Règles de lisibilité (skill dataviz) : pas de 5e couleur (repli « Autres » ou séries principales),
// pas de double échelle superposée (« combo » = deux panneaux alignés sur le même axe X).

import { CHART_TYPES, type ChartPayload, type ChartRow, type ChartType, type ChartUnit } from "./types";

type Cell = string | number | boolean | null;
export interface ChartSource {
  columns: string[];
  rows: Cell[][];
}

const UNITS: ChartUnit[] = ["count", "pct", "ratio"];
const MAX_SERIES = 4;
const MAX_SCATTER_GROUPS = 3;
const MAX_FACETS = 6;
/** Ordre fixe des valeurs des dimensions usuelles : même couleur pour la même entité dans tous les graphiques. */
const CANONICAL = [
  ["Public", "Privé"],
  ["Sélective", "Non sélective"],
  ["Métropole", "Outre-mer", "Étranger"],
];

/**
 * Colonnes de taux / parts (bornées à 0-100) — hors évolutions (« +150 % » est légitime).
 * Sert à détecter l'erreur classique « taux_acces × 100 » (taux_acces est déjà en %).
 */
const BOUNDED_PCT = /taux|part|pct|pourcent|proportion|ratio_admis|share/i;
const GROWTH = /evol|variation|croissance|delta|diff|hausse|baisse|progression|ecart|gain|perte/i;
export function outOfRangePct(columns: string[], rows: (string | number | boolean | null)[][]) {
  const issues: { column: string; max: number }[] = [];
  columns.forEach((c, i) => {
    if (!BOUNDED_PCT.test(c) || GROWTH.test(c)) return;
    const vals = rows.map((r) => r[i]).filter((v): v is number => typeof v === "number");
    const max = vals.length ? Math.max(...vals) : 0;
    if (max > 100.5) issues.push({ column: c, max });
  });
  return issues;
}

/** Libellé lisible d'une colonne quand le modèle n'en fournit pas : taux_acces_moyen → « Taux d'accès moyen ». */
const WORDS: Record<string, string> = {
  taux: "taux", acces: "d'accès", voeux: "vœux", pp: "(PP)", pc: "(PC)", nb: "nombre de", moy: "moyen", pct: "%",
  part: "part", admis: "admis", capacite: "places", boursiers: "boursiers", filles: "filles", selectives: "sélectives",
  remplissage: "de remplissage", par: "par", place: "place", neobac: "néo-bacheliers", tb: "TB", academie: "académie",
};
export function humanize(col: string) {
  const s = col.split("_").filter(Boolean).map((w) => WORDS[w.toLowerCase()] ?? w).join(" ").replace(/\s+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : col;
}

const num = (v: unknown) => (typeof v === "number" ? v : v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown) => (v === null || v === undefined ? "Non renseigné" : String(v));
const isNumericList = (vals: string[]) => vals.every((v) => v !== "" && Number.isFinite(Number(v)));
/** Valeurs distinctes dans l'ordre d'apparition, triées numériquement si ce sont des nombres (ex. sessions). */
function distinct(values: string[]) {
  const out = [...new Set(values)];
  return isNumericList(out) ? out.sort((a, b) => Number(a) - Number(b)) : out;
}

export function buildChart(src: ChartSource, args: Record<string, unknown>, id: string): ChartPayload {
  const type = String(args.type) as ChartType;
  if (!CHART_TYPES.includes(type)) throw new Error(`type invalide : ${args.type}. Types : ${CHART_TYPES.join(", ")}`);
  const unit = (UNITS.includes(args.unit as ChartUnit) ? args.unit : "count") as ChartUnit;
  const col = (name: unknown, role: string) => {
    const i = src.columns.indexOf(String(name));
    if (i < 0) throw new Error(`${role} : colonne « ${name} » absente du résultat. Colonnes : ${src.columns.join(", ")}`);
    return i;
  };
  const opt = (name: unknown, role: string) => (name === undefined || name === null || name === "" ? -1 : col(name, role));

  const xi = col(args.x, "x");
  let ys = (Array.isArray(args.y) ? args.y : [args.y]).filter(Boolean).slice(0, 4).map((y) => col(y, "y"));
  if (!ys.length) throw new Error("y doit contenir au moins une colonne numérique.");
  const ci = opt(args.color_by, "color_by");
  const fi = opt(args.facet_by, "facet_by");
  const li = type === "scatter" ? opt(args.label_column, "label_column") : -1;
  const labels = Array.isArray(args.series_labels) ? args.series_labels.map(String) : [];
  const notes: string[] = [];
  // Garde-fou : un pourcentage de taux / part au-delà de 100 trahit un « × 100 » en trop dans la requête.
  if (unit === "pct") {
    const bad = outOfRangePct(ys.map((i) => src.columns[i]), src.rows.map((r) => ys.map((i) => r[i])));
    if (bad.length) {
      throw new Error(`unit=pct mais « ${bad[0].column} » atteint ${Math.round(bad[0].max)} : un taux ou une part doit être entre 0 et 100. `
        + "taux_acces est DÉJÀ en % (ne pas multiplier par 100). Corrige la requête avec run_sql, puis relance create_chart.");
    }
  }
  const base = { id, type, title: String(args.title ?? ""), subtitle: args.subtitle ? String(args.subtitle) : undefined, unit, xLabel: humanize(String(args.x)) };
  const rows = src.rows;

  // ── Carte de chaleur : lignes = color_by, colonnes = x, valeur = y[0] ──
  if (type === "heatmap") {
    if (ci < 0) throw new Error("heatmap : précise color_by (colonne des lignes) ; x = colonne des colonnes, y = [valeur].");
    let rowVals = [...new Set(rows.map((r) => str(r[ci])))];
    let colVals = distinct(rows.map((r) => str(r[xi])));
    if (rowVals.length > 30) { notes.push(`30 premières lignes sur ${rowVals.length}.`); rowVals = rowVals.slice(0, 30); }
    if (colVals.length > 15) { notes.push(`15 premières colonnes sur ${colVals.length}.`); colVals = colVals.slice(0, 15); }
    const values = rowVals.map(() => colVals.map(() => null as number | null));
    for (const r of rows) {
      const ri = rowVals.indexOf(str(r[ci])), cj = colVals.indexOf(str(r[xi]));
      if (ri >= 0 && cj >= 0) values[ri][cj] = num(r[ys[0]]);
    }
    if (values.every((line) => line.every((v) => v === null))) throw new Error("heatmap : aucune valeur numérique dans y.");
    return {
      ...base, series: [{ key: "y0", label: labels[0] ?? humanize(src.columns[ys[0]]) }], data: [],
      heat: { rowLabel: String(args.color_by), colLabel: String(args.x), rows: rowVals, cols: colVals, values },
      note: notes.join(" ") || undefined,
    };
  }

  // ── Combiné : 2 indicateurs d'unités différentes, deux panneaux alignés sur le même X ──
  let unit2: ChartUnit | undefined;
  if (type === "combo") {
    if (ys.length < 2) throw new Error("combo : il faut exactement 2 colonnes dans y (barres puis courbe).");
    ys = ys.slice(0, 2);
    unit2 = (UNITS.includes(args.unit2 as ChartUnit) ? args.unit2 : unit) as ChartUnit;
    if (ci >= 0 || fi >= 0) notes.push("color_by / facet_by ignorés pour un graphique combiné.");
  }
  const useColor = ci >= 0 && type !== "combo";
  const useFacet = fi >= 0 && type !== "combo";

  // ── Séries : colonnes y, ou valeurs d'une colonne catégorielle (format long) ──
  let series: { key: string; label: string; match?: string }[];
  let fold: Set<string> | null = null; // valeurs regroupées dans « Autres »
  if (useColor) {
    if (ys.length > 1) notes.push("Avec color_by, seul le 1er indicateur de y est tracé.");
    ys = ys.slice(0, 1);
    const totals = new Map<string, number>();
    for (const r of rows) totals.set(str(r[ci]), (totals.get(str(r[ci])) ?? 0) + Math.abs(num(r[ys[0]]) ?? 0));
    // Ordre stable : canonique pour les dimensions connues (la couleur suit l'entité d'un graphique à l'autre),
    // numérique (ex. sessions), sinon par importance décroissante.
    let groups = [...totals.keys()];
    const canon = CANONICAL.find((order) => groups.every((g) => order.includes(g)));
    if (canon) groups.sort((a, b) => canon.indexOf(a) - canon.indexOf(b));
    else if (isNumericList(groups)) groups.sort((a, b) => Number(a) - Number(b));
    else groups.sort((a, b) => totals.get(b)! - totals.get(a)!);
    const max = type === "scatter" ? MAX_SCATTER_GROUPS : MAX_SERIES;
    if (groups.length > max) {
      const ranked = [...groups].sort((a, b) => (totals.get(b)! - totals.get(a)!));
      const additive = unit === "count" && type !== "line" && type !== "scatter";
      const keep = ranked.slice(0, additive ? max - 1 : max);
      groups = groups.filter((g) => keep.includes(g));
      if (additive) {
        fold = new Set(ranked.slice(max - 1));
        notes.push(`${fold.size} catégories regroupées dans « Autres ».`);
      } else {
        notes.push(`${max} catégories principales affichées sur ${ranked.length} (utilise facet_by pour toutes les voir).`);
      }
    }
    series = groups.map((g, k) => ({ key: `s${k}`, label: g, match: g }));
    if (fold) series.push({ key: `s${series.length}`, label: "Autres" });
  } else {
    series = ys.map((yi, k) => ({ key: `y${k}`, label: labels[k] ?? humanize(src.columns[yi]) }));
  }
  const seriesKeyOf = (value: string) =>
    series.find((s) => s.match === value)?.key ?? (fold?.has(value) ? series[series.length - 1].key : null);

  // ── Lignes normalisées pour un sous-ensemble (un panneau ou tout) ──
  const limit = type === "scatter" ? 500 : type === "line" ? 60 : useFacet ? 25 : 30;
  const build = (subset: Cell[][]): ChartRow[] => {
    if (type === "scatter") {
      return subset.slice(0, limit).map((r) => {
        const o: ChartRow = { label: li >= 0 ? str(r[li]) : str(r[xi]), x: num(r[xi]), y0: num(r[ys[0]]) };
        if (useColor) o.group = seriesKeyOf(str(r[ci]));
        return o;
      }).filter((o) => o.x !== null && o.y0 !== null && (!useColor || o.group));
    }
    const byX = new Map<string, ChartRow>();
    for (const r of subset) {
      const xv = r[xi];
      const key = str(xv);
      let o = byX.get(key);
      if (!o) {
        if (byX.size >= limit) continue;
        o = { label: key, x: typeof xv === "number" ? xv : key };
        byX.set(key, o);
      }
      if (useColor) {
        const k = seriesKeyOf(str(r[ci]));
        const v = num(r[ys[0]]);
        if (k && v !== null) o[k] = fold && k === series[series.length - 1].key ? ((o[k] as number | null) ?? 0) + v : v;
      } else {
        ys.forEach((yi, k) => { o![`y${k}`] = num(r[yi]); });
      }
    }
    const out = [...byX.values()];
    if ((type === "line" || type === "combo" || type === "column" || type === "stacked_column") && isNumericList(out.map((o) => String(o.x)))) {
      out.sort((a, b) => Number(a.x) - Number(b.x));
    }
    return out;
  };

  let data: ChartRow[] = [];
  let facets: ChartPayload["facets"];
  if (useFacet) {
    let values = distinct(rows.map((r) => str(r[fi])));
    if (values.length > MAX_FACETS) { notes.push(`${MAX_FACETS} premiers panneaux sur ${values.length}.`); values = values.slice(0, MAX_FACETS); }
    facets = values.map((v) => ({ label: v, data: build(rows.filter((r) => str(r[fi]) === v)) }));
  } else {
    data = build(rows);
    const categories = new Set(rows.map((r) => str(r[xi]))).size;
    if (type === "scatter" ? rows.length > limit : categories > limit) {
      notes.push(`Affichage limité aux ${limit} premiers ${type === "scatter" ? "points" : "éléments"} sur ${type === "scatter" ? rows.length : categories}.`);
    }
  }

  const all = facets ? facets.flatMap((f) => f.data) : data;
  const keys = type === "scatter" ? ["y0"] : series.map((s) => s.key);
  if (!all.some((d) => keys.some((k) => typeof d[k] === "number"))) {
    throw new Error("Les colonnes y ne contiennent pas de valeurs numériques exploitables.");
  }

  return {
    ...base,
    unit2,
    series: series.map(({ key, label }) => ({ key, label })),
    data,
    facetLabel: useFacet ? String(args.facet_by) : undefined,
    facets,
    note: notes.join(" ") || undefined,
  };
}

/** Nombre de points tracés (retour d'outil au modèle). */
export function chartSize(c: ChartPayload) {
  if (c.heat) return c.heat.rows.length * c.heat.cols.length;
  return c.facets ? c.facets.reduce((n, f) => n + f.data.length, 0) : c.data.length;
}
