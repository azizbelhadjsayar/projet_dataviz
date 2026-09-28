import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { geoConicConformal, geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";

// Projection des contours en chemins SVG, faite une fois côté serveur : le navigateur ne reçoit que
// des chaînes « d » prêtes à dessiner. Métropole à droite, départements et régions d'outre-mer
// en encarts (chacun avec sa propre projection) dans la colonne de gauche.

export interface Shape {
  code: string;
  name: string;
  d: string;
  /** Cadre de l'encart (outre-mer). */
  box?: { x: number; y: number; w: number; h: number };
}

export const MAP_WIDTH = 640;
export const MAP_HEIGHT = 560;
const INSET_W = 104;

type Props = { code: string; nom: string };

// DROM : code département -> région correspondante (mêmes contours)
const DROM: Record<string, { region: string; name: string }> = {
  "971": { region: "01", name: "Guadeloupe" },
  "972": { region: "02", name: "Martinique" },
  "973": { region: "03", name: "Guyane" },
  "974": { region: "04", name: "La Réunion" },
  "976": { region: "06", name: "Mayotte" },
};
const DROM_ORDER = ["971", "972", "973", "974", "976"];

const cache = new Map<string, Shape[]>();
const read = (file: string) =>
  JSON.parse(readFileSync(path.join(process.cwd(), "public", "geo", file), "utf8")) as FeatureCollection<Geometry, Props>;

function insets(level: "regions" | "departements"): Shape[] {
  const om = read("outre-mer.geojson");
  const h = MAP_HEIGHT / DROM_ORDER.length;
  return DROM_ORDER.flatMap((code, i) => {
    const f = om.features.find((x) => x.properties.code === code) as Feature<Geometry, Props> | undefined;
    if (!f) return [];
    const box = { x: 0, y: i * h + 4, w: INSET_W - 10, h: h - 8 };
    const proj = geoMercator().fitExtent([[box.x + 8, box.y + 20], [box.x + box.w - 8, box.y + box.h - 6]], f);
    const d = geoPath(proj).digits(1)(f) ?? "";
    const meta = DROM[code];
    return [{ code: level === "regions" ? meta.region : code, name: meta.name, d, box }];
  });
}

export function getShapes(level: "regions" | "departements"): Shape[] {
  const hit = cache.get(level);
  if (hit) return hit;
  const fc = read(`${level}.geojson`);
  const projection = geoConicConformal().parallels([44, 49]).rotate([-3, 0])
    .fitExtent([[INSET_W + 8, 4], [MAP_WIDTH - 4, MAP_HEIGHT - 4]], fc);
  const gen = geoPath(projection).digits(1);
  const shapes = [
    ...fc.features.map((f) => ({ code: f.properties.code, name: f.properties.nom, d: gen(f) ?? "" })),
    ...insets(level),
  ];
  cache.set(level, shapes);
  return shapes;
}
