// Audit : que devient une information de sécurité (interdit alimentaire) ou une recette si l'enregistrement échoue en route ?
// On provoque l'échec de l'INSERT avec un déclencheur local, puis on regarde ce qui reste en base.
import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000";
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
const M = "00000000-0000-4000-8000-000000000002", GRATIN = "10000000-0000-4000-8000-000000000003";
execSync(`bash ${SP}/restore-base.sh`, { stdio: "ignore" }); execSync(`bash ${SP}/reset.sh`);
const b = await lancer();
const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris" });
const p = settle(await ctx.newPage());
await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
await p.getByLabel("Code famille").fill(" Poulet Test "); await p.getByRole("button", { name: "C'est parti" }).click();
await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Madji" }).click(); await p.waitForURL(/menu/);
const echec = (table) => sql(`create or replace function boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$; drop trigger if exists t_boom on ${table}; create trigger t_boom before insert on ${table} for each row execute function boom();`);
const repare = (table) => sql(`drop trigger if exists t_boom on ${table};`);

// 1. Les interdits alimentaires de Madji : arachides et fruits à coque.
sql(`delete from profile_tastes where profile_id='${M}'; insert into profile_tastes (profile_id, food, level) values ('${M}','arachide','interdit'),('${M}','fruits_a_coque','interdit');`);
console.log("Interdits de Madji avant :", sql(`select string_agg(food, ', ' order by food) from profile_tastes where profile_id='${M}'`));
echec("profile_tastes");
await p.goto(BASE + "/profil/gouts?regime=1&suite=/menu");
await p.getByRole("button", { name: /Suivant|C'est noté|C'est parti/ }).first().click();
await p.waitForTimeout(2500);
console.log("Message à l'écran :", ((await p.locator("[role=alert], .text-erreur, p").allInnerTexts()).find((t) => /échou|Réessaie|erreur/i.test(t)) || "(aucun message trouvé)").replace(/\s+/g, " "));
console.log("Interdits de Madji après l'échec :", sql(`select coalesce(string_agg(food, ', ' order by food), '(aucun)') from profile_tastes where profile_id='${M}'`));
repare("profile_tastes");

// 2. Une recette modifiée : le gratin et ses ingrédients.
console.log("\nIngrédients du gratin avant :", sql(`select count(*) from recipe_ingredients where recipe_id='${GRATIN}'`));
echec("recipe_ingredients");
await p.goto(BASE + `/recettes/${GRATIN}/modifier`);
await p.getByLabel(/Nom|Titre/i).first().fill("Gratin dauphinois du dimanche");
await p.getByRole("button", { name: /Enregistrer/ }).first().click();
await p.waitForTimeout(3000);
console.log("Message à l'écran :", ((await p.locator("[role=alert], p").allInnerTexts()).find((t) => /échou|Réessaie|erreur|boom/i.test(t)) || "(aucun message trouvé)").replace(/\s+/g, " "));
console.log("Ingrédients du gratin après l'échec :", sql(`select count(*) from recipe_ingredients where recipe_id='${GRATIN}'`), "; titre :", sql(`select title from recipes where id='${GRATIN}'`));
repare("recipe_ingredients");
await b.close();
