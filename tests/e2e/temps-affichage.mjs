// Le temps d'un affichage avec un réseau lent entre l'appli et la base (démarrer le faux Supabase avec LATENCE_MS=80).
// Usage : ETAT=decide PAGE=/menu node tests/e2e/temps-affichage.mjs   (5 mesures, la médiane est affichée)
import { devices } from "@playwright/test";
import { execSync } from "node:child_process";
import { lancer } from "./navigateur.mjs";
import { settle } from "./settle.mjs";

const SP = process.env.SP, BASE = "http://localhost:3000";
const PAGE = process.env.PAGE ?? "/menu", ETAT = process.env.ETAT ?? "proposition";
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
execSync(`bash ${SP}/restore-base.sh`, { stdio: "ignore" });
execSync(`bash ${SP}/reset.sh`);
const K = "00000000-0000-4000-8000-000000000001", M = "00000000-0000-4000-8000-000000000002";
sql(`insert into swipes (profile_id, recipe_id, liked, swiped_at, liked_at) values ('${K}','10000000-0000-4000-8000-000000000003',true,now(),now()),('${M}','10000000-0000-4000-8000-000000000003',true,now(),now());`);
if (ETAT === "decide") sql(`insert into ce_soir_choix (family_id, jour, recipe_id, choisi_par) values ('20000000-0000-4000-8000-000000000001', (now() at time zone 'Europe/Paris')::date, '10000000-0000-4000-8000-000000000003', '${M}')`);
const b = await lancer();
const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris" });
const p = settle(await ctx.newPage());
await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
await p.getByLabel("Code famille").fill(" Poulet Test "); await p.getByRole("button", { name: "C'est parti" }).click();
await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Karin" }).click(); await p.waitForURL(/menu/);
await p.request.get(BASE + PAGE);
const mesures = [];
for (let i = 0; i < 5; i++) {
  const t0 = Date.now();
  await (await p.request.get(BASE + PAGE)).body();
  mesures.push(Date.now() - t0);
}
mesures.sort((a, c) => a - c);
console.log(`${PAGE} (${ETAT}), latence base ${process.env.LATENCE_MS ?? 0} ms : médiane ${mesures[2]} ms (de ${mesures[0]} à ${mesures[4]})`);
await b.close();
