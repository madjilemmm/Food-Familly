// Prépare le chargement du catalogue commun : lit les fichiers de recettes (catalogue/*.json), refuse tout ce qui n'est pas complet
// (photo, ingrédients, étapes, licence, origine : voir src/lib/domain/catalogue-commun.ts) et écrit une migration SQL à lancer dans Supabase.
//
// Lancer : npx tsx scripts/catalogue/charger.mts [--verifier-photos] [--publiable]
//   --verifier-photos : vérifie que chaque photo répond bien (200, image) avant de l'écrire.
//   --publiable       : les recettes sont proposées aux familles tout de suite. Sans cette option elles sont chargées « pas encore publiables » :
//                       on les active une fois la licence confirmée (update catalogue_commun set publiable = true where source = '…').
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { motifsDeRefus, type RecetteCatalogue } from "../../src/lib/domain/catalogue-commun";

const racine = path.resolve(import.meta.dirname, "../..");
const dossier = path.join(racine, "catalogue");
const verifier = process.argv.includes("--verifier-photos");
const publiable = process.argv.includes("--publiable");
const q = (s: string | null) => (s == null ? "null" : `'${s.replace(/'/g, "''")}'`);

const toutes: RecetteCatalogue[] = fs
  .readdirSync(dossier)
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(dossier, f), "utf8")) as RecetteCatalogue[]);

const admises: RecetteCatalogue[] = [];
const refusees: string[] = [];
const vues = new Set<string>();
for (const r of toutes) {
  const motifs = motifsDeRefus(r);
  const cle = `${r.source}:${r.sourceId}`;
  if (vues.has(cle)) motifs.push("doublon dans les fichiers");
  vues.add(cle);
  if (!motifs.length && verifier) {
    const entete = execFileSync("curl", ["-sI", "-L", "-m", "20", r.photoUrl], { encoding: "utf8" });
    if (!/^HTTP\/\S+ 200/m.test(entete) || !/content-type:\s*image\//i.test(entete)) motifs.push("la photo ne répond pas comme une image");
  }
  if (motifs.length) refusees.push(`${r.titre} (${cle}) : ${motifs.join(", ")}`);
  else admises.push(r);
}

const sql = [
  `-- Recettes du catalogue commun, générées par scripts/catalogue/charger.mts (${admises.length} admises, ${refusees.length} refusées).`,
  `-- Idempotent : une recette déjà chargée (source, source_id) n'est pas remplacée.`,
  ...admises.map(
    (r) =>
      `insert into public.catalogue_commun (source, source_id, titre, photo_url, photo_auteur, photo_licence, texte_licence, attribution_url, attribution_texte, minutes, portions, etapes, ingredients, cuisine, langue, publiable) values (${[
        q(r.source), q(r.sourceId), q(r.titre), q(r.photoUrl), q(r.photoAuteur), q(r.photoLicence), q(r.texteLicence), q(r.attributionUrl), q(r.attributionTexte),
        r.minutes ?? "null", r.portions ?? "null", `${q(JSON.stringify(r.etapes))}::jsonb`, `${q(JSON.stringify(r.ingredients))}::jsonb`, q(r.cuisine), q(r.langue), publiable,
      ].join(", ")}) on conflict (source, source_id) do nothing;`,
  ),
].join("\n");
const sortie = path.join(racine, "supabase/migrations/20261101000002_catalogue_graines.sql");
fs.writeFileSync(sortie, sql + "\n");
console.log(`${admises.length} recettes admises, ${refusees.length} refusées${verifier ? " (photos vérifiées)" : ""} → ${path.relative(racine, sortie)}`);
for (const r of refusees) console.log("  refusée :", r);
process.exit(refusees.length ? 1 : 0);
