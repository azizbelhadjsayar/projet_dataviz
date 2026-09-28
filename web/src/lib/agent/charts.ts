// Construction des graphiques de l'agent à partir d'un résultat SQL (module pur, testable).
//
// Dimensions disponibles, comme dans Tableau / Power BI :
//   x         catégories ou axe horizontal (facultatif en format large et pour les indicateurs clés)
//   y         1 à 4 indicateurs (2 pour « combo » et « dumbbell ») ; format large : une colonne par part / étape (≤ 8)
//   color_by  3e dimension : une série par valeur d'une colonne catégorielle
//             (≤ 4 ; ≤ 6 pour les parts d'un tout ; ≤ 3 en nuage de points ; groupes d'un treemap)
//   facet_by  petits multiples : un panneau par valeur (≤ 6), en-têtes en haut, échelle commune
//   size      bulles : indicateur de taille
// Règles de lisibilité (skill dataviz) : couleurs dans un ordre fixe, jamais recyclées (repli « Autres »),
// pas de double échelle superposée (« combo » = deux panneaux alignés sur le même axe X).

import { CHART_TYPES, type ChartPayload, type ChartRow, type ChartType, type ChartUnit, type KpiTile } from "./types";

type Cell = string | number | boolean | null;
export interface ChartSource {
  columns: string[];
  rows: Cell[][];
}

const UNITS: ChartUnit[] = ["count", "pct", "ratio"];
const MAX_SERIES = 4;
/** Parts d'un tout : 6 couleurs validées (au-delà, 5 parts + « Autres »). */
const MAX_PARTS = 6;
const MAX_SCATTER_GROUPS = 3;
const MAX_FACETS = 6;
/** Barres empilées à 100 % : les valeurs sont converties en parts de chaque barre. */
const PART_TYPES: ChartType[] = ["stacked_bar_100", "stacked_column_100"];
/** Format large accepté : une seule ligne, une colonne y par part / étape / indicateur. */
const WIDE_TYPES: ChartType[] = ["pie", "treemap", "funnel", "kpi"];
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

/** Nom de territoire comparable : sans accents, casse ni ponctuation. */
export const normName = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Codes INSEE des régions (contours de la carte ; outre-mer en encarts). */
const REGION_CODES: Record<string, string> = {
  "ile de france": "11", "centre val de loire": "24", "bourgogne franche comte": "27", normandie: "28", "hauts de france": "32",
  "grand est": "44", "pays de la loire": "52", bretagne: "53", "nouvelle aquitaine": "75", occitanie: "76",
  "auvergne rhone alpes": "84", "provence alpes cote d azur": "93", corse: "94",
  guadeloupe: "01", martinique: "02", guyane: "03", "la reunion": "04", mayotte: "06",
};
/** Départements dessinés sur la carte (métropole + 5 DROM). */
const DEP_ON_MAP = /^(0[1-9]|1\d|2[1-9AB]|[3-8]\d|9[0-5]|97[12346])$/;

const num = (v: unknown) => (typeof v === "number" ? v : v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown) => (v === null || v === undefined ? "Non renseigné" : String(v));
const isNumericList = (vals: string[]) => vals.every((v) => v !== "" && Number.isFinite(Number(v)));
/** Valeurs distinctes dans l'ordre d'apparition, triées numériquement si ce sont des nombres (ex. sessions). */
function distinct(values: string[]) {
  const out = [...new Set(values)];
  return isNumericList(out) ? out.sort((a, b) => Number(a) - Number(b)) : out;
}
/** Déjà trié (croissant ou décroissant) : on respecte alors l'ordre de la requête. */
const monotone = (vals: number[]) =>
  vals.every((v, i) => i === 0 || v <= vals[i - 1]) || vals.every((v, i) => i === 0 || v >= vals[i - 1]);
const numOr = (v: unknown, fallback: number) => (typeof v === "number" ? v : fallback);

