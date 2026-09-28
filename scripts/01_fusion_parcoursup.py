"""
Fusion Parcoursup 2021-2025 depuis les fichiers sources annuels (Data/<annee>.xlsx).

- Mapping des colonnes par NOM (l'ordre des colonnes change entre 2021 et 2022+).
- Les deux colonnes "Filière de formation" (même nom, sens inversé entre 2021 et 2022+)
  sont distinguées par leur cardinalité : la moins détaillée devient `filiere`,
  l'autre `formation`.
- Harmonisation des libellés (régions, académies, types de formation) et du taux d'accès.
- Contrôles : nb de lignes et sommes des effectifs identiques aux sources.

Sorties (Data/processed/) :
  parcoursup_2021_2025.csv   séparateur ',' / décimale '.' / UTF-8 BOM
  parcoursup_2021_2025.xlsx  pour Excel / Power BI
  dictionnaire_colonnes.csv  description de chaque colonne
"""
import os
import re
import sys
import time

import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(BASE, "Data")
OUT_DIR = os.path.join(SRC_DIR, "processed")
SESSIONS = [2021, 2022, 2023, 2024, 2025]

# ── Colonnes conservées : (nom final, colonne source, description) ────────────
# Les colonnes source "FILIERE_*", "KEY" et "TAUX" sont résolues par année (voir resolve_special).
COLUMNS = [
    # Identification & géographie
    ("session", "Session", "Année de la session Parcoursup"),
    ("cod_aff_form", "KEY", "Identifiant Parcoursup de la formation (stable d'une session à l'autre)"),
    ("statut_etablissement", "Statut de l’établissement de la filière de formation (public, privé…)", "Statut détaillé de l'établissement"),
    ("code_uai", "Code UAI de l'établissement", "Code UAI de l'établissement"),
    ("etablissement", "Établissement", "Nom de l'établissement"),
    ("code_departement", "Code départemental de l’établissement", "Code du département"),
    ("departement", "Département de l’établissement", "Département"),
    ("region", "Région de l’établissement", "Région (libellés harmonisés)"),
    ("academie", "Académie de l’établissement", "Académie (libellés harmonisés)"),
    ("commune", "Commune de l’établissement", "Commune"),
    ("gps", "Coordonnées GPS de la formation", None),  # éclatée en latitude / longitude
    # Formation
    ("type_formation", "Filière de formation très agrégée", "Grand type de formation (BTS, Licence, CPGE, BUT...)"),
    ("filiere", "FILIERE_AGREGEE", "Filière agrégée (ex. 'BTS - Services', 'Licence - Sciences humaines et sociales')"),
    ("formation", "FILIERE_DETAILLEE", "Intitulé de la formation (ex. 'Licence - Sociologie')"),
    ("mention_specialite", "Filière de formation détaillée bis", "Mention / spécialité"),
    ("parcours", "Filière de formation très détaillée", "Parcours / option (souvent vide)"),
    ("selectivite", "Sélectivité", "Sélective / Non sélective"),
    ("concours", "Concours communs et banque d'épreuves", "Concours commun éventuel"),
    ("lien_parcoursup", "Lien de la formation sur la plateforme Parcoursup", "URL de la fiche Parcoursup"),
    ("capacite", "Capacité de l’établissement par formation", "Nombre de places proposées"),
    # Vœux (candidatures) - attention : 1 candidat peut formuler plusieurs vœux
    ("voeux_total", "Effectif total des candidats pour une formation", "Vœux reçus (phase principale + complémentaire)"),
    ("voeux_filles", "Dont effectif des candidates pour une formation", "Dont vœux de candidates"),
    ("voeux_pp", "Effectif total des candidats en phase principale", "Vœux en phase principale"),
    ("voeux_pp_internat", "Dont effectif des candidats ayant postulé en internat", "Dont vœux avec demande d'internat"),
    ("voeux_pp_bac_general", "Effectif des candidats néo bacheliers généraux en phase principale", "Vœux PP de néo-bacheliers généraux"),
    ("voeux_pp_bac_general_boursiers", "Dont effectif des candidats boursiers néo bacheliers généraux en phase principale", "dont boursiers"),
    ("voeux_pp_bac_techno", "Effectif des candidats néo bacheliers technologiques en phase principale", "Vœux PP de néo-bacheliers technologiques"),
    ("voeux_pp_bac_techno_boursiers", "Dont effectif des candidats boursiers néo bacheliers technologiques en phase principale", "dont boursiers"),
    ("voeux_pp_bac_pro", "Effectif des candidats néo bacheliers professionnels en phase principale", "Vœux PP de néo-bacheliers professionnels"),
    ("voeux_pp_bac_pro_boursiers", "Dont effectif des candidats boursiers néo bacheliers professionnels en phase principale", "dont boursiers"),
    ("voeux_pp_autres", "Effectif des autres candidats en phase principale", "Vœux PP des autres candidats (réorientation, étrangers...)"),
    ("voeux_pc", "Effectif total des candidats en phase complémentaire", "Vœux en phase complémentaire"),
    # Classements
    ("classes_pp", "Effectif total des candidats classés par l’établissement en phase principale", "Candidats classés en phase principale"),
    ("classes_pc", "Effectif des candidats classés par l’établissement en phase complémentaire", "Candidats classés en phase complémentaire"),
    ("classes_bac_general", "Effectif des candidats néo bacheliers généraux classés par l’établissement", "Classés néo-bacheliers généraux"),
    ("classes_bac_general_boursiers", "Dont effectif des candidats boursiers néo bacheliers généraux classés par l’établissement", "dont boursiers"),
    ("classes_bac_techno", "Effectif des candidats néo bacheliers technologiques classés par l’établissement", "Classés néo-bacheliers technologiques"),
    ("classes_bac_techno_boursiers", "Dont effectif des candidats boursiers néo bacheliers technologiques classés par l’établissement", "dont boursiers"),
    ("classes_bac_pro", "Effectif des candidats néo bacheliers professionnels classés par l’établissement", "Classés néo-bacheliers professionnels"),
    ("classes_bac_pro_boursiers", "Dont effectif des candidats boursiers néo bacheliers professionnels classés par l’établissement", "dont boursiers"),
    ("classes_autres", "Effectif des autres candidats classés par l’établissement", "Classés autres candidats"),
    # Propositions d'admission
    ("propositions_total", "Effectif total des candidats ayant reçu une proposition d’admission de la part de l’établissement", "Candidats ayant reçu une proposition"),
    ("propositions_term_general", "Effectif des candidats en terminale générale ayant reçu une proposition d’admission de la part de l’établissement", "Propositions à des terminales générales"),
    ("propositions_term_general_boursiers", "Dont effectif des candidats boursiers en terminale générale ayant reçu une proposition d’admission de la part de l’établissement", "dont boursiers"),
    ("propositions_term_techno", "Effectif des candidats en terminale technologique ayant reçu une proposition d’admission de la part de l’établissement", "Propositions à des terminales technologiques"),
    ("propositions_term_techno_boursiers", "Dont effectif des candidats boursiers en terminale technologique ayant reçu une proposition d’admission de la part de l’établissement", "dont boursiers"),
    ("propositions_term_pro", "Effectif des candidats en terminale professionnelle ayant reçu une proposition d’admission de la part de l’établissement", "Propositions à des terminales professionnelles"),
    ("propositions_term_pro_boursiers", "Dont effectif des candidats boursiers en terminale générale professionnelle ayant reçu une proposition d’admission de la part de l’établissement", "dont boursiers (libellé source erroné : 'générale professionnelle')"),
    ("propositions_autres", "Effectif des autres candidats ayant reçu une proposition d’admission de la part de l’établissement", "Propositions aux autres candidats"),
    # Admis
    ("admis_total", "Effectif total des candidats ayant accepté la proposition de l’établissement (admis)", "Admis (proposition acceptée)"),
    ("admis_filles", "Dont effectif des candidates admises", "dont admises"),
    ("admis_pp", "Effectif des admis en phase principale", "Admis en phase principale"),
    ("admis_pc", "Effectif des admis en phase complémentaire", "Admis en phase complémentaire"),
    ("admis_prop_ouverture_pp", "Dont effectif des admis ayant reçu leur proposition d’admission à l'ouverture de la procédure principale", "Admis ayant reçu leur proposition dès l'ouverture"),
    ("admis_prop_avant_bac", "Dont effectif des admis ayant reçu leur proposition d’admission avant le baccalauréat", "Admis ayant reçu leur proposition avant le bac"),
    ("admis_prop_avant_fin_pp", "Dont effectif des admis ayant reçu leur proposition d’admission avant la fin de la procédure principale", "Admis ayant reçu leur proposition avant la fin de la PP"),
    ("admis_internat", "Dont effectif des admis en internat", "dont admis en internat"),
    ("admis_boursiers_neobac", "Dont effectif des admis boursiers néo bacheliers", "Admis néo-bacheliers boursiers"),
    ("admis_neobac", "Effectif des admis néo bacheliers", "Admis néo-bacheliers"),
    ("admis_bac_general", "Effectif des admis néo bacheliers généraux", "Admis néo-bacheliers généraux"),
    ("admis_bac_techno", "Effectif des admis néo bacheliers technologiques", "Admis néo-bacheliers technologiques"),
    ("admis_bac_pro", "Effectif des admis néo bacheliers professionnels", "Admis néo-bacheliers professionnels"),
    ("admis_autres", "Effectif des autres candidats admis", "Autres admis (non néo-bacheliers)"),
    ("admis_mention_inconnue", "Dont effectif des admis néo bacheliers sans information sur la mention au bac", "Admis néo-bac : mention inconnue"),
    ("admis_sans_mention", "Dont effectif des admis néo bacheliers sans mention au bac", "Admis néo-bac : sans mention"),
    ("admis_mention_ab", "Dont effectif des admis néo bacheliers avec mention Assez Bien au bac", "Admis néo-bac : mention AB"),
    ("admis_mention_b", "Dont effectif des admis néo bacheliers avec mention Bien au bac", "Admis néo-bac : mention B"),
    ("admis_mention_tb", "Dont effectif des admis néo bacheliers avec mention Très Bien au bac", "Admis néo-bac : mention TB"),
    ("admis_mention_tbf", "Dont effectif des admis néo bacheliers avec mention Très Bien avec félicitations au bac", "Admis néo-bac : mention TB félicitations"),
    ("admis_mention_bac_general", "Effectif des admis néo bacheliers généraux ayant eu une mention au bac", "Admis bac général avec mention"),
    ("admis_mention_bac_techno", "Effectif des admis néo bacheliers technologiques ayant eu une mention au bac", "Admis bac techno avec mention"),
    ("admis_mention_bac_pro", "Effectif des admis néo bacheliers professionnels ayant eu une mention au bac", "Admis bac pro avec mention"),
    ("admis_meme_etablissement", "Dont effectif des admis issus du même établissement (BTS/CPGE)", "Admis issus du même lycée (BTS/CPGE)"),
    ("admis_meme_academie", "Dont effectif des admis issus de la même académie", "Admis issus de la même académie"),
    ("admis_meme_academie_pcv", "Dont effectif des admis issus de la même académie (Paris/Créteil/Versailles réunies)", "Idem, Paris/Créteil/Versailles réunies"),
    # Accès
    ("taux_acces", "TAUX", "Taux d'accès (%) : part des candidats ayant pu recevoir une proposition. Définition source différente en 2021"),
]

