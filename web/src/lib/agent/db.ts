import "server-only";
import path from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";

// Base DuckDB en mémoire (table `formations`), chargée une fois depuis data/parcoursup.parquet.
// Sécurité : seules les requêtes SELECT uniques sont acceptées (vérifiées par le parseur DuckDB),
// l'accès aux fichiers / au réseau est désactivé et la configuration verrouillée après le chargement.

const g = globalThis as unknown as { __duck?: Promise<DuckDBInstance> };

async function init() {
  const instance = await DuckDBInstance.create(":memory:", { threads: "4" });
  const con = await instance.connect();
  const file = path.join(process.cwd(), "data", "parcoursup.parquet").replaceAll("\\", "/").replaceAll("'", "''");
  await con.run(`CREATE TABLE formations AS SELECT * FROM read_parquet('${file}')`);
  await con.run(`SET memory_limit = '1GB'`);
  await con.run(`SET enable_external_access = false`);
  await con.run(`SET lock_configuration = true`);
  con.closeSync();
  return instance;
}

export function getDb() {
  if (!g.__duck) g.__duck = init().catch((e) => { g.__duck = undefined; throw e; });
  return g.__duck;
}

export class SqlError extends Error {}

export interface QueryResult {
  columns: string[];
  types: string[];
  rows: (string | number | boolean | null)[][];
  /** true si le résultat dépasse maxRows (lignes tronquées). */
  truncated: boolean;
  ms: number;
}

function toPlain(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" || typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return JSON.stringify(v, (_, x) => (typeof x === "bigint" ? Number(x) : x));
}

export async function runQuery(sql: string, { maxRows = 200, timeoutMs = 10_000 } = {}): Promise<QueryResult> {
  const clean = sql.trim().replace(/;+\s*$/, "");
  if (!clean) throw new SqlError("Requête vide.");
  const db = await getDb();
  const con = await db.connect();
  try {
    const check = await con.runAndReadAll("SELECT json_serialize_sql($1::VARCHAR)", [clean]);
    const parsed = JSON.parse(String(check.getRowsJS()[0][0])) as { error: boolean; error_message?: string; statements?: unknown[] };
    if (parsed.error) {
      throw new SqlError(/Only SELECT/i.test(parsed.error_message ?? "")
        ? "Seules les requêtes SELECT (une seule instruction) sont autorisées."
        : `Erreur de syntaxe SQL : ${parsed.error_message}`);
    }
    if ((parsed.statements?.length ?? 0) !== 1) throw new SqlError("Une seule instruction SELECT par appel.");

    const timer = setTimeout(() => con.interrupt(), timeoutMs);
    const t0 = performance.now();
    try {
      const reader = await con.runAndReadUntil(clean, maxRows + 1);
      const all = reader.getRowsJS();
      return {
        columns: reader.deduplicatedColumnNames(),
        types: reader.columnTypes().map(String),
        rows: all.slice(0, maxRows).map((r) => r.map(toPlain)),
        truncated: all.length > maxRows || !reader.done,
        ms: Math.round(performance.now() - t0),
      };
    } catch (e) {
      const msg = (e as Error).message;
      if (/INTERRUPT/i.test(msg)) throw new SqlError(`Requête interrompue : plus de ${timeoutMs / 1000} s d'exécution.`);
      throw new SqlError(msg.replace(/\n+/g, " ").slice(0, 500));
    } finally {
      clearTimeout(timer);
    }
  } finally {
    con.closeSync();
  }
}
