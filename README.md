# Projet Dataviz — Parcoursup 2021-2025

Analyse des données open data Parcoursup (sessions 2021 à 2025) : fusion propre des fichiers annuels,
application web de visualisation (Next.js) et assistant IA qui interroge les données.

## Structure

```
Data/
  2021.xlsx … 2025.xlsx           fichiers sources (open data MESR, 118 colonnes)
  processed/
    parcoursup_2021_2025.csv      fichier fusionné (69 240 lignes × 79 colonnes)
    parcoursup_2021_2025.xlsx     idem pour Excel / Power BI (+ feuille « dictionnaire »)
    dictionnaire_colonnes.csv     description, type et colonne source de chaque colonne
scripts/
  01_fusion_parcoursup.py         fusion + harmonisation + contrôles
  02_export_app_data.py           export compact pour l'app (web/data/parcoursup.json)
web/                              application Next.js (dashboard + assistant IA)
```

## 1. Régénérer les données

```bash
python scripts/01_fusion_parcoursup.py     # ~5 min (lecture des 5 xlsx + écriture xlsx)
python scripts/02_export_app_data.py       # ~25 s  -> web/data/parcoursup.json (dashboards)
cd web && npm run data:agent               # ~5 s   -> web/data/parcoursup.parquet + dictionary.json (agent SQL)
```

La fusion associe les colonnes **par nom** (l'ordre change entre 2021 et 2022+), distingue les deux colonnes
homonymes « Filière de formation » (sens inversé entre 2021 et 2022+), harmonise les régions et académies, puis vérifie que
lignes, sommes et valeurs non nulles sont identiques aux sources.

## 2. Lancer l'application

```bash
cd web
cp .env.example .env.local     # puis renseigner GEMINI_API_KEY (gratuit : https://aistudio.google.com/apikey)
npm install
npm run dev                    # http://localhost:3000
```

Pages : Vue d'ensemble · Formations & sélectivité · Territoires (carte) · Profils & équité · Explorer (recherche + fiche
2021-2025) · Assistant IA · Rapport Power BI · Données & méthode.

## Agent d'analyse IA

Agent autonome (boucle de raisonnement jusqu'à 12 étapes) qui mène lui-même l'analyse :

1. il planifie et annonce chaque étape ;
2. il écrit et exécute ses **propres requêtes SQL** (DuckDB, table `formations` : 69 240 lignes × 79 colonnes) ;
3. il lit les résultats, corrige ses erreurs SQL, approfondit (évolutions, comparaisons, corrélations…) ;
4. il crée des graphiques (`create_chart`) et rédige une conclusion avec des questions de relance.

- **Modèles — chaîne d'accès** : Gemini (`gemini-3.8-flash`, `gemini-3.7-flash`) puis **Groq** (`GROQ_API_KEYS`,
  plusieurs clés utilisées à tour de rôle), puis modèles plus légers. Un accès en quota dépassé (429) est mis en pause
  le temps indiqué par le fournisseur ; les messages sont adaptés à chaque fournisseur (prompt compact et résultats
  raccourcis pour Groq, signature neutre pour Gemini), ce qui permet d'alterner en cours d'analyse.
  Diagnostic : `GET /api/agent/status?probe=1` (état des accès, validité des clés, sans quota consommé).
  Tests sans quota : `npm run test:chain` et `npm run test:stream` (faux serveurs locaux).
- **Contexte** : prompt système = méthode + schéma des 79 colonnes + valeurs des colonnes catégorielles + recettes SQL
  des indicateurs + précautions + repères ; historique = 10 derniers échanges avec les requêtes SQL déjà exécutées
  (mémoire de travail pour les relances).
- **Sécurité** : seules les requêtes `SELECT` uniques passent (vérifiées par le parseur DuckDB), accès fichiers/réseau
  désactivé, configuration verrouillée, délai max 10 s par requête, 200 lignes max.
- Code : `web/src/lib/agent/` (db, prompt, tools, llm) et `web/src/app/api/agent/route.ts`.

### Historique et mémoire des conversations

- **Stockage** : IndexedDB du navigateur (`web/src/components/agent/history.ts`), en deux magasins : `meta`
  (liste légère chargée au démarrage) et `data` (messages complets, chargés seulement à l'ouverture). Écriture à la fin
  de chaque réponse, jamais pendant le streaming ; résultats SQL stockés limités à 50 lignes ; 150 conversations
  conservées (les épinglées toujours).
- **Mémoire** : l'agent reçoit les 3 derniers échanges en entier (avec leurs requêtes SQL) + un **résumé** des échanges
  plus anciens, mis à jour en arrière-plan par un modèle léger (`/api/agent/memory`). La taille du contexte reste
  constante quelle que soit la longueur de la conversation. Le résumé est consultable (bouton « Mémoire »).
- **Titres automatiques** après le premier échange (modèle léger, ~2 s), renommables. Recherche, groupes par date,
  épingler, supprimer ; lien direct vers une conversation via `/assistant?c=<id>`.

## Power BI (à venir)

Importer `Data/processed/parcoursup_2021_2025.xlsx` dans Power BI Desktop, publier, puis
*Fichier → Incorporer le rapport → Publier sur le web* et coller l'URL dans `web/.env.local` :
`POWERBI_EMBED_URL=https://app.powerbi.com/view?r=...` — la page « Rapport Power BI » l'affiche.

## Précautions de lecture

- Un **vœu n'est pas un candidat** : chaque candidat formule plusieurs vœux.
- Le **taux d'accès 2021** repose sur une définition source différente.
- Ratios calculés sur des sommes ; taux d'accès moyen pondéré par les vœux en phase principale.