TEXT_COLS = {"cod_aff_form", "statut_etablissement", "code_uai", "etablissement", "code_departement", "departement",
             "region", "academie", "commune", "gps", "type_formation", "filiere", "formation", "mention_specialite",
             "parcours", "selectivite", "concours", "lien_parcoursup"}
FLOAT_COLS = {"taux_acces"}
INT_COLS = [c for c, _, _ in COLUMNS if c not in TEXT_COLS | FLOAT_COLS | {"session"}]

TAUX_2021 = "Taux d’accès des candidats ayant postulé à la formation (ratio entre le dernier appelé et le nombre vœux PP)"
TAUX_2022 = "Taux d’accès"

REGIONS = {
    "Ile-de-France": "Île-de-France",
    "Centre": "Centre-Val de Loire",
    "Grand-Est": "Grand Est",
    "Nouvelle Aquitaine": "Nouvelle-Aquitaine",
    "Pays-de-la-Loire": "Pays de la Loire",
    "Provence Alpes Côte d'Azur": "Provence-Alpes-Côte d'Azur",
    "Provence-Alpes-Côte d’Azur": "Provence-Alpes-Côte d'Azur",
    "Réunion": "La Réunion",
    "Etranger": "Étranger",
}
ACADEMIES = {"Besancon": "Besançon", "Polynésie Française": "Polynésie française", "Etranger": "Étranger"}
# Région manquante (2024-2025) déduite de l'académie
REGION_FROM_ACADEMIE = {"Polynésie française": "Polynésie française", "Étranger": "Étranger",
                        "Nouvelle-Calédonie": "Nouvelle-Calédonie"}
