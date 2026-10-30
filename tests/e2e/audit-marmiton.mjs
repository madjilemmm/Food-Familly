// Le bug « Marmiton : toujours les mêmes recettes », rejoué avec la vraie source. DIAGNOSTIC MANUEL (il interroge marmiton.org : une dizaine de pages par ronde).
// Lancer l'appli avec NODE_USE_ENV_PROXY=1 si le réseau passe par un proxy. Chaque lancement = une ronde : l'utilisateur a refusé (Bof) tout ce qui
// avait été importé, et ces recettes ont 29 jours ; il rouvre « Idées ». Résultat attendu : 0 recette « déjà proposée avant ».
// Avant la correction : 4 à 9 sur 10 revenaient comme des nouveautés (la recette refusée était supprimée avec son « Bof »).
// Prérequis : base de démonstration (stack/restore-base.sh), un « Bof » de Madji sur 6 recettes de départ pour que l'import se déclenche.
import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { settle } from "./settle.mjs";
import { execSync } from "node:child_process";
import fs from "node:fs";
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
const M = "00000000-0000-4000-8000-000000000002";
const vus = new Set(JSON.parse(fs.existsSync("/tmp/audit-marmiton-vus.json") ? fs.readFileSync("/tmp/audit-marmiton-vus.json", "utf8") : "[]"));
const actuelles = () => sql("select source_url from recipes where source_url is not null").split("\n").filter(Boolean);
// 1. L'utilisateur a refusé (Bof) tout ce qui a été importé ; les cartes ont 29 jours.
const avant = actuelles(); avant.forEach((u) => vus.add(u));
sql(`insert into swipes (profile_id, recipe_id, liked, swiped_at) select '${M}', id, false, now() from recipes where source_url is not null on conflict do nothing`);
sql("update recipes set created_at = now() - interval '29 days' where source_url is not null; update swipes set swiped_at = now() - interval '29 days' where recipe_id in (select id from recipes where source_url is not null)");
// 2. Il rouvre Idées.
const b = await lancer(); const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "fr-FR" }); const p = settle(await ctx.newPage());
await p.goto("http://localhost:3000/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
await p.getByLabel("Code famille").fill(" Poulet Test "); await p.getByRole("button", { name: "C'est parti" }).click();
await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Madji" }).click(); await p.waitForURL(/menu|envies|courses/);
const logs = () => Number(execSync(`grep -c 'Import Marmiton :' ${process.env.JOURNAL_APPLI ?? "/tmp/next.log"} || true`).toString().trim());
const l0 = logs(); await p.goto("http://localhost:3000/envies");
for (let i = 0; i < 50 && logs() === l0; i++) await p.waitForTimeout(2000);
await p.waitForTimeout(1500); await b.close();
const apres = actuelles(); const neuves = apres.filter((u) => !avant.includes(u)); const dejaVues = neuves.filter((u) => vus.has(u));
console.log(`avant: ${avant.length} importées (toutes refusées, vieilles de 29 j) → après: ${apres.length}; nouvelles: ${neuves.length}; parmi elles DÉJÀ PROPOSÉES AVANT : ${dejaVues.length}`);
console.log("recettes de la ronde précédente encore là :", avant.filter((u) => apres.includes(u)).length, "; swipes restants :", sql("select count(*) from swipes"));
fs.writeFileSync("/tmp/audit-marmiton-vus.json", JSON.stringify([...vus, ...neuves]));
