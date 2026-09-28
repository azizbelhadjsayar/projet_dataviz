import { LAST_SESSION, SESSIONS, type Dim, type Filters } from "./data/schema";

// Filtres globaux du dashboard, portés par l'URL (?session=2025&type=BTS&secteur=Public&region=Bretagne).

export const URL_FILTERS = {
  type: "type_formation",
  secteur: "secteur",
  selectivite: "selectivite",
  region: "region",
} as const satisfies Record<string, Dim>;

export type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export interface PageFilters {
  session: number;
  /** Filtres hors session (pour les évolutions 2021-2025). */
  scope: Filters;
  /** Filtres incluant la session sélectionnée. */
  withSession: Filters;
  /** Session précédente (pour les variations), ou null. */
  previous: number | null;
}

export function parseFilters(sp: SearchParams): PageFilters {
  const s = Number(first(sp.session));
  const session = (SESSIONS as readonly number[]).includes(s) ? s : LAST_SESSION;
  const scope: Filters = {};
  for (const [param, dim] of Object.entries(URL_FILTERS)) {
    const v = first(sp[param]);
    if (v) scope[dim] = [v];
  }
  return {
    session,
    scope,
    withSession: { ...scope, session: [String(session)] },
    previous: session > SESSIONS[0] ? session - 1 : null,
  };
}

export const withSessionFilter = (f: Filters, session: number): Filters => ({ ...f, session: [String(session)] });