OUTRE_MER = {"Guadeloupe", "Martinique", "Guyane", "La Réunion", "Mayotte", "Polynésie française",
             "Nouvelle-Calédonie", "Saint-Martin"}
TYPES = {"Licence_Las": "L.AS", "Ecole d'Ingénieur": "École d'ingénieurs", "Ecole de Commerce": "École de commerce"}
SELECTIVITE = {"formation sélective": "Sélective", "formation non sélective": "Non sélective"}


def clean_text(s: pd.Series) -> pd.Series:
    return s.astype("string").str.replace("\xa0", " ").str.replace(r"\s+", " ", regex=True).str.strip().replace("", pd.NA)


def resolve_special(df: pd.DataFrame, year: int) -> dict:
    """Colonnes dont le nom source dépend de l'année."""
    a, b = "Filière de formation", "Filière de formation.1"
    agregee, detaillee = (a, b) if df[a].nunique() < df[b].nunique() else (b, a)
    key = "COD_AFF_FORM" if "COD_AFF_FORM" in df.columns else "cod_aff_form"
    taux = TAUX_2021 if TAUX_2021 in df.columns else TAUX_2022
    return {"FILIERE_AGREGEE": agregee, "FILIERE_DETAILLEE": detaillee, "KEY": key, "TAUX": taux}


