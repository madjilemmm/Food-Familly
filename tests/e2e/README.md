# Essais de bout en bout

Des scénarios Playwright qui jouent l'application dans un vrai navigateur (Chromium, émulation iPhone/Android) contre une **base
locale** : plusieurs téléphones en même temps, une panne d'écriture, une recette modifiée, les formats d'écran… Ils ne tournent pas
dans le contrôle automatique à chaque envoi (`.github/workflows/controles.yml` lance types, règles de code, tests unitaires et
compilation) : ils demandent PostgreSQL et un PostgREST.

## Ce qu'il faut

- PostgreSQL 16 avec une base `atable` (utilisateur `postgres`, mot de passe `postgres`, `localhost`).
- Le binaire [PostgREST](https://postgrest.org/) dans `tests/e2e/stack/postgrest` (il n'est pas versionné).
- Un navigateur pour Playwright : Chromium par défaut (`CHROMIUM_PATH=/chemin/vers/chromium` pour en désigner un, sinon celui de
  Playwright). **Safari n'est pas couvert par défaut** : `NAVIGATEUR=webkit node tests/e2e/audit-mobile.mjs` lance le moteur de Safari
  (après `npx playwright install webkit`), `NAVIGATEUR=firefox` celui de Firefox. Un vrai iPhone reste à essayer à la main avant une grande mise en ligne.
- `.env.local` avec `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321` et les autres variables de `.env.example` (des valeurs d'essai suffisent).

## Lancer

```bash
export SP=$PWD/tests/e2e/stack          # les scripts y lisent leurs outils et y déposent captures et résultats (non versionnés)
bash $SP/up.sh                           # PostgreSQL, PostgREST (3001), faux Supabase (54321)
bash $SP/restore-base.sh                 # une famille de démonstration (Karin, Madji, Yoalem, code « poulet-test »)
npm run build && npx next start -p 3000 &
node tests/e2e/audit-course.mjs          # un scénario
```

La base de départ (`stack/atable-base.dump`) contient le schéma des migrations de `supabase/migrations` appliquées jusqu'à
`20261030000001`. Pour essayer la version « base migrée jusqu'au bout », lancer ensuite
`psql -h localhost -U postgres -d atable -f supabase/migrations/20261031000001_une_liste_ouverte.sql`.

## Les scénarios

| Fichier | Ce qu'il joue |
|---|---|
| `audit-collectif.mjs` | 12 scénarios à plusieurs téléphones : deux « J'ai fini les courses », deux plats en même temps, « Changer de plat », membre retiré, famille supprimée, code changé, « Je pars », invité en cours de route, mêmes ajouts, deux « Miam », quitter, huit écrans en parallèle. `ONLY=c1,c2` pour en choisir. |
| `audit-course.mjs` | Écrans demandés en même temps sur une liste neuve : jamais un plat sans ses articles. |
| `audit-fantome.mjs` | Fin de courses en double : pas de course fantôme. |
| `audit-atomique.mjs` | Une panne d'écriture en route n'efface ni les interdits d'une personne ni les ingrédients d'une recette. |
| `audit-recette-liste.mjs` | Une recette du Menu modifiée ou supprimée : la liste suit. |
| `audit-virgule.mjs` | Un titre de recette avec une virgule : le texte et le bouton de « Ce soir » restent justes. |
| `audit-requetes.mjs` | Combien de requêtes à la base par écran. |
| `audit-mobile.mjs`, `viewport-prevenir.mjs`, `viewport-soir.mjs` | Débordements, champs sous 16 px, cibles tactiles, « Ce soir » au-dessus des onglets sur 5 à 7 formats. |
| `audit-404.mjs` | Page introuvable. |
| `memoire.mjs` | La mémoire de la maison : « On refait ? », « Prévenir la famille ? », « La dernière fois ». |
| `e2e.mjs`, `parcours.mjs`, `premiere-verif.mjs`, `familles.mjs`, `qa.mjs`, `qa2.mjs`, `gouts.mjs`, `etapes.mjs`, `cuisine.mjs`, `chargement.mjs` | Les parcours de bout en bout (entrée, swipe, match, liste, goûts, étapes). |

Les scripts `audit-*` **observent et affichent** ce qu'ils voient ; relire leur sortie avant de conclure. Les règles qu'ils protègent
(allergènes, quantités, titres, pages de lecture) sont aussi couvertes par des tests unitaires (`npm test`).
| `audit-finition.mjs` | La finition mobile : débordements, zones tactiles, un seul h1, texte ≥ 12 px, « Ce soir » à texte agrandi, paysage, clavier dans « Je cuisine ». |
| `audit-catalogue.mjs` | Le catalogue commun : recettes complètes avec photo, sécurité alimentaire, mémoire des refus, rien d'ajouté deux fois, aucun appel à Marmiton (lancer l'appli avec `IMPORT_MARMITON=0`). |
| `audit-marmiton.mjs` | Diagnostic manuel du bug Marmiton avec la vraie source (réseau requis). |

