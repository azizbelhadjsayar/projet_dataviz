import "server-only";
import { getDataset, type Dataset } from "./dataset";
import { DIM_IDS, METRICS, type Dim, type Filters, type MetricId, type Sums } from "./schema";

// Moteur de requêtes en mémoire, partagé par les pages du dashboard et les outils du chatbot.

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

export interface ResolvedFilters {
  /** Par dimension filtrée : table code -> 1 si retenu. */
  masks: [Uint32Array, Uint8Array][];
  /** Valeurs réellement retenues (après correspondance approximative). */
  resolved: Partial<Record<Dim, string[]>>;
  /** Valeurs demandées sans correspondance. */
  unmatched: Partial<Record<Dim, string[]>>;
}

/** Associe chaque valeur demandée aux libellés existants : exact (sans accents/casse), sinon « contient ». */
export function resolveFilters(filters: Filters = {}, ds: Dataset = getDataset()): ResolvedFilters {
  const out: ResolvedFilters = { masks: [], resolved: {}, unmatched: {} };
  for (const dim of DIM_IDS) {
    const wanted = filters[dim]?.filter((v) => v !== undefined && v !== null && String(v).trim() !== "");
    if (!wanted?.length) continue;
    const { values, codes } = ds.dims[dim];
    const norm = values.map(normalize);
    const mask = new Uint8Array(values.length);
    const kept = new Set<string>();
    for (const w of wanted.map((v) => normalize(String(v)))) {
      let idx = norm.flatMap((v, i) => (v === w ? [i] : []));
      if (!idx.length) idx = norm.flatMap((v, i) => (v.includes(w) ? [i] : []));
      if (!idx.length) (out.unmatched[dim] ??= []).push(w);
      for (const i of idx) { mask[i] = 1; kept.add(values[i]); }
    }
    out.resolved[dim] = [...kept];
    out.masks.push([codes, mask]);
  }
  return out;
}

function matchRow(masks: ResolvedFilters["masks"], i: number) {
  for (const [codes, mask] of masks) if (!mask[codes[i]]) return false;
  return true;
}

/** Ajoute la ligne i aux accumulateurs d'un groupe. */
function accumulate(ds: Dataset, acc: Sums, needs: string[], i: number, tauxList: number[] | null, selCode: number) {
  for (const k of needs) {
    if (k === "__count") acc.__count += 1;
    else if (k === "__selective") acc.__selective += ds.dims.selectivite.codes[i] === selCode ? 1 : 0;
    else if (k === "__taux_w" || k === "__taux_wd" || k === "__taux_median") continue;
    else {
      const v = ds.measures[k][i];
      if (!Number.isNaN(v)) acc[k] += v;
    }
  }
  const t = ds.floats.taux_acces[i];
  const w = ds.measures.voeux_pp[i];
  if (!Number.isNaN(t) && !Number.isNaN(w)) {
    acc.__taux_w += t * w;
    acc.__taux_wd += w;
  }
  if (tauxList && !Number.isNaN(t)) tauxList.push(t);
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function needsOf(metrics: MetricId[]) {
  const needs = new Set<string>(["__count"]);
  for (const m of metrics) for (const k of METRICS[m].needs) needs.add(k);
  return [...needs];
}

const emptySums = (needs: string[]): Sums => {
  const s: Sums = { __count: 0, __selective: 0, __taux_w: 0, __taux_wd: 0 };
  for (const k of needs) s[k] = 0;
  return s;
};

export type Row = Record<string, string | number | null>;

/** Ajoute une colonne `label` (axe des graphiques) à partir d'une dimension. */
export const labeled = (rows: Row[], dim: string): Row[] => rows.map((r) => ({ ...r, label: String(r[dim]) }));

export interface AggregateQuery {
  groupBy?: Dim[];
  metrics: MetricId[];
  filters?: Filters;
  sortBy?: MetricId | Dim;
  order?: "asc" | "desc";
  limit?: number;
  /** Ignore les groupes dont le nombre de formations est inférieur (évite les ratios sur 1 formation). */
  minFormations?: number;
}

export interface AggregateResult {
  rows: Row[];
  totalGroups: number;
  filters: ResolvedFilters["resolved"];
  unmatched: ResolvedFilters["unmatched"];
}

export function aggregate(q: AggregateQuery): AggregateResult {
  const ds = getDataset();
  const groupBy = q.groupBy ?? [];
  const metrics = q.metrics;
  const needs = needsOf(metrics);
  const wantMedian = needs.includes("__taux_median");
  const selCode = ds.dims.selectivite.values.indexOf("Sélective");
  const rf = resolveFilters(q.filters, ds);

  const groups = new Map<string, { codes: number[]; sums: Sums; taux: number[] | null }>();
  for (let i = 0; i < ds.n; i++) {
    if (!matchRow(rf.masks, i)) continue;
    const codes = groupBy.map((d) => ds.dims[d].codes[i]);
    const key = codes.join("|");
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { codes, sums: emptySums(needs), taux: wantMedian ? [] : null }));
    accumulate(ds, g.sums, needs, i, g.taux, selCode);
  }

  let rows: Row[] = [];
  for (const g of groups.values()) {
    if (q.minFormations && g.sums.__count < q.minFormations) continue;
    if (g.taux) g.sums.__taux_median = median(g.taux);
    const row: Row = {};
    groupBy.forEach((d, j) => {
      const v = ds.dims[d].values[g.codes[j]];
      row[d] = d === "session" ? Number(v) : v;
    });
    for (const m of metrics) {
      const v = METRICS[m].compute(g.sums);
      row[m] = v === null || !Number.isFinite(v) ? null : v;
    }
    rows.push(row);
  }

  const sortBy = q.sortBy ?? (groupBy.includes("session") ? "session" : metrics[0]);
  const dir = (q.order ?? (sortBy === "session" ? "asc" : "desc")) === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const x = a[sortBy], y = b[sortBy];
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fr")) * dir;
  });
  const totalGroups = rows.length;
  if (q.limit) rows = rows.slice(0, q.limit);
  return { rows, totalGroups, filters: rf.resolved, unmatched: rf.unmatched };
}

