// Quelles requêtes à la base un écran déclenche, et lesquelles reviennent plusieurs fois (journal de PostgreSQL : log_statement = 'all').
// Usage : PAGE=/menu ETAT=decide node tests/e2e/requetes-par-ecran.mjs   (ETAT : proposition | decide)
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
await p.request.get(BASE + PAGE); // chauffe (première compilation, synchronisation du Menu)
await p.waitForTimeout(1200);
const debut = new Date();
await p.request.get(BASE + PAGE);
await p.waitForTimeout(1500);
const horodatage = (l) => l.slice(0, 23);
const limite = debut.toISOString().replace("T", " ").slice(0, 23);
const lignes = execSync("tail -n 20000 /var/log/postgresql/postgresql-16-main.log", { maxBuffer: 1 << 28 }).toString().split("\n")
  .filter((l) => horodatage(l) >= limite && /LOG:  execute/.test(l));
const normal = (l) => l.replace(/^.*LOG:  execute [^:]*: /, "").replace(/WITH pgrst_source AS \(/, "").replace(/\$\d+/g, "$").replace(/\s+/g, " ").slice(0, 130);
const compte = new Map();
for (const l of lignes) compte.set(normal(l), (compte.get(normal(l)) ?? 0) + 1);
console.log(`${PAGE} (${ETAT}) : ${lignes.length} requêtes, ${compte.size} différentes`);
const repetees = [...compte].filter(([, n]) => n > 1).sort((a, c) => c[1] - a[1]);
console.log("Reviennent plusieurs fois :");
for (const [s, n] of repetees.slice(0, 20)) console.log(`  ×${n}  ${s}`);
await b.close();
