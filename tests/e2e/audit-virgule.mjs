// Audit : un titre de recette avec une virgule (fréquent sur les recettes importées) : le caddie retrouve-t-il ses articles ?
import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000";
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
const K = "00000000-0000-4000-8000-000000000001", M = "00000000-0000-4000-8000-000000000002", GRATIN = "10000000-0000-4000-8000-000000000003";
execSync(`bash ${SP}/restore-base.sh`, { stdio: "ignore" }); execSync(`bash ${SP}/reset.sh`);
// TITRE=« Gratin dauphinois » pour le témoin sans virgule.
const TITRE = process.env.TITRE ?? "Gratin dauphinois, version crème";
sql(`update recipes set title='${TITRE.replace(/'/g, "''")}' where id='${GRATIN}'`);
sql(`insert into swipes (profile_id, recipe_id, liked, swiped_at, liked_at) values ('${K}','${GRATIN}',true,now(),now()),('${M}','${GRATIN}',true,now(),now());`);
const b = await lancer();
const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris" });
const p = settle(await ctx.newPage());
await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
await p.getByLabel("Code famille").fill(" Poulet Test "); await p.getByRole("button", { name: "C'est parti" }).click();
await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Karin" }).click(); await p.waitForURL(/menu/);
await p.goto(BASE + "/menu"); await p.locator("section[aria-label]").first().waitFor();
const titre = (await p.locator("section[aria-label] h2").first().textContent()).trim();
const ligne = async () => (await p.locator(".soir-ligne").first().innerText().catch(() => "—")).replace(/\s+/g, " ");
console.log(`Proposition : « ${titre} » → « ${await ligne()} »  (articles en base : ${sql("select count(*) from shopping_list_items")})`);
if (/Gratin/.test(titre)) {
  await p.getByRole("button", { name: "Ce sera ça" }).click(); await p.locator("section[aria-label='Le repas de ce soir']").waitFor({ timeout: 25000 });
  console.log(`Bouton principal : « ${(await p.locator(".soir-bas .kd-btn").first().innerText()).trim()} » ; `+`Repas décidé : « ${await ligne()} »  (articles en base : ${sql("select count(*) from shopping_list_items")}, étiquette : ${sql("select distinct for_recipes from shopping_list_items")})`);
}
await b.close();