/** Valeur unique d'un indicateur sur un périmètre. */
export function value(m: MetricId, filters?: Filters): number | null {
  return aggregate({ metrics: [m], filters }).rows[0]?.[m] as number | null ?? null;
}

// ── Recherche de formations (niveau ligne) ────────────────────────────────────

const SEARCH_DIMS: Dim[] = ["etablissement", "formation", "filiere", "type_formation", "commune", "departement", "academie", "region"];
let haystack: string[] | null = null;

function getHaystack(ds: Dataset) {
  if (!haystack) {
    const normDims = SEARCH_DIMS.map((d) => ds.dims[d].values.map(normalize));
    haystack = Array.from({ length: ds.n }, (_, i) =>
      SEARCH_DIMS.map((d, j) => normDims[j][ds.dims[d].codes[i]]).join(" | "));
  }
  return haystack;
}

export const lienParcoursup = (cod: string) =>
  `https://dossier.parcoursup.fr/Candidats/public/fiches/afficherFicheFormation?g_ta_cod=${cod}`;

export interface SearchQuery {
  q?: string;
  filters?: Filters;
  metrics?: MetricId[];
  sortBy?: MetricId;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

const ROW_DIMS: Dim[] = ["session", "etablissement", "formation", "filiere", "type_formation", "selectivite", "secteur", "commune", "departement", "region"];
export const DEFAULT_ROW_METRICS: MetricId[] = ["capacite", "voeux_pp", "admis_total", "taux_acces_moyen", "voeux_par_place"];

export function rowMetrics(ds: Dataset, i: number, metrics: MetricId[]): Row {
  const needs = needsOf(metrics);
  const sums = emptySums(needs);
  const taux: number[] = [];
  accumulate(ds, sums, needs, i, taux, ds.dims.selectivite.values.indexOf("Sélective"));
  sums.__taux_median = median(taux);
  const row: Row = {};
  for (const m of metrics) {
    const v = METRICS[m].compute(sums);
    row[m] = v === null || !Number.isFinite(v) ? null : v;
  }
  return row;
}

function describeRow(ds: Dataset, i: number, metrics: MetricId[]): Row {
  const row: Row = { cod_aff_form: ds.cod[i] };
  for (const d of ROW_DIMS) {
    const v = ds.dims[d].values[ds.dims[d].codes[i]];
    row[d] = d === "session" ? Number(v) : v;
  }
  Object.assign(row, rowMetrics(ds, i, metrics));
  row.lien = lienParcoursup(ds.cod[i]);
  return row;
}

export function searchFormations(q: SearchQuery) {
  const ds = getDataset();
  const rf = resolveFilters(q.filters, ds);
  const metrics = q.metrics?.length ? q.metrics : DEFAULT_ROW_METRICS;
  const tokens = q.q ? normalize(q.q).split(" ").filter(Boolean) : [];
  const hay = tokens.length ? getHaystack(ds) : null;

  const hits: number[] = [];
  for (let i = 0; i < ds.n; i++) {
    if (!matchRow(rf.masks, i)) continue;
    if (hay && !tokens.every((t) => hay[i].includes(t))) continue;
    hits.push(i);
  }
  const sortBy = q.sortBy ?? "voeux_pp";
  const dir = q.order === "asc" ? 1 : -1;
  const keyed = hits.map((i) => ({ i, v: rowMetrics(ds, i, [sortBy])[sortBy] as number | null }));
  keyed.sort((a, b) => (a.v === null ? 1 : b.v === null ? -1 : (a.v - b.v) * dir));
  const offset = q.offset ?? 0;
  const page = keyed.slice(offset, offset + (q.limit ?? 20));
  return {
    total: hits.length,
    rows: page.map(({ i }) => describeRow(ds, i, metrics)),
    filters: rf.resolved,
    unmatched: rf.unmatched,
  };
}

/** Évolution d'une formation (même cod_aff_form) sur les 5 sessions. */
export function formationHistory(cod: string, metrics: MetricId[] = DEFAULT_ROW_METRICS) {
  const ds = getDataset();
  const rows: Row[] = [];
  for (let i = 0; i < ds.n; i++) if (ds.cod[i] === cod) rows.push(describeRow(ds, i, metrics));
  return rows.sort((a, b) => Number(a.session) - Number(b.session));
}

/** Valeurs distinctes d'une dimension (avec nombre de formations), filtrables par texte. */
export function listValues(dim: Dim, q?: string, filters?: Filters, limit = 30) {
  const ds = getDataset();
  const rf = resolveFilters(filters, ds);
  const counts = new Map<number, number>();
  const { codes, values } = ds.dims[dim];
  for (let i = 0; i < ds.n; i++) {
    if (!matchRow(rf.masks, i)) continue;
    counts.set(codes[i], (counts.get(codes[i]) ?? 0) + 1);
  }
  const nq = q ? normalize(q) : "";
  const all = [...counts.entries()]
    .map(([c, n]) => ({ value: values[c], formations: n }))
    .filter((r) => !nq || normalize(r.value).includes(nq))
    .sort((a, b) => b.formations - a.formations);
  return { total: all.length, values: all.slice(0, limit) };
}

export function dimValues(dim: Dim): string[] {
  return getDataset().dims[dim].values;
}
