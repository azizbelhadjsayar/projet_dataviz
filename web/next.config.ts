import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DuckDB est un module natif : chargé par Node, pas empaqueté.
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
  // Fichiers lus via fs à l'exécution : à embarquer explicitement lors d'un déploiement (Vercel…).
  outputFileTracingIncludes: {
    "/*": ["./data/parcoursup.json", "./data/parcoursup.parquet", "./data/dictionary.json", "./public/geo/*.geojson"],
  },
};

export default nextConfig;
