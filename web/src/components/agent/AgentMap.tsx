"use client";

import { useEffect, useMemo, useState } from "react";
import { FranceMap, type MapShape } from "@/components/charts/FranceMap";
import type { Unit } from "@/lib/data/schema";

type Level = "regions" | "departements";
interface Area { code?: string; name: string; value: number | null }

// Mêmes dimensions que la projection de lib/geo.ts (contours servis par /api/geo/[level]).
const MAP_W = 640;
const MAP_H = 560;
const shapesCache: Partial<Record<Level, Promise<MapShape[]>>> = {};
const loadShapes = (level: Level) =>
  (shapesCache[level] ??= fetch(`/api/geo/${level}`)
    .then((r) => (r.ok ? (r.json() as Promise<MapShape[]>) : Promise.reject(new Error(String(r.status)))))
    .catch((e) => { delete shapesCache[level]; throw e; }));

const normName = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Carte choroplèthe de l'agent : contours chargés à la demande, appariement par code INSEE puis par nom. */
export function AgentMap({ level, areas, unit, metricLabel }: { level: Level; areas: Area[]; unit: Unit; metricLabel: string }) {
  const [loaded, setLoaded] = useState<{ level: Level; shapes: MapShape[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadShapes(level)
      .then((shapes) => { if (live) setLoaded({ level, shapes }); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [level]);
  const shapes = loaded?.level === level ? loaded.shapes : null;

  // Les territoires hors carte (étranger, collectivités d'outre-mer) sont signalés dans la note du graphique.
  const values = useMemo(() => {
    const out: Record<string, { value: number | null }> = {};
    if (!shapes) return out;
    const byCode = new Set(shapes.map((s) => s.code));
    const byName = new Map(shapes.map((s) => [normName(s.name), s.code]));
    for (const a of areas) {
      const code = a.code && byCode.has(a.code) ? a.code : byName.get(normName(a.name));
      if (code) out[code] = { value: a.value };
    }
    return out;
  }, [shapes, areas]);

  if (failed) return <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">Contours indisponibles : les valeurs restent consultables dans la vue Tableau.</p>;
  return (
    <div className="mx-auto max-w-[560px]">
      {shapes ? (
        <FranceMap shapes={shapes} width={MAP_W} height={MAP_H} values={values} unit={unit} metricLabel={metricLabel} />
      ) : (
        <div className="flex items-center justify-center rounded-xl bg-surface-2 text-sm text-muted" style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
          Chargement de la carte…
        </div>
      )}
    </div>
  );
}
