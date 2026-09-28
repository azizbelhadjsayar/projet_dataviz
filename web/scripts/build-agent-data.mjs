// Construit les données de l'agent SQL à partir du fichier fusionné :
//   data/parcoursup.parquet   table typée (lue par DuckDB au démarrage du serveur)
//   data/dictionary.json      description de chaque colonne (injectée dans le prompt de l'agent)
// Usage : npm run data:agent   (après scripts/01_fusion_parcoursup.py)

import { DuckDBInstance } from "@duckdb/node-api";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const processed = path.resolve(root, "..", "Data", "processed");
const csv = path.join(processed, "parcoursup_2021_2025.csv").replaceAll("\\", "/");
const dictCsv = path.join(processed, "dictionnaire_colonnes.csv").replaceAll("\\", "/");
const outDir = path.join(root, "data");
const parquet = path.join(outDir, "parcoursup.parquet").replaceAll("\\", "/");
mkdirSync(outDir, { recursive: true });

const db = await DuckDBInstance.create(":memory:");
const con = await db.connect();

await con.run(`
  CREATE TABLE formations AS
  SELECT * FROM read_csv('${csv}', header = true, delim = ',', quote = '"',
    types = {'session': 'INTEGER', 'cod_aff_form': 'VARCHAR', 'code_uai': 'VARCHAR', 'code_departement': 'VARCHAR',
             'concours': 'VARCHAR', 'taux_acces': 'DOUBLE', 'latitude': 'DOUBLE', 'longitude': 'DOUBLE'})
`);
// Effectifs en INTEGER (plus léger que BIGINT)
const cols = (await con.runAndReadAll(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'formations'`)).getRowObjectsJS();
for (const c of cols) {
  if (c.data_type === "BIGINT") await con.run(`ALTER TABLE formations ALTER COLUMN "${c.column_name}" TYPE INTEGER`);
}
await con.run(`COPY formations TO '${parquet}' (FORMAT parquet, COMPRESSION zstd)`);

const check = (await con.runAndReadAll(`SELECT session, count(*) AS n, sum(voeux_pp) AS voeux_pp FROM formations GROUP BY 1 ORDER BY 1`)).getRowObjectsJS();
console.log("Contrôle :", check.map((r) => `${r.session}: ${r.n} lignes, ${r.voeux_pp} vœux PP`).join(" | "));

// Dictionnaire des colonnes
const dict = (await con.runAndReadAll(`SELECT colonne, description FROM read_csv('${dictCsv}', header = true)`)).getRowObjectsJS();
const types = Object.fromEntries(
  (await con.runAndReadAll(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'formations' ORDER BY ordinal_position`))
    .getRowObjectsJS().map((r) => [r.column_name, r.data_type]),
);
const dictionary = Object.entries(types).map(([name, type]) => ({
  name, type, description: dict.find((d) => d.colonne === name)?.description ?? "",
}));
writeFileSync(path.join(outDir, "dictionary.json"), JSON.stringify(dictionary, null, 1));

console.log(`${Object.keys(types).length} colonnes -> ${parquet}`);
console.log(`Dictionnaire -> ${path.join(outDir, "dictionary.json")}`);
con.closeSync();
db.closeSync();
