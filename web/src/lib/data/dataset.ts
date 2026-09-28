import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Dim } from "./schema";

// Jeu de données chargé une seule fois en mémoire (généré par scripts/02_export_app_data.py).

interface RawDataset {
  n: number;
  dims: Record<Dim, { values: string[]; codes: number[] }>;
  measures: Record<string, (number | null)[]>;
  floats: Record<string, (number | null)[]>;
  keys: { cod_aff_form: string[] };
}

export interface Dataset {
  n: number;
  dims: Record<Dim, { values: string[]; codes: Uint32Array }>;
  /** Effectifs ; NaN = valeur manquante. */
  measures: Record<string, Float64Array>;
  floats: Record<string, Float64Array>;
  cod: string[];
}

const toFloat = (arr: (number | null)[]) => Float64Array.from(arr, (v) => (v === null ? NaN : v));

function load(): Dataset {
  const file = path.join(process.cwd(), "data", "parcoursup.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as RawDataset;
  const dims = {} as Dataset["dims"];
  for (const [k, d] of Object.entries(raw.dims) as [Dim, RawDataset["dims"][Dim]][]) {
    dims[k] = { values: d.values, codes: Uint32Array.from(d.codes) };
  }
  const measures: Dataset["measures"] = {};
  for (const [k, v] of Object.entries(raw.measures)) measures[k] = toFloat(v);
  const floats: Dataset["floats"] = {};
  for (const [k, v] of Object.entries(raw.floats)) floats[k] = toFloat(v);
  return { n: raw.n, dims, measures, floats, cod: raw.keys.cod_aff_form };
}

const g = globalThis as unknown as { __parcoursup?: Dataset };

export function getDataset(): Dataset {
  if (!g.__parcoursup) g.__parcoursup = load();
  return g.__parcoursup;
}