export function buildChart(src: ChartSource, args: Record<string, unknown>, id: string): ChartPayload {
  const type = String(args.type) as ChartType;
  if (!CHART_TYPES.includes(type)) throw new Error(`type invalide : ${args.type}. Types : ${CHART_TYPES.join(", ")}`);
  const unit = (UNITS.includes(args.unit as ChartUnit) ? args.unit : "count") as ChartUnit;
  const col = (name: unknown, role: string) => {
    const i = src.columns.indexOf(String(name));
    if (i < 0) throw new Error(`${role} : colonne « ${name ?? ""} » absente du résultat. Colonnes : ${src.columns.join(", ")}`);
    return i;
  };
  const opt = (name: unknown, role: string) => (name === undefined || name === null || name === "" ? -1 : col(name, role));
  const part = PART_TYPES.includes(type);
  const scatterLike = type === "scatter" || type === "bubble";

  const maxY = part ? MAX_PARTS : WIDE_TYPES.includes(type) ? 8 : 4;
  let ys = (Array.isArray(args.y) ? args.y : [args.y]).filter(Boolean).slice(0, maxY).map((y) => col(y, "y"));
  if (!ys.length) throw new Error("y doit contenir au moins une colonne numérique.");
  const wide = WIDE_TYPES.includes(type) && ys.length > 1;
  // x facultatif en format large (une part par colonne y) et pour les indicateurs clés.
  const xOptional = wide || type === "kpi";
  const xi = xOptional && !src.columns.includes(String(args.x)) ? -1 : col(args.x, "x");
  const ci = opt(args.color_by, "color_by");
  const fi = opt(args.facet_by, "facet_by");
  const li = scatterLike ? opt(args.label_column, "label_column") : -1;
  const zi = type === "bubble" ? col(args.size, "size (indicateur de taille des bulles)") : -1;
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
  const base = {
    id, type, title: String(args.title ?? ""), subtitle: args.subtitle ? String(args.subtitle) : undefined, unit,
    xLabel: xi >= 0 ? humanize(src.columns[xi]) : "",
  };
  const rows = src.rows;
  const yLabel = (k = 0) => labels[k] ?? humanize(src.columns[ys[k]]);
  const finish = <T extends object>(o: T) => ({ ...o, note: notes.join(" ") || undefined });
  const ignore = (what: string) => { if (ci >= 0 || fi >= 0) notes.push(`color_by / facet_by ignorés pour ${what}.`); };
  const negative = () => new Error(`${type} : valeurs négatives impossibles dans une répartition ; utilise bar ou waterfall.`);

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
    return finish({
      ...base, series: [{ key: "y0", label: yLabel() }], data: [],
      heat: { rowLabel: String(args.color_by), colLabel: String(args.x), rows: rowVals, cols: colVals, values },
    });
  }

  /** Parts d'un total : format large (une part par colonne y, sommée sur les lignes) ou long (x → somme de y[0]). */
  const partsOf = (): [string, number][] => {
    const out = new Map<string, number>();
    const add = (k: string, v: number | null) => {
      if (v === null) return;
      if (v < 0) throw negative();
      out.set(k, (out.get(k) ?? 0) + v);
    };
    if (wide) ys.forEach((yi, k) => rows.forEach((r) => add(yLabel(k), num(r[yi]))));
    else rows.forEach((r) => add(str(r[xi]), num(r[ys[0]])));
    if (!out.size) throw new Error(`${type} : aucune valeur numérique dans y.`);
    return [...out.entries()];
  };
  const measure = wide ? "Total" : yLabel();
  /** Au-delà de `max` parts : les plus grandes + « Autres » (liste des catégories regroupées en note). */
  const foldParts = (parts: [string, number][], max: number) => {
    if (parts.length <= max) return parts;
    const rest = parts.slice(max - 1);
    notes.push(`${rest.length} catégories regroupées dans « Autres » (${rest.map(([k]) => k).join(", ")}).`);
    return [...parts.slice(0, max - 1), ["Autres", rest.reduce((a, [, v]) => a + v, 0)] as [string, number]];
  };

  // ── Anneau (répartition d'un total) : 6 parts max, les plus petites regroupées dans « Autres » ──
  if (type === "pie") {
    const parts = foldParts(partsOf().sort((a, b) => b[1] - a[1]), MAX_PARTS);
    ignore("un graphique en anneau");
    return finish({ ...base, series: [{ key: "y0", label: measure }], data: parts.map(([label, v]) => ({ label, x: label, y0: v })) });
  }

  // ── Treemap : parts d'un total avec beaucoup de catégories, ou deux niveaux (color_by = groupe, x = élément) ──
  if (type === "treemap") {
    const MAX_TILES = 40;
    if (ci >= 0 && !wide) {
      const items = new Map<string, { group: string; label: string; v: number }>();
      for (const r of rows) {
        const v = num(r[ys[0]]);
        if (v === null) continue;
        if (v < 0) throw negative();
        const key = `${str(r[ci])}\u0000${str(r[xi])}`;
        const it = items.get(key) ?? { group: str(r[ci]), label: str(r[xi]), v: 0 };
        it.v += v;
        items.set(key, it);
      }
      if (!items.size) throw new Error("treemap : aucune valeur numérique dans y.");
      const totals = new Map<string, number>();
      for (const it of items.values()) totals.set(it.group, (totals.get(it.group) ?? 0) + it.v);
      let groups = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
      let folded: Set<string> | null = null;
      if (groups.length > MAX_PARTS) {
        folded = new Set(groups.slice(MAX_PARTS - 1));
        groups = groups.slice(0, MAX_PARTS - 1);
        notes.push(`${folded.size} groupes regroupés dans « Autres » (${[...folded].join(", ")}).`);
      }
      const series = groups.map((g, k) => ({ key: `s${k}`, label: g }));
      if (folded) series.push({ key: `s${series.length}`, label: "Autres" });
      const keyOf = (g: string) => (folded?.has(g) ? series[series.length - 1].key : series[groups.indexOf(g)].key);
      // Au-delà de 40 tuiles, les plus petites sont réunies en une tuile « Autres » par groupe.
      const sorted = [...items.values()].sort((a, b) => b.v - a.v);
      const data: ChartRow[] = sorted.slice(0, MAX_TILES).map((it) => ({ label: it.label, y0: it.v, group: keyOf(it.group), parent: it.group }));
      const rest = new Map<string, number>();
      for (const it of sorted.slice(MAX_TILES)) rest.set(keyOf(it.group), (rest.get(keyOf(it.group)) ?? 0) + it.v);
      for (const [key, v] of rest) data.push({ label: "Autres", y0: v, group: key, parent: series.find((s) => s.key === key)!.label });
      if (rest.size) notes.push(`${sorted.length - MAX_TILES} petits éléments réunis en tuiles « Autres ».`);
      return finish({ ...base, series, data });
    }
    const parts = foldParts(partsOf().sort((a, b) => b[1] - a[1]), 30);
    if (fi >= 0) notes.push("facet_by ignoré pour un treemap.");
    return finish({ ...base, series: [{ key: "y0", label: measure }], data: parts.map(([label, v]) => ({ label, y0: v })) });
  }

  // ── Entonnoir : étapes successives dans l'ordre de la requête (lignes, ou colonnes y en format large) ──
  if (type === "funnel") {
    const parts = partsOf();
    if (parts.length < 2) throw new Error("funnel : au moins 2 étapes (une ligne par étape, ou plusieurs colonnes y sur une ligne).");
    if (parts.length > 8) throw new Error("funnel : 8 étapes maximum.");
    ignore("un entonnoir");
    return finish({ ...base, series: [{ key: "y0", label: measure }], data: parts.map(([label, v]) => ({ label, y0: v })) });
  }

  // ── Carte choroplèthe : une ligne par région ou département ──
  if (type === "map") {
    const xname = src.columns[xi];
    const level = /dep/i.test(xname) ? "departements" : /region/i.test(xname) ? "regions" : null;
    if (!level) throw new Error("map : x doit être region, departement ou code_departement (les académies n'ont pas de contours : utilise bar).");
    const codeI = level === "departements" ? src.columns.indexOf("code_departement") : -1;
    const nameI = level === "departements" && src.columns.includes("departement") ? src.columns.indexOf("departement") : xi;
    const seen = new Set<string>();
    const areas: { code?: string; name: string; value: number | null }[] = [];
    for (const r of rows) {
      const name = (r[nameI] === null || r[nameI] === "") && codeI >= 0 ? str(r[codeI]) : str(r[nameI]);
      if (seen.has(name)) throw new Error("map : une seule ligne par territoire. Filtre une session (WHERE session = 2025) ou agrège avant de tracer.");
      seen.add(name);
      const code = level === "regions" ? REGION_CODES[normName(name)] : codeI >= 0 ? str(r[codeI]) : undefined;
      areas.push({ code, name, value: num(r[ys[0]]) });
    }
    if (!areas.some((a) => a.value !== null)) throw new Error("map : aucune valeur numérique dans y.");
    const off = areas.filter((a) => (level === "regions" ? !a.code : a.code !== undefined && !DEP_ON_MAP.test(a.code)));
    if (off.length) notes.push(`Hors carte (voir le tableau) : ${off.map((a) => a.name).join(", ")}.`);
    ignore("une carte");
    return finish({
      ...base, xLabel: level === "regions" ? "Région" : "Département",
      series: [{ key: "y0", label: yLabel() }], data: [], map: { level, areas },
    });
  }

  // ── Cascade : 1re ligne = valeur de départ, puis variations ; total d'arrivée calculé ──
  if (type === "waterfall") {
    const steps = rows.map((r) => [str(r[xi]), num(r[ys[0]])] as const).filter((s): s is readonly [string, number] => s[1] !== null);
    if (steps.length < 2) throw new Error("waterfall : il faut une 1re ligne de départ (ex. total 2021) puis au moins une variation.");
    if (steps.length > 20) throw new Error("waterfall : 20 étapes maximum ; regroupe les petites variations.");
    let acc = steps[0][1];
    const data: ChartRow[] = [{ label: steps[0][0], y0: acc, lo: Math.min(0, acc), hi: Math.max(0, acc), kind: "total" }];
    for (const [label, v] of steps.slice(1)) {
      data.push({ label, y0: v, lo: Math.min(acc, acc + v), hi: Math.max(acc, acc + v), kind: v >= 0 ? "up" : "down" });
      acc += v;
    }
    data.push({ label: args.total_label ? String(args.total_label) : "Total", y0: acc, lo: Math.min(0, acc), hi: Math.max(0, acc), kind: "total" });
    ignore("une cascade");
    return finish({ ...base, series: [{ key: "y0", label: yLabel() }], data });
  }

  // ── Haltères : deux valeurs par catégorie (avant / après), reliées ──
  if (type === "dumbbell") {
    const byX = new Map<string, ChartRow>();
    let pair: { key: string; label: string }[];
    if (ci >= 0) {
      let groups = distinct(rows.map((r) => str(r[ci])));
      const canon = CANONICAL.find((order) => groups.every((g) => order.includes(g)));
      if (canon) groups.sort((a, b) => canon.indexOf(a) - canon.indexOf(b));
      if (groups.length < 2) throw new Error("dumbbell : color_by doit avoir 2 valeurs (ex. session 2021 et 2025).");
      if (groups.length > 2) {
        notes.push(`Comparaison de ${groups[0]} et ${groups[groups.length - 1]} (valeurs intermédiaires ignorées).`);
        groups = [groups[0], groups[groups.length - 1]];
      }
      pair = groups.map((g, k) => ({ key: `y${k}`, label: g }));
      for (const r of rows) {
        const k = groups.indexOf(str(r[ci]));
        if (k < 0) continue;
        const o = byX.get(str(r[xi])) ?? { label: str(r[xi]) };
        o[`y${k}`] = num(r[ys[0]]);
        byX.set(str(r[xi]), o);
      }
    } else {
      if (ys.length < 2) throw new Error("dumbbell : 2 colonnes dans y (avant, après) ou color_by avec 2 valeurs (format long).");
      ys = ys.slice(0, 2);
      pair = ys.map((_, k) => ({ key: `y${k}`, label: yLabel(k) }));
      for (const r of rows) byX.set(str(r[xi]), { label: str(r[xi]), y0: num(r[ys[0]]), y1: num(r[ys[1]]) });
    }
    let data = [...byX.values()].filter((d) => typeof d.y0 === "number" && typeof d.y1 === "number");
    if (!data.length) throw new Error("dumbbell : aucune catégorie n'a ses deux valeurs.");
    if (data.length > 25) { notes.push(`25 premiers éléments sur ${data.length}.`); data = data.slice(0, 25); }
    // Tri par valeur d'arrivée, sauf si la requête a déjà trié (par l'arrivée ou par l'écart).
    const end = data.map((d) => d.y1 as number), gap = data.map((d) => (d.y1 as number) - (d.y0 as number));
    if (!monotone(end) && !monotone(gap)) data.sort((a, b) => (b.y1 as number) - (a.y1 as number));
    if (fi >= 0) notes.push("facet_by ignoré pour un graphique en haltères.");
    return finish({ ...base, series: pair, data });
  }

  // ── Histogramme : x = borne basse de chaque classe (calculée en SQL), y = effectif ; classes vides complétées ──
  if (type === "histogram") {
    const bins = new Map<number, number>();
    for (const r of rows) {
      const a = num(r[xi]), v = num(r[ys[0]]);
      if (a !== null && v !== null) bins.set(a, (bins.get(a) ?? 0) + v);
    }
    const xs = [...bins.keys()].sort((a, b) => a - b);
    if (xs.length < 2) throw new Error("histogram : x = borne basse de chaque classe (ex. floor(taux_acces / 5) * 5), y = [effectif] ; au moins 2 classes.");
    const width = Math.min(...xs.slice(1).map((v, i) => v - xs[i]));
    const count = Math.round((xs[xs.length - 1] - xs[0]) / width) + 1;
    if (count > 80) throw new Error("histogram : 80 classes maximum ; élargis les classes.");
    const pctX = BOUNDED_PCT.test(src.columns[xi]) && !GROWTH.test(src.columns[xi]);
    const f = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
    const data: ChartRow[] = Array.from({ length: count }, (_, i) => {
      const a = Number((xs[0] + i * width).toFixed(6));
      const hit = xs.find((v) => Math.abs(v - a) < width / 1000);
      return { label: `${f(a)}–${f(a + width)}${pctX ? " %" : ""}`, x: a, y0: hit === undefined ? 0 : bins.get(hit)! };
    });
    ignore("un histogramme");
    return finish({ ...base, series: [{ key: "y0", label: yLabel() }], data });
  }

  // ── Indicateurs clés : tuiles (une ligne), ou dernière valeur + variation + mini-courbe (x = session) ──
  if (type === "kpi") {
    const yUnits = Array.isArray(args.y_units) ? args.y_units : [];
    const unitOf = (k: number): ChartUnit => {
      if (UNITS.includes(yUnits[k] as ChartUnit)) return yUnits[k] as ChartUnit;
      const c = src.columns[ys[k]];
      if (BOUNDED_PCT.test(c)) return "pct";
      if (/par_|ratio/i.test(c)) return "ratio";
      return k === 0 ? unit : "count";
    };
    const xs = xi >= 0 ? rows.map((r) => str(r[xi])) : [];
    let tiles: KpiTile[];
    if (xi < 0 || rows.length === 1) {
      tiles = ys.map((yi, k) => ({ label: yLabel(k), unit: unitOf(k), value: num(rows[0]?.[yi]) }));
    } else if (isNumericList(xs)) {
      const ordered = [...rows].sort((a, b) => Number(a[xi]) - Number(b[xi]));
      const n = ordered.length;
      tiles = ys.map((yi, k) => ({
        label: `${yLabel(k)} · ${str(ordered[n - 1][xi])}`, unit: unitOf(k), value: num(ordered[n - 1][yi]),
        previous: num(ordered[n - 2][yi]), previousLabel: str(ordered[n - 2][xi]), trend: ordered.map((r) => num(r[yi])),
      }));
    } else {
      tiles = rows.flatMap((r) => ys.map((yi, k) => ({
        label: ys.length > 1 ? `${str(r[xi])} · ${yLabel(k)}` : str(r[xi]), unit: unitOf(k), value: num(r[yi]),
      })));
    }
    if (tiles.length > 8) { notes.push(`8 indicateurs affichés sur ${tiles.length}.`); tiles = tiles.slice(0, 8); }
    if (!tiles.some((t) => t.value !== null)) throw new Error("kpi : aucune valeur numérique dans y.");
    return finish({ ...base, series: ys.map((_, k) => ({ key: `y${k}`, label: yLabel(k) })), data: [], tiles });
  }

  // ── Combiné : 2 indicateurs d'unités différentes, deux panneaux alignés sur le même X ──
  let unit2: ChartUnit | undefined;
  if (type === "combo") {
    if (ys.length < 2) throw new Error("combo : il faut exactement 2 colonnes dans y (barres puis courbe).");
    ys = ys.slice(0, 2);
    unit2 = (UNITS.includes(args.unit2 as ChartUnit) ? args.unit2 : unit) as ChartUnit;
    ignore("un graphique combiné");
  }
  const useColor = ci >= 0 && type !== "combo";
  const useFacet = fi >= 0 && type !== "combo";
  if (part && !useColor && ys.length < 2) {
    throw new Error(`${type} : il faut plusieurs parts : color_by (format long, ex. color_by = secteur) ou plusieurs colonnes dans y (format large).`);
  }

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
    const max = scatterLike ? MAX_SCATTER_GROUPS : part ? MAX_PARTS : MAX_SERIES;
    if (groups.length > max) {
      const ranked = [...groups].sort((a, b) => (totals.get(b)! - totals.get(a)!));
      const additive = (unit === "count" || part) && type !== "line" && !scatterLike;
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
    series = ys.map((_, k) => ({ key: `y${k}`, label: yLabel(k) }));
  }
  const seriesKeyOf = (value: string) =>
    series.find((s) => s.match === value)?.key ?? (fold?.has(value) ? series[series.length - 1].key : null);

  // ── Lignes normalisées pour un sous-ensemble (un panneau ou tout) ──
  const limit = type === "bubble" ? 80 : type === "scatter" ? 500 : type === "line" || type === "area" ? 60 : useFacet ? 25 : 30;
  const build = (subset: Cell[][]): ChartRow[] => {
    if (scatterLike) {
      return subset.slice(0, limit).map((r) => {
        const o: ChartRow = { label: li >= 0 ? str(r[li]) : str(r[xi]), x: num(r[xi]), y0: num(r[ys[0]]) };
        if (zi >= 0) o.z = num(r[zi]);
        if (useColor) o.group = seriesKeyOf(str(r[ci]));
        return o;
      }).filter((o) => o.x !== null && o.y0 !== null && (zi < 0 || numOr(o.z, -1) >= 0) && (!useColor || o.group));
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
    const temporal = ["line", "area", "combo", "column", "stacked_column", "stacked_column_100"].includes(type);
    if (temporal && isNumericList(out.map((o) => String(o.x)))) out.sort((a, b) => Number(a.x) - Number(b.x));
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
    // Classement en barres non trié par la requête : du plus grand au plus petit (lecture immédiate).
    if (type === "bar" && series.length === 1 && !isNumericList(data.map((d) => String(d.x)))) {
      const vals = data.map((d) => numOr(d[series[0].key], -Infinity));
      if (!monotone(vals)) data.sort((a, b) => numOr(b[series[0].key], -Infinity) - numOr(a[series[0].key], -Infinity));
    }
    const categories = new Set(rows.map((r) => str(r[xi]))).size;
    if (scatterLike ? rows.length > limit : categories > limit) {
      notes.push(`Affichage limité aux ${limit} premiers ${scatterLike ? "points" : "éléments"} sur ${scatterLike ? rows.length : categories}.`);
    }
  }

  const all = facets ? facets.flatMap((f) => f.data) : data;
  const keys = scatterLike ? ["y0"] : series.map((s) => s.key);
  if (!all.some((d) => keys.some((k) => typeof d[k] === "number"))) {
    throw new Error("Les colonnes y ne contiennent pas de valeurs numériques exploitables.");
  }

  // ── Barres à 100 % : chaque barre devient une répartition (valeurs d'origine conservées dans <clé>_raw) ──
  if (part) {
    for (const d of all) {
      const vals = keys.map((k) => numOr(d[k], 0));
      if (vals.some((v) => v < 0)) throw negative();
      const total = vals.reduce((a, b) => a + b, 0);
      keys.forEach((k, j) => {
        d[`${k}_raw`] = typeof d[k] === "number" ? d[k] : null;
        d[k] = total > 0 ? (100 * vals[j]) / total : null;
      });
    }
  }

  return finish({
    ...base,
    unit: part ? "pct" as ChartUnit : unit,
    unit2,
    rawUnit: part ? unit : undefined,
    series: series.map(({ key, label }) => ({ key, label })),
    data,
    facetLabel: useFacet ? String(args.facet_by) : undefined,
    facets,
    sizeLabel: type === "bubble" ? labels[1] ?? humanize(String(args.size)) : undefined,
  });
}

/** Nombre d'éléments tracés (retour d'outil au modèle). */
export function chartSize(c: ChartPayload) {
  if (c.heat) return c.heat.rows.length * c.heat.cols.length;
  if (c.map) return c.map.areas.length;
  if (c.tiles) return c.tiles.length;
  return c.facets ? c.facets.reduce((n, f) => n + f.data.length, 0) : c.data.length;
}
