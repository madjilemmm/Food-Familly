// Le catalogue commun, de bout en bout (base locale, sans réseau) : des recettes complètes arrivent dans « Idées » sans appeler Marmiton,
// la sécurité alimentaire passe avant tout, un plat refusé ne revient jamais, rien n'est ajouté deux fois.
// Prérequis : l'appli lancée avec IMPORT_MARMITON=0, la base de démonstration (stack/restore-base.sh), les migrations du catalogue.
import { devices } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import { lancer } from "./navigateur.mjs";
import { settle } from "./settle.mjs";

const SP = process.env.SP, BASE = "http://localhost:3000";
const JOURNAL = process.env.JOURNAL_APPLI ?? "/tmp/next.log";
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
const K = "00000000-0000-4000-8000-000000000001", M = "00000000-0000-4000-8000-000000000002", Y = "00000000-0000-4000-8000-000000000003";
const resultats = [];
const ok = (cond, msg) => { resultats.push(Boolean(cond)); console.log(`${cond ? "✓" : "✗"} ${msg}`); };

execSync(`bash ${SP}/restore-base.sh`, { stdio: "ignore" }); execSync(`bash ${SP}/reset.sh`);
for (const f of ["20261101000001_catalogue_commun.sql", "20261101000002_catalogue_graines.sql"]) sql(fs.readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), "utf8"));
sql("update catalogue_commun set publiable = true");
// PostgREST relit le schéma après des migrations (Supabase le fait tout seul).
sql("notify pgrst, 'reload schema'");
execSync("sleep 2");
const nbCatalogue = Number(sql("select count(*) from catalogue_commun"));
// Karin ne mange pas de fruits de mer, Yoalem est allergique aux arachides : aucune recette du catalogue qui en contienne.
sql(`insert into profile_tastes (profile_id, food, level) values ('${K}', 'fruits_de_mer', 'interdit'), ('${Y}', 'arachide', 'interdit') on conflict do nothing`);
// Madji a refusé 6 plats de départ : il reste peu de nouveautés, l'import se déclenche à l'ouverture d'« Idées ».
sql(`insert into swipes (profile_id, recipe_id, liked, swiped_at) select '${M}', id, false, now() from recipes order by title limit 6`);

const b = await lancer();
const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris" });
const p = settle(await ctx.newPage());
await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
await p.getByLabel("Code famille").fill(" Poulet Test "); await p.getByRole("button", { name: "C'est parti" }).click();
await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Madji" }).click(); await p.waitForURL(/menu|envies|courses/);
const nb = () => Number(sql("select count(*) from recipes where catalogue_id is not null"));
async function ronde() {
  const avant = nb();
  sql("update recipes set created_at = created_at - interval '5 minutes' where catalogue_id is not null");
  await p.goto(BASE + "/envies");
  for (let i = 0; i < 20 && nb() === avant; i++) await p.waitForTimeout(1000);
  await p.waitForTimeout(1500);
  return nb() - avant;
}

const a1 = await ronde();
ok(a1 >= 5, `1re ouverture : ${a1} recettes du catalogue ajoutées`);
ok(Number(sql("select count(*) from recipes where catalogue_id is not null and (photo_url is null or photo_url = '')")) === 0, "toutes ont une photo");
ok(Number(sql("select count(*) from recipes r where catalogue_id is not null and (select count(*) from recipe_ingredients i where i.recipe_id = r.id) < 3")) === 0, "toutes ont au moins 3 ingrédients");
ok(Number(sql("select count(*) from recipes where catalogue_id is not null and (steps is null or jsonb_array_length(steps) < 2)")) === 0, "toutes ont au moins 2 étapes");
const dangereuses = sql(`select r.title from recipes r join recipe_ingredients i on i.recipe_id = r.id where r.catalogue_id is not null and (i.name ~* '(crevette|cacahu)')`);
ok(dangereuses === "", `aucune recette avec fruits de mer ou arachides pour cette famille${dangereuses ? " : " + dangereuses : ""}`);
ok(!fs.readFileSync(JOURNAL, "utf8").includes("Import Marmiton :"), "aucun appel à Marmiton");

// L'utilisateur refuse tout ce qui vient d'arriver ; il rouvre « Idées ».
const premieres = sql("select catalogue_id from recipes where catalogue_id is not null").split("\n");
sql(`insert into swipes (profile_id, recipe_id, liked, swiped_at) select '${M}', id, false, now() from recipes where catalogue_id is not null on conflict do nothing`);
const a2 = await ronde();
const toutes = sql("select catalogue_id from recipes where catalogue_id is not null").split("\n");
ok(a2 >= 1, `2e ouverture : ${a2} recettes de plus`);
ok(new Set(toutes).size === toutes.length, "aucune recette du catalogue n'est ajoutée deux fois");
ok(premieres.every((id) => toutes.includes(id)), "les recettes refusées sont toujours là, avec leur « Bof »");
ok(Number(sql(`select count(*) from swipes where recipe_id in (select id from recipes where catalogue_id is not null)`)) >= premieres.length, "les refus sont gardés");
// Une recette du catalogue affiche son origine.
const id = sql("select id from recipes where catalogue_id is not null limit 1");
await p.goto(BASE + `/recettes/${id}`);
ok(/TheMealDB/.test(await p.locator("main").innerText()), "la fiche indique l'origine de la recette (TheMealDB)");
ok(nbCatalogue >= 20, `${nbCatalogue} recettes dans le catalogue de départ`);

await b.close();
const echecs = resultats.filter((r) => !r).length;
console.log(`\n${resultats.length - echecs}/${resultats.length} vérifications passent`);
process.exit(echecs ? 1 : 0);
