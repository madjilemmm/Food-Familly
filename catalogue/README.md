# Le catalogue commun

Des recettes que Kaddie a le droit de proposer à toutes les familles. Une recette n'y entre que **complète** :
photo (adresse https), au moins 3 ingrédients, au moins 2 étapes, en français, avec l'origine du texte et la licence de la photo et du texte
(règle : `src/lib/domain/catalogue-commun.ts`, `motifsDeRefus`). Pas de licence connue, pas de recette.

## Ajouter des recettes

1. Un fichier `catalogue/<source>.json` : une liste d'objets `RecetteCatalogue` (voir `themealdb-fr.json`). Les ingrédients sont écrits en français, une ligne chacun (« 400 g de spaghetti »).
2. `npx tsx scripts/catalogue/charger.mts --verifier-photos` vérifie tout (photo qui répond comme une image, licences, complétude) et écrit `supabase/migrations/…_catalogue_graines.sql`.
3. Lancer ce SQL dans Supabase. Les recettes sont chargées **pas encore publiables** : `update catalogue_commun set publiable = true where source = '…';` une fois la licence confirmée.

## Licences admises

`CC0`, `PD`, `CC-BY`, `CC-BY-SA` (mention de l'auteur affichée sur la fiche), `LICENCE-OUVERTE`, `API-AUTORISEE` (source dont les conditions autorisent notre usage, abonnement compris), `KADDIE` (écrit ou photographié par Kaddie).

## Sources

- `themealdb-fr.json` : 20 plats de TheMealDB (https://www.themealdb.com), traduits et adaptés. Minutes et portions estimées par Kaddie (la source ne les donne pas). Les conditions de TheMealDB demandent un abonnement pour publier une application : chargées non publiables, à activer après abonnement.

Marmiton n'est plus qu'un secours (`lib/marmiton.ts`, coupé par `IMPORT_MARMITON=0`) : leurs conditions n'autorisent pas l'extraction de leur base hors usage privé.
