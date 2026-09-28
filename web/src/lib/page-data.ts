import "server-only";
import type { FilterOptions } from "@/components/FilterBar";
import { dimValues } from "./data/query";
import { SESSIONS, type Filters } from "./data/schema";

const drop = (vals: string[]) => vals.filter((v) => v !== "Non renseigné");

export function filterOptions(): FilterOptions {
  return {
    sessions: [...SESSIONS],
    types: drop(dimValues("type_formation")),
    secteurs: drop(dimValues("secteur")),
    selectivites: drop(dimValues("selectivite")),
    regions: drop(dimValues("region")),
  };
}

/** Libellé lisible du périmètre filtré (sous-titres). */
export function scopeLabel(f: Filters) {
  const parts = [f.type_formation?.[0], f.secteur?.[0], f.selectivite?.[0]?.toLowerCase(), f.region?.[0]].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Toutes formations, France entière";
}
