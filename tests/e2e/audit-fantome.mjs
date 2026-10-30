// Audit : une « fin de courses » en double crée une course fantôme : que devient « Pas pris la dernière fois » ?
import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000";
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
const b = await lancer();
async function login(nom) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris" });
  const p = settle(await ctx.newPage());
  await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
  await p.getByLabel("Code famille").fill(" Poulet Test "); await p.getByRole("button", { name: "C'est parti" }).click();
  await p.waitForURL("**/profil"); await p.getByRole("button", { name: nom }).click(); await p.waitForURL(/menu|courses/);
  return p;
}
const texte = async (p) => (await p.locator("main").innerText()).replace(/\s+/g, " ");
async function finir(p) {
  await p.getByRole("button", { name: "J'ai fini les courses" }).click();
  await p.getByRole("button", { name: "Oui, c'est fini" }).click();
  await p.waitForURL("**/courses"); await p.waitForTimeout(1500);
}
async function essai(doublon) {
  execSync(`bash ${SP}/restore-base.sh`, { stdio: "ignore" }); execSync(`bash ${SP}/reset.sh`);
  const karin = await login("Karin"); const madji = await login("Madji");
  await karin.goto(BASE + "/courses");
  const trip = sql("select id from shopping_trips where status<>'done'");
  sql(`insert into shopping_list_items (trip_id, name, aisle, source, checked, cle) values ('${trip}','Café','epicerie','manual',false,'cafe'),('${trip}','Papier toilette','hygiene','manual',false,'papier toilette'),('${trip}','Lait','cremerie','manual',true,'lait')`);
  await karin.goto(BASE + "/courses"); await madji.goto(BASE + "/courses");
  await finir(karin);
  if (doublon) { await madji.getByRole("button", { name: "J'ai fini les courses" }).click(); await madji.getByRole("button", { name: "Oui, c'est fini" }).click(); await madji.waitForTimeout(3500); }
  const lecteur = doublon ? madji : karin;
  await lecteur.goto(BASE + "/courses"); await lecteur.waitForTimeout(1500);
  const t = await texte(lecteur);
  return { doublon, courses: sql("select count(*) filter (where status='done')||' finie(s) dont '||count(*) filter (where status='done' and not exists (select 1 from shopping_list_items i where i.trip_id=t.id))||' vide(s)' from shopping_trips t"), pasPris: /Pas pris la dernière fois/.test(t), bilan: (t.match(/Courses finies ! [^.]*\./) || [""])[0], aAjouter: /À AJOUTER/i.test(t) };
}
console.log("Sans doublon :", JSON.stringify(await essai(false)));
console.log("Avec un second « J'ai fini » sur un écran pas à jour :", JSON.stringify(await essai(true)));
await b.close();
