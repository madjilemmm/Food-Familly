import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import fs from "node:fs";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000";
const sql = (q) => execSync(`PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt -c "${q}"`).toString().trim();
const axeSrc = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const b = await lancer();
const problemes = [];
const ko = (m) => { problemes.push(m); console.log("✗", m); };
const ok = (c, m) => (c ? console.log("✓", m) : ko(m));
async function ctxPage(nom) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
  const p = settle(await ctx.newPage());
  p.on("pageerror", (e) => ko(`${nom} pageerror: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/CERT|WebSocket|Failed to load resource/.test(m.text()) && ko(`${nom} console: ${m.text().slice(0, 160)}`));
  return { ctx, p };
}
async function entrer(p, prenom) {
  await p.goto(BASE + "/");
  await p.getByRole("button", { name: "J'ai déjà un code" }).click();
  await p.getByLabel("Code famille").fill("poulet-test"); await p.getByRole("button", { name: "C'est parti" }).click();
  await p.waitForURL("**/profil"); await p.getByRole("button", { name: prenom }).click(); await p.waitForURL(/menu/);
}
async function axe(p, nom) {
  await p.evaluate(axeSrc);
  const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] })).violations.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0].html.slice(0, 90)}`));
  ok(r.length === 0, `${nom} : accessibilité ${r.length ? r.join(" | ") : "sans violation"}`);
}
// 1. Parcours principal : erreurs console + accessibilité
sql("delete from ce_soir_choix; delete from pas_ce_soir;");
{ const { p } = await ctxPage("Madji"); await entrer(p, "Madji");
  await p.waitForSelector("section[aria-label]"); await axe(p, "Ce soir (proposition)");
  await p.getByRole("button", { name: "Ce sera ça" }).click(); await p.locator("section[aria-label='Le repas de ce soir']").waitFor({ timeout: 30000 });
  await p.waitForTimeout(1500); await axe(p, "Ce soir (décidé)");
  for (const r of ["/envies", "/courses", "/famille", "/reglages", "/recettes"]) { await p.goto(BASE + r); await p.waitForTimeout(1200); await axe(p, r); }
  // « 1 article ira » : un plat à un seul ingrédient
  const un = sql("select count(*) from recipe_ingredients where recipe_id in (select id from recipes where title='Pot-au-feu')");
  ok(un === "8", "données de test attendues");
}
// 2. Base non migrée : la table n'existe pas
sql("alter table ce_soir_choix rename to ce_soir_choix_x");
{ const { p, ctx } = await ctxPage("Madji-nonmigre"); await entrer(p, "Madji");
  await p.waitForSelector("section[aria-label]");
  await p.getByRole("button", { name: "Ce sera ça" }).click();
  const decide = await p.locator("section[aria-label='Le repas de ce soir']").waitFor({ timeout: 15000 }).then(() => true, () => false);
  ok(decide, "base non migrée : « Ce sera ça » passe quand même à « Décidé » (sur ce téléphone)");
  if (decide) { await p.getByRole("button", { name: "Changer de plat" }).click(); await p.locator("section[aria-label='La proposition de ce soir']").waitFor({ timeout: 15000 }).then(() => ok(true, "base non migrée : « Changer de plat » revient à la proposition"), () => ko("changer de plat ne revient pas")); }
  await ctx.close(); }
sql("alter table ce_soir_choix_x rename to ce_soir_choix");
// 3. Famille d'une seule personne, puis sans aucune recette
{ const { p } = await ctxPage("Anne"); await p.goto(BASE + "/");
  await p.getByRole("link", { name: "Commencer" }).click(); await p.waitForURL("**/bienvenue/creer");
  await p.getByLabel("Ton prénom").fill("Anne"); await p.getByRole("button", { name: "Voir ce soir" }).click(); await p.waitForURL("**/menu");
  await p.waitForSelector("section[aria-label]");
  ok(await p.getByRole("button", { name: "Ce sera ça" }).count() === 1, "famille seule : une proposition");
  await axe(p, "Ce soir (famille seule)");
  await p.getByRole("button", { name: "Ce sera ça" }).click(); await p.locator("section[aria-label='Le repas de ce soir']").waitFor({ timeout: 30000 });
  ok(await p.getByText("Décidé").count() === 1, "famille seule : « Décidé »");
  const fam = sql("select id from families where name = 'Famille d''Anne'");
  sql(`delete from ce_soir_choix where family_id='${fam}'; delete from recipes where family_id='${fam}'`);
  await p.goto(BASE + "/menu"); await p.waitForTimeout(1500);
  ok(await p.getByRole("heading", { name: "Ce soir ?" }).count() === 1 && !(await p.locator("body").innerText()).includes("Application error"), "aucune recette : l'écran s'affiche sans erreur");
  await p.goto(BASE + "/envies"); await p.waitForTimeout(1500);
  ok(!(await p.locator("body").innerText()).includes("Application error"), "aucune recette : Idées s'affiche sans erreur");
  await p.goto(BASE + "/courses"); await p.waitForTimeout(1000);
  ok(!(await p.locator("body").innerText()).includes("Application error"), "aucune recette : Caddie s'affiche sans erreur");
}
console.log(problemes.length ? `\n${problemes.length} PROBLÈME(S)` : "\nAucun problème"); await b.close();
