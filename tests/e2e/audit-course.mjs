// Audit : écrans demandés en même temps quand une nouvelle liste s'ouvre (fin de courses, premier téléphone du matin…).
// Question : peut-on obtenir un plat au Menu sans ses ingrédients sur la liste, et la liste se répare-t-elle toute seule ?
import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import { settle } from "./settle.mjs";

const SP = process.env.SP, BASE = "http://localhost:3000";
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
const F = "20000000-0000-4000-8000-000000000001";
const K = "00000000-0000-4000-8000-000000000001", M = "00000000-0000-4000-8000-000000000002";
const GRATIN = "10000000-0000-4000-8000-000000000003";
execSync(`bash ${SP}/restore-base.sh`, { stdio: "ignore" });
execSync(`bash ${SP}/reset.sh`);

const b = await lancer();
const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris" });
const p = settle(await ctx.newPage());
await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
await p.getByLabel("Code famille").fill(" Poulet Test "); await p.getByRole("button", { name: "C'est parti" }).click();
await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Karin" }).click(); await p.waitForURL(/menu/);

const etat = () => sql("select count(*) filter (where selected)||' plat(s), '||(select count(*) from shopping_list_items i where i.trip_id=t.id)||' article(s)' from trip_recipes r right join shopping_trips t on t.id=r.trip_id where t.status<>'done' group by t.id");
const resultats = [];
for (const n of [1, 2, 3, 4, 8]) {
  for (let essai = 1; essai <= 8; essai++) {
    sql("delete from shopping_trips; delete from swipes;");
    sql(`insert into swipes (profile_id, recipe_id, liked, swiped_at, liked_at) values ('${K}','${GRATIN}',true,now(),now()),('${M}','${GRATIN}',true,now(),now());`);
    await Promise.all(Array.from({ length: n }, () => p.request.get(BASE + "/courses").then((r) => r.status())));
    await p.waitForTimeout(700);
    const apres = etat();
    // Un chargement de plus, un seul : la liste se répare-t-elle ?
    await p.request.get(BASE + "/courses"); await p.request.get(BASE + "/menu");
    await p.waitForTimeout(400);
    resultats.push({ n, essai, apres, ensuite: etat() });
  }
}
const parN = {};
for (const r of resultats) {
  const k = r.n;
  parN[k] ??= { essais: 0, plat_sans_article: 0, reste_vide_apres_rechargement: 0 };
  parN[k].essais++;
  if (/1 plat\(s\), 0 article/.test(r.apres)) parN[k].plat_sans_article++;
  if (/1 plat\(s\), 0 article/.test(r.ensuite)) parN[k].reste_vide_apres_rechargement++;
}
console.table(parN);
console.log("Exemples :", JSON.stringify(resultats.filter((r) => /0 article/.test(r.apres)).slice(0, 3)));
await b.close();
