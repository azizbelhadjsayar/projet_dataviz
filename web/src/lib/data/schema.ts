// Dimensions, effectifs et indicateurs du jeu Parcoursup 2021-2025.
// Fichier partagé serveur / client : aucune donnée, uniquement des définitions.

export const SESSIONS = [2021, 2022, 2023, 2024, 2025] as const;
export const LAST_SESSION = 2025;

export const DIMENSIONS = {
  session: "Session",
  type_formation: "Type de formation",
  filiere: "Filière",
  formation: "Formation",
  selectivite: "Sélectivité",
  secteur: "Secteur",
  statut_etablissement: "Statut de l'établissement",
  region: "Région",
  zone: "Zone",
  academie: "Académie",
  departement: "Département",
  code_departement: "Code département",
  commune: "Commune",
  etablissement: "Établissement",
} as const;
export type Dim = keyof typeof DIMENSIONS;
export const DIM_IDS = Object.keys(DIMENSIONS) as Dim[];

export type Filters = Partial<Record<Dim, string[]>>;

/** Sommes d'effectifs disponibles pour chaque groupe (+ accumulateurs spéciaux). */
export type Sums = Record<string, number>;

export type Unit = "count" | "pct" | "ratio";

export interface MetricDef {
  label: string;
  unit: Unit;
  description: string;
  /** Effectifs à sommer pour calculer l'indicateur. */
  needs: string[];
  compute: (s: Sums) => number | null;
}

const div = (a: number, b: number) => (b > 0 ? a / b : null);
const pct = (a: number, b: number) => (b > 0 ? (100 * a) / b : null);
const sum = (s: Sums, keys: string[]) => keys.reduce((acc, k) => acc + (s[k] ?? 0), 0);

const VOEUX_NEOBAC = ["voeux_pp_bac_general", "voeux_pp_bac_techno", "voeux_pp_bac_pro"];
const VOEUX_NEOBAC_BOURS = ["voeux_pp_bac_general_boursiers", "voeux_pp_bac_techno_boursiers", "voeux_pp_bac_pro_boursiers"];
const PROP_TERM = ["propositions_term_general", "propositions_term_techno", "propositions_term_pro"];
const PROP_TERM_BOURS = ["propositions_term_general_boursiers", "propositions_term_techno_boursiers", "propositions_term_pro_boursiers"];

const raw = (key: string, label: string, description: string): MetricDef => ({
  label, unit: "count", description, needs: [key], compute: (s) => s[key] ?? 0,
});

