"""
Export du jeu fusionné vers le format compact utilisé par l'app web (web/data/parcoursup.json).

Format colonnaire :
  n          nombre de lignes
  dims       {nom: {"values": [...libellés], "codes": [index par ligne]}}   (textes répétés)
  measures   {nom: [entier ou null par ligne]}                              (effectifs)
  floats     {nom: [nombre ou null par ligne]}                              (taux, coordonnées)
  keys       {"cod_aff_form": [...]}                                        (identifiant formation)
"""
import json
import os
import sys
import time

import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "Data", "processed", "parcoursup_2021_2025.csv")
OUT = os.path.join(BASE, "web", "data", "parcoursup.json")

DIMS = ["session", "type_formation", "filiere", "formation", "selectivite", "secteur", "statut_etablissement",
        "region", "zone", "academie", "departement", "code_departement", "commune", "etablissement"]
FLOATS = ["taux_acces", "latitude", "longitude"]
EXCLUDE = {"cod_aff_form", "code_uai", "mention_specialite", "parcours", "concours", "lien_parcoursup"}


def main():
    t0 = time.time()
    df = pd.read_csv(SRC, encoding="utf-8-sig", low_memory=False,
                     dtype={"cod_aff_form": str, "code_departement": str, "code_uai": str})
    measures = [c for c in df.columns if c not in set(DIMS) | set(FLOATS) | EXCLUDE]

    out = {"n": len(df), "dims": {}, "measures": {}, "floats": {}, "keys": {}}
    for c in DIMS:
        s = df[c].astype("string").fillna("Non renseigné")
        values = sorted(s.unique(), key=lambda v: (v == "Non renseigné", str(v)))
        idx = {v: i for i, v in enumerate(values)}
        out["dims"][c] = {"values": [str(v) for v in values], "codes": [idx[v] for v in s]}
    for c in measures:
        out["measures"][c] = [None if pd.isna(v) else int(v) for v in df[c]]
    for c in FLOATS:
        out["floats"][c] = [None if pd.isna(v) else round(float(v), 5) for v in df[c]]
    out["keys"]["cod_aff_form"] = df["cod_aff_form"].tolist()

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(df):,} lignes | {len(DIMS)} dimensions | {len(measures)} effectifs | {len(FLOATS)} décimaux")
    print(f"-> {OUT} ({os.path.getsize(OUT) / 1e6:.1f} Mo) en {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
