// Audit performance : combien d'allers-retours base par écran (transactions PostgREST) et quel temps serveur, sur la pile locale.
import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000";
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
const xact = () => Number(sql("select xact_commit from pg_stat_database where datname='atable'"));
const K = "00000000-0000-4000-8000-000000000001", M = "00000000-0000-4000-8000-000000000002", GRATIN = "10000000-0000-4000-8000-000000000003";
execSync(`bash ${SP}/restore-base.sh`, { stdio: "ignore" }); execSync(`bash ${SP}/reset.sh`);
sql(`insert into swipes (profile_id, recipe_id, liked, swiped_at, liked_at) values ('${K}','${GRATIN}',true,now(),now()),('${M}','${GRATIN}',true,now(),now());`);
const b = await lancer();
const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris" });
const p = settle(await ctx.newPage());
await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
await p.getByLabel("Code famille").fill(" Poulet Test "); await p.getByRole("button", { name: "C'est parti" }).click();
await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Madji" }).click(); await p.waitForURL(/menu/);
await p.waitForTimeout(1500); const base = (() => { const a = xact(); const c = xact(); return c - a; })();
async function mesure(nom, chemin, avant) {
  if (avant) await avant();
  await p.request.get(BASE + chemin); // chauffe
  await p.waitForTimeout(1400);
  const a = xact(); const t0 = Date.now();
  const r = await p.request.get(BASE + chemin); const html = await r.body();
  const ms = Date.now() - t0; await p.waitForTimeout(1400); const n = xact() - a - base;
  return { ecran: nom, requetes_base: n, temps_ms: ms, poids_ko: Math.round(html.length / 1024) };
}
const res = [];
res.push(await mesure("Ce soir : proposition", "/menu"));
res.push(await mesure("Caddie", "/courses"));
res.push(await mesure("Idées (swipe)", "/envies"));
res.push(await mesure("La table / famille", "/famille"));
res.push(await mesure("Réglages", "/reglages"));
res.push(await mesure("Recettes", "/recettes"));
await p.goto(BASE + "/menu"); await p.getByRole("button", { name: "Ce sera ça" }).click(); await p.locator("section[aria-label='Le repas de ce soir']").waitFor({ timeout: 25000 });
res.push(await mesure("Ce soir : repas décidé", "/menu"));
// Un « Ce sera ça » complet (l'action serveur) : combien de requêtes ?
sql("delete from ce_soir_choix");
await p.goto(BASE + "/menu"); await p.locator("section[aria-label='La proposition de ce soir']").waitFor();
await p.waitForTimeout(1400);
const a = xact(); const t0 = Date.now();
await p.getByRole("button", { name: "Ce sera ça" }).click(); await p.locator("section[aria-label='Le repas de ce soir']").waitFor({ timeout: 25000 });
const ms2 = Date.now() - t0; await p.waitForTimeout(1400);
res.push({ ecran: "Action « Ce sera ça » + écran qui suit", requetes_base: xact() - a - base, temps_ms: ms2, poids_ko: "" });
console.table(res);
await b.close();