export const METRICS = {
  nb_formations: { label: "Formations", unit: "count", description: "Nombre de formations (lignes)", needs: ["__count"], compute: (s) => s.__count },
  capacite: raw("capacite", "Places", "Capacité d'accueil (places proposées)"),
  voeux_total: raw("voeux_total", "Vœux (total)", "Vœux reçus, phases principale + complémentaire. Un candidat fait plusieurs vœux : ce n'est PAS un nombre de personnes"),
  voeux_pp: raw("voeux_pp", "Vœux (phase principale)", "Vœux reçus en phase principale"),
  voeux_pc: raw("voeux_pc", "Vœux (phase complémentaire)", "Vœux reçus en phase complémentaire"),
  classes_pp: raw("classes_pp", "Classés (PP)", "Candidats classés par les formations en phase principale"),
  propositions_total: raw("propositions_total", "Propositions", "Candidats ayant reçu une proposition d'admission"),
  admis_total: raw("admis_total", "Admis", "Candidats ayant accepté une proposition (admis)"),
  admis_neobac: raw("admis_neobac", "Admis néo-bacheliers", "Admis titulaires du bac de l'année"),
  admis_filles: raw("admis_filles", "Admises", "Admises (candidates)"),
  admis_boursiers_neobac: raw("admis_boursiers_neobac", "Admis boursiers", "Admis néo-bacheliers boursiers"),

  taux_acces_moyen: {
    label: "Taux d'accès moyen", unit: "pct",
    description: "Taux d'accès moyen pondéré par les vœux PP (part des candidats ayant pu recevoir une proposition). Définition source différente en 2021",
    needs: ["__taux_w", "__taux_wd"], compute: (s) => div(s.__taux_w, s.__taux_wd),
  },
  taux_acces_median: {
    label: "Taux d'accès médian", unit: "pct", description: "Médiane des taux d'accès des formations (non pondérée)",
    needs: ["__taux_median"], compute: (s) => (Number.isFinite(s.__taux_median) ? s.__taux_median : null),
  },
  part_formations_selectives: {
    label: "Formations sélectives", unit: "pct", description: "Part des formations sélectives",
    needs: ["__count", "__selective"], compute: (s) => pct(s.__selective, s.__count),
  },
  voeux_par_place: {
    label: "Vœux par place", unit: "ratio", description: "Vœux en phase principale / places proposées (pression de la demande)",
    needs: ["voeux_pp", "capacite"], compute: (s) => div(s.voeux_pp, s.capacite),
  },
  taux_remplissage: {
    label: "Taux de remplissage", unit: "pct", description: "Admis / places proposées",
    needs: ["admis_total", "capacite"], compute: (s) => pct(s.admis_total, s.capacite),
  },
  taux_proposition: {
    label: "Vœux avec proposition", unit: "pct", description: "Part des vœux ayant donné lieu à une proposition d'admission",
    needs: ["propositions_total", "voeux_total"], compute: (s) => pct(s.propositions_total, s.voeux_total),
  },
  part_filles_voeux: {
    label: "Part de filles (vœux)", unit: "pct", description: "Part des vœux formulés par des candidates",
    needs: ["voeux_filles", "voeux_total"], compute: (s) => pct(s.voeux_filles, s.voeux_total),
  },
  part_filles_admis: {
    label: "Part de filles (admis)", unit: "pct", description: "Part des admises parmi les admis",
    needs: ["admis_filles", "admis_total"], compute: (s) => pct(s.admis_filles, s.admis_total),
  },
  part_boursiers_voeux: {
    label: "Part de boursiers (vœux)", unit: "pct", description: "Part des vœux de néo-bacheliers boursiers parmi les vœux de néo-bacheliers (PP)",
    needs: [...VOEUX_NEOBAC, ...VOEUX_NEOBAC_BOURS], compute: (s) => pct(sum(s, VOEUX_NEOBAC_BOURS), sum(s, VOEUX_NEOBAC)),
  },
  part_boursiers_admis: {
    label: "Part de boursiers (admis)", unit: "pct", description: "Part des boursiers parmi les admis néo-bacheliers",
    needs: ["admis_boursiers_neobac", "admis_neobac"], compute: (s) => pct(s.admis_boursiers_neobac, s.admis_neobac),
  },
  taux_proposition_boursiers: {
    label: "Taux de proposition (boursiers)", unit: "pct", description: "Propositions reçues par les terminales boursiers / leurs vœux PP",
    needs: [...PROP_TERM_BOURS, ...VOEUX_NEOBAC_BOURS], compute: (s) => pct(sum(s, PROP_TERM_BOURS), sum(s, VOEUX_NEOBAC_BOURS)),
  },
  taux_proposition_non_boursiers: {
    label: "Taux de proposition (non-boursiers)", unit: "pct", description: "Propositions reçues par les terminales non boursiers / leurs vœux PP",
    needs: [...PROP_TERM, ...PROP_TERM_BOURS, ...VOEUX_NEOBAC, ...VOEUX_NEOBAC_BOURS],
    compute: (s) => pct(sum(s, PROP_TERM) - sum(s, PROP_TERM_BOURS), sum(s, VOEUX_NEOBAC) - sum(s, VOEUX_NEOBAC_BOURS)),
  },
  part_voeux_bac_general: {
    label: "Vœux bac général", unit: "pct", description: "Part des vœux PP venant de néo-bacheliers généraux",
    needs: ["voeux_pp_bac_general", "voeux_pp"], compute: (s) => pct(s.voeux_pp_bac_general, s.voeux_pp),
  },
  part_voeux_bac_techno: {
    label: "Vœux bac techno", unit: "pct", description: "Part des vœux PP venant de néo-bacheliers technologiques",
    needs: ["voeux_pp_bac_techno", "voeux_pp"], compute: (s) => pct(s.voeux_pp_bac_techno, s.voeux_pp),
  },
  part_voeux_bac_pro: {
    label: "Vœux bac pro", unit: "pct", description: "Part des vœux PP venant de néo-bacheliers professionnels",
    needs: ["voeux_pp_bac_pro", "voeux_pp"], compute: (s) => pct(s.voeux_pp_bac_pro, s.voeux_pp),
  },
  part_admis_bac_general: {
    label: "Admis bac général", unit: "pct", description: "Part des bacheliers généraux parmi les admis néo-bacheliers",
    needs: ["admis_bac_general", "admis_neobac"], compute: (s) => pct(s.admis_bac_general, s.admis_neobac),
  },
  part_admis_bac_techno: {
    label: "Admis bac techno", unit: "pct", description: "Part des bacheliers technologiques parmi les admis néo-bacheliers",
    needs: ["admis_bac_techno", "admis_neobac"], compute: (s) => pct(s.admis_bac_techno, s.admis_neobac),
  },
  part_admis_bac_pro: {
    label: "Admis bac pro", unit: "pct", description: "Part des bacheliers professionnels parmi les admis néo-bacheliers",
    needs: ["admis_bac_pro", "admis_neobac"], compute: (s) => pct(s.admis_bac_pro, s.admis_neobac),
  },
  part_mention_tb: {
    label: "Admis mention TB", unit: "pct", description: "Part des mentions Très bien (avec ou sans félicitations) parmi les admis néo-bacheliers",
    needs: ["admis_mention_tb", "admis_mention_tbf", "admis_neobac"], compute: (s) => pct(s.admis_mention_tb + s.admis_mention_tbf, s.admis_neobac),
  },
  part_mention_b_ou_plus: {
    label: "Admis mention B ou TB", unit: "pct", description: "Part des mentions Bien ou Très bien parmi les admis néo-bacheliers",
    needs: ["admis_mention_b", "admis_mention_tb", "admis_mention_tbf", "admis_neobac"],
    compute: (s) => pct(s.admis_mention_b + s.admis_mention_tb + s.admis_mention_tbf, s.admis_neobac),
  },
  part_sans_mention: {
    label: "Admis sans mention", unit: "pct", description: "Part des admis néo-bacheliers sans mention",
    needs: ["admis_sans_mention", "admis_neobac"], compute: (s) => pct(s.admis_sans_mention, s.admis_neobac),
  },
  part_mention_ab: {
    label: "Admis mention AB", unit: "pct", description: "Part des mentions Assez bien parmi les admis néo-bacheliers",
    needs: ["admis_mention_ab", "admis_neobac"], compute: (s) => pct(s.admis_mention_ab, s.admis_neobac),
  },
  part_mention_b: {
    label: "Admis mention B", unit: "pct", description: "Part des mentions Bien parmi les admis néo-bacheliers",
    needs: ["admis_mention_b", "admis_neobac"], compute: (s) => pct(s.admis_mention_b, s.admis_neobac),
  },
  part_mention_inconnue: {
    label: "Admis mention inconnue", unit: "pct", description: "Part des admis néo-bacheliers sans information sur la mention",
    needs: ["admis_mention_inconnue", "admis_neobac"], compute: (s) => pct(s.admis_mention_inconnue, s.admis_neobac),
  },
  part_meme_academie: {
    label: "Admis de la même académie", unit: "pct", description: "Part des admis néo-bacheliers issus de l'académie de la formation (mobilité faible si élevé)",
    needs: ["admis_meme_academie", "admis_neobac"], compute: (s) => pct(s.admis_meme_academie, s.admis_neobac),
  },
  part_admis_avant_bac: {
    label: "Proposition avant le bac", unit: "pct", description: "Part des admis ayant reçu leur proposition avant les résultats du bac",
    needs: ["admis_prop_avant_bac", "admis_total"], compute: (s) => pct(s.admis_prop_avant_bac, s.admis_total),
  },
  part_admis_ouverture: {
    label: "Proposition dès l'ouverture", unit: "pct", description: "Part des admis ayant reçu leur proposition dès l'ouverture de la phase principale",
    needs: ["admis_prop_ouverture_pp", "admis_total"], compute: (s) => pct(s.admis_prop_ouverture_pp, s.admis_total),
  },
  part_admis_pc: {
    label: "Admis en phase complémentaire", unit: "pct", description: "Part des admis recrutés en phase complémentaire",
    needs: ["admis_pc", "admis_total"], compute: (s) => pct(s.admis_pc, s.admis_total),
  },
} satisfies Record<string, MetricDef>;

export type MetricId = keyof typeof METRICS;
export const METRIC_IDS = Object.keys(METRICS) as MetricId[];
export const metric = (id: MetricId): MetricDef => METRICS[id];
