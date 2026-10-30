// Combien de requêtes à la base pour « Ce sera ça » (l'action seule), puis pour l'écran qui suit (journal de PostgreSQL : log_statement = 'all').
import { devices } from "@playwright/test";
import { execSync } from "node:child_process";
import { lancer } from "./navigateur.mjs";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000";
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
execSync(`bash ${SP}/restore-base.sh`, { stdio: "ignore" }); execSync(`bash ${SP}/reset.sh`);
const K = "00000000-0000-4000-8000-000000000001", M = "00000000-0000-4000-8000-000000000002", GRATIN = "10000000-0000-4000-8000-000000000003";
sql(`insert into swipes (profile_id, recipe_id, liked, swiped_at, liked_at) values ('${K}','${GRATIN}',true,now(),now()),('${M}','${GRATIN}',true,now(),now());`);
const b = await lancer();
const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris" });
const p = settle(await ctx.newPage());
await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
await p.getByLabel("Code famille").fill(" Poulet Test "); await p.getByRole("button", { name: "C'est parti" }).click();
await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Karin" }).click(); await p.waitForURL(/menu/);
await p.waitForTimeout(2500);
const compte = async (f) => {
  const debut = new Date(); await f(); await new Promise((r) => setTimeout(r, 1500));
  const limite = debut.toISOString().replace("T", " ").slice(0, 23);
  return execSync("tail -n 20000 /var/log/postgresql/postgresql-16-main.log", { maxBuffer: 1 << 28 }).toString().split("\n").filter((l) => l.slice(0, 23) >= limite && /LOG:  execute/.test(l) && /SELECT|INSERT|UPDATE|DELETE|WITH/.test(l) && !/BEGIN|COMMIT|set_config/.test(l)).length;
};
const post = (commande) => p.evaluate(async (c) => (await fetch("/api/ce-soir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commande: c, recipeId: "10000000-0000-4000-8000-000000000003" }) })).status, commande);
console.log("« Ce sera ça » (action seule) :", await compte(() => post("ceSeraCa")), "requêtes");
console.log("Écran qui suit (GET /menu) :", await compte(() => p.request.get(BASE + "/menu")), "requêtes");
await b.close();