def load_year(year: int):
    t = time.time()
    raw = pd.read_excel(os.path.join(SRC_DIR, f"{year}.xlsx"), dtype=object)
    raw.columns = [str(c) for c in raw.columns]  # pandas suffixe le doublon en "Filière de formation.1"
    raw = raw.dropna(how="all")
    special = resolve_special(raw, year)
    out = pd.DataFrame(index=raw.index)
    for name, src, _ in COLUMNS:
        src = special.get(src, src)
        if src not in raw.columns:
            raise KeyError(f"{year}: colonne source introuvable pour '{name}' -> {src!r}")
        out[name] = raw[src]
    print(f"  {year}: {len(raw):>6,} lignes  (filière agrégée = {special['FILIERE_AGREGEE']!r}, taux = {special['TAUX'][:20]!r}...)  {time.time() - t:.1f}s")
    return out, raw, special


def transform(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["session"] = pd.to_numeric(df["session"]).astype("Int64")
    for c in TEXT_COLS:
        df[c] = clean_text(df[c])
    for c in INT_COLS:
        df[c] = pd.to_numeric(df[c], errors="raise").round().astype("Int64")
    df["taux_acces"] = pd.to_numeric(df["taux_acces"], errors="raise").astype("Float64")

    df["region"] = df["region"].replace(REGIONS)
    df["academie"] = df["academie"].replace(ACADEMIES)
    df["region"] = df["region"].fillna(df["academie"].map(REGION_FROM_ACADEMIE))
    df["type_formation"] = df["type_formation"].replace(TYPES)
    df["selectivite"] = df["selectivite"].replace(SELECTIVITE)

    # Code département manquant -> déduit du nom du département (autres lignes)
    dep_map = df.dropna(subset=["code_departement"]).groupby("departement")["code_departement"].agg(lambda s: s.mode().iat[0])
    df["code_departement"] = df["code_departement"].fillna(df["departement"].map(dep_map))

    # Secteur public / privé + zone géographique
    df["secteur"] = df["statut_etablissement"].map(lambda s: pd.NA if pd.isna(s) else ("Public" if s == "Public" else "Privé")).astype("string")
    df["zone"] = df["region"].map(lambda r: pd.NA if pd.isna(r) else ("Étranger" if r == "Étranger" else "Outre-mer" if r in OUTRE_MER else "Métropole")).astype("string")

    # GPS "48.8452, 2.39666" -> latitude / longitude
    gps = df["gps"].str.extract(r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$")
    df["latitude"] = pd.to_numeric(gps[0]).astype("Float64")
    df["longitude"] = pd.to_numeric(gps[1]).astype("Float64")
    df = df.drop(columns="gps")

    order = [c for c, _, _ in COLUMNS if c != "gps"]
    order.insert(order.index("statut_etablissement") + 1, "secteur")
    order.insert(order.index("region") + 1, "zone")
    order.insert(order.index("commune") + 1, "latitude")
    order.insert(order.index("latitude") + 1, "longitude")
    return df[order]


def validate(df: pd.DataFrame, raws: dict, specials: dict):
    print("\n  Contrôles")
    errors = []
    for y in SESSIONS:
        part, raw = df[df.session == y], raws[y]
        if len(part) != len(raw):
            errors.append(f"{y}: {len(part)} lignes vs {len(raw)} en source")
        for name, src, _ in COLUMNS:
            if name in INT_COLS or name == "taux_acces":
                src = specials[y].get(src, src)
                s_src = pd.to_numeric(raw[src]).sum()
                s_out = part[name].astype("Float64").sum()
                if abs(s_src - s_out) > 0.5 + 1e-6 * abs(s_src):
                    errors.append(f"{y}: somme {name} {s_out} != source {s_src}")
                if raw[src].notna().sum() != part[name].notna().sum():
                    errors.append(f"{y}: valeurs non nulles {name} différentes de la source")
    dup = df.duplicated(["session", "cod_aff_form"]).sum()
    if dup:
        errors.append(f"{dup} doublons (session, cod_aff_form)")
    known = set(REGIONS.values()) | set(REGION_FROM_ACADEMIE.values()) | OUTRE_MER | {
        "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne", "Corse", "Hauts-de-France", "Normandie", "Occitanie"}
    unknown = set(df["region"].dropna()) - known
    if unknown:
        errors.append(f"régions non reconnues : {unknown}")
    for c in ["region", "academie", "code_departement", "type_formation", "filiere", "formation", "selectivite", "statut_etablissement"]:
        n = df[c].isna().sum()
        print(f"    valeurs manquantes {c:<22} {n}")
    print(f"    formations avec GPS : {df['latitude'].notna().mean():.1%}")
    print(f"    régions : {df['region'].nunique()} | académies : {df['academie'].nunique()} | types : {sorted(df['type_formation'].unique())}")
    if errors:
        print("  ÉCHEC :")
        for e in errors:
            print("   -", e)
        sys.exit(1)
    print("    OK : lignes, sommes et valeurs non nulles identiques aux sources ; clé (session, cod_aff_form) unique")


def main():
    t0 = time.time()
    print("=" * 70 + "\n  FUSION PARCOURSUP 2021-2025\n" + "=" * 70)
    parts, raws, specials = [], {}, {}
    for y in SESSIONS:
        out, raw, special = load_year(y)
        parts.append(out)
        raws[y], specials[y] = raw, special
    df = transform(pd.concat(parts, ignore_index=True))
    validate(df, raws, specials)

    os.makedirs(OUT_DIR, exist_ok=True)
    csv_path = os.path.join(OUT_DIR, "parcoursup_2021_2025.csv")
    xlsx_path = os.path.join(OUT_DIR, "parcoursup_2021_2025.xlsx")
    dict_path = os.path.join(OUT_DIR, "dictionnaire_colonnes.csv")

    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"\n  CSV  -> {csv_path} ({os.path.getsize(csv_path) / 1e6:.1f} Mo)")

    desc = {n: d for n, _, d in COLUMNS}
    desc.update({"secteur": "Public / Privé (déduit du statut)", "zone": "Métropole / Outre-mer / Étranger",
                 "latitude": "Latitude (depuis 'Coordonnées GPS de la formation')", "longitude": "Longitude"})
    source = {n: s for n, s, _ in COLUMNS}
    source.update({"FILIERE_AGREGEE": None})
    special_src = {"KEY": "COD_AFF_FORM (2021) / cod_aff_form (2022+)",
                   "FILIERE_AGREGEE": "Filière de formation (2e occurrence en 2022+, 1re en 2021)",
                   "FILIERE_DETAILLEE": "Filière de formation (1re occurrence en 2022+, 2e en 2021)",
                   "TAUX": f"{TAUX_2021} (2021) / {TAUX_2022} (2022+)"}
    rows = []
    for c in df.columns:
        s = source.get(c)
        rows.append({"colonne": c, "type": str(df[c].dtype), "description": desc.get(c),
                     "colonne_source": special_src.get(s, s) if s else "calculée",
                     "valeurs_manquantes": int(df[c].isna().sum())})
    pd.DataFrame(rows).to_csv(dict_path, index=False, encoding="utf-8-sig")
    print(f"  Dictionnaire -> {dict_path}")

    t = time.time()
    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name="parcoursup")
        pd.DataFrame(rows).to_excel(w, index=False, sheet_name="dictionnaire")
    print(f"  XLSX -> {xlsx_path} ({os.path.getsize(xlsx_path) / 1e6:.1f} Mo, {time.time() - t:.0f}s)")
    print(f"\n  {len(df):,} lignes x {df.shape[1]} colonnes | terminé en {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
