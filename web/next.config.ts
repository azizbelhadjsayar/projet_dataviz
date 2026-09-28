import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DuckDB est un module natif : chargé par Node, pas empaqueté.
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
  // Fichiers lus à l'exécution, à embarquer explicitement lors d'un déploiement (Vercel…) :
  //  - données et contours lus via fs ;
  //  - bibliothèque native de DuckDB (libduckdb.so), chargée dynamiquement par duckdb.node et donc
  //    invisible pour le traçage automatique (sans elle : « libduckdb.so: cannot open shared object file »).
  outputFileTracingIncludes: {
    "/*": [
      "./data/parcoursup.json", "./data/parcoursup.parquet", "./data/dictionary.json", "./public/geo/*.geojson",
      "./node_modules/@duckdb/node-bindings-linux-x64/**/*",
    ],
  },
};

export default nextConfig;
