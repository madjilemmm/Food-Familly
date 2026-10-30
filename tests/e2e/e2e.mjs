import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import fs from "node:fs";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000";
const shot = (p, n) => p.screenshot({ path: `${SP}/shots/${n}.png` });
const browser = await lancer();
const mk = () => browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris" });
const errors = [];
async function login(name) {
  const ctx = await mk(); const p = settle(await ctx.newPage());
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !m.text().includes("WebSocket") && errors.push(`${name} console: ${m.text()}`));
  await p.goto(BASE + "/");
  await p.getByRole("button", { name: "J'ai déjà un code" }).click();
  await p.getByLabel("Code famille").fill(" Poulet Test ");
  await p.getByRole("button", { name: "C'est parti" }).click();
  await p.waitForURL("**/profil");
  await p.getByRole("button", { name }).click();
  await p.waitForURL(/menu|envies|courses/); p.arrivee = p.url(); await p.goto(BASE + "/envies");
  return p;
}
const ok = (c, m) => { if (!c) throw new Error("ÉCHEC: " + m); console.log("✓", m); };

// Mauvais code
{ const ctx = await mk(); const p = settle(await ctx.newPage()); await p.goto(BASE);
  await shot(p, "00-installer-iphone"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
  await p.getByLabel("Code famille").fill("faux"); await p.getByRole("button", { name: "C'est parti" }).click();
  await p.getByText("Ce code ne correspond").waitFor(); await shot(p, "01-bienvenue-erreur"); ok(true, "mauvais code refusé"); await ctx.close(); }

const mom = await login("Karin"); await shot(mom, "02-maman-accueil");
ok(mom.arrivee.endsWith("/menu"), "maman arrive sur Ce soir");
// Les anciennes adresses mènent au bon écran
await mom.goto(BASE + "/simple"); ok(mom.url().endsWith("/courses"), "ancienne adresse /simple → /courses");

const madji = await login("Madji"); await shot(madji, "03-enfant-swipe");
const yoalem = await login("Yoalem");

// Madji : like via geste (drag) puis boutons
const title = async (p) => (await p.locator("h2").last().textContent()).trim();
const t1 = await title(madji);
const card = madji.locator(".touch-none").last(); const box = await card.boundingBox();
await madji.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await madji.mouse.down();
for (let i = 1; i <= 10; i++) await madji.mouse.move(box.x + box.width / 2 + i * 25, box.y + box.height / 2 + i * 2);
await shot(madji, "04-enfant-drag"); await madji.mouse.up(); await madji.waitForTimeout(700);
ok((await title(madji)) !== t1, `drag à droite a swipé « ${t1} »`);
const avant = await title(madji);
await madji.getByRole("button", { name: "Bof", exact: true }).click(); await madji.waitForTimeout(500);
await madji.getByRole("button", { name: "Annuler" }).click(); await madji.waitForTimeout(600);
ok((await title(madji)) === avant, "« Annuler » : la carte swipée revient");
await madji.getByRole("button", { name: "Miam", exact: true }).click(); await madji.waitForTimeout(500);
await madji.getByRole("button", { name: "Bof", exact: true }).click(); await madji.waitForTimeout(500);

// Yoalem : like les 2 premiers -> match sur le premier, qui va tout seul au Menu
const tMatch = await title(yoalem);
await yoalem.getByRole("button", { name: "Miam", exact: true }).click();
await yoalem.getByText(/en avez envie|et toi :/).first().waitFor({ timeout: 5000 }); await yoalem.waitForTimeout(600);
await shot(yoalem, "05-enfant-match"); ok(true, "bandeau de match affiché");
ok(await yoalem.getByText(/\d+ articles? dans le caddie/).count() === 1, `match « ${tMatch} » : ajouté au Menu`);
await yoalem.getByRole("button", { name: "Miam", exact: true }).click(); await yoalem.waitForTimeout(800);
await yoalem.goto(BASE + "/menu"); await shot(yoalem, "06-enfant-menu");
ok(await yoalem.getByRole("button", { name: `Retirer ${tMatch} du Menu` }).count() === 1, "le match est au Menu");

// Maman : la liste est déjà prête, personne n'a lancé de course
await mom.goto(BASE + "/courses"); await shot(mom, "07-maman-liste-prete");
ok(await mom.getByText(/Pour ce qu.on mange :/).count() === 1 && await mom.locator("main p", { hasText: "Pour ce qu'on mange" }).getByText(tMatch, { exact: false }).count() === 1, "maman : la liste est prête, sans lancer de course");
ok(await mom.getByText(`pour ${tMatch}`).count() > 0, "les ingrédients du plat sont sur la liste");

// Madji ajoute un article à la liste de la famille
await madji.goto(BASE + "/courses");
await madji.fill("input[name=article]", "Céréales chocolat"); await madji.getByLabel("Ajouter l'article").click(); await madji.waitForTimeout(1000);
await shot(madji, "11-enfant-ajout");

// Maman : la liste
await mom.reload(); await mom.getByText("Céréales chocolat", { exact: true }).waitFor();
await mom.screenshot({ path: `${SP}/shots/13-maman-liste-full.png`, fullPage: true }); await shot(mom, "13-maman-liste");
ok(await mom.getByText("Céréales chocolat", { exact: true }).count() === 1, "l'article de Madji est sur la liste de maman");
await mom.fill("input[name=article]", "Papier toilette"); await mom.getByLabel("Ajouter l'article").click(); await mom.waitForTimeout(800);
const first = mom.locator("button[aria-pressed=false]").first(); await first.click(); await mom.waitForTimeout(800);
await mom.reload(); await mom.waitForTimeout(500);
ok(await mom.getByText("Papier toilette").count() === 1, "article libre ajouté");
await mom.getByRole("button", { name: "Retirer Papier toilette" }).click(); await mom.waitForTimeout(500);
await shot(mom, "13c-annuler-article"); await mom.getByRole("button", { name: "Annuler" }).click(); await mom.waitForTimeout(1200);
await mom.reload(); await mom.waitForTimeout(500);
ok(await mom.getByText("Papier toilette").count() === 1, "« Annuler » : l'article retiré revient");
ok(await mom.locator("button[aria-pressed=true]").count() === 1, "coche conservée après rechargement");
await mom.screenshot({ path: `${SP}/shots/14-maman-liste-modifiee.png`, fullPage: true });
// article libre rangé dans son rayon ; ordre du magasin propre au téléphone
const headings = async () => (await mom.locator("main h2, section > h2").allTextContents()).map((t) => t.trim());
ok(await mom.locator("section", { has: mom.getByRole("heading", { name: /Hygiène/ }) }).getByText("Papier toilette").count() === 1, "article libre rangé au rayon hygiène");
const order = await headings(); const idx = (re) => order.findIndex((h) => re.test(h));
ok(idx(/Fruits/) < idx(/Épicerie/) && idx(/Épicerie/) < idx(/Hygiène/), "rayons dans l'ordre du magasin");
// Une envie de maman seule (pas un match) : pas au Menu d'office, mais à un appui
await mom.goto(BASE + "/recettes"); await mom.getByText("Quiche lorraine", { exact: true }).first().click(); await mom.waitForURL(/recettes\/[0-9a-f-]{36}$/);
await mom.getByRole("button", { name: "J'en ai envie" }).click(); await mom.waitForTimeout(1500);
// Un plat de plus au Menu : la liste se met à jour, coches et articles libres conservés
await mom.goto(BASE + "/menu"); await shot(mom, "15-maman-menu");
ok(await mom.getByRole("button", { name: "Retirer Quiche lorraine du Menu" }).count() === 0, "une envie seule n'entre pas d'office au Menu (il faut un match)");
const plus = mom.locator('button[aria-label^="Ajouter "][aria-label$=" au Menu"]').first();
ok(await plus.count() === 1, "d'autres envies, à ajouter d'un appui");
const ajoute = (await plus.getAttribute("aria-label")).slice(8, -8);
await plus.click(); await mom.waitForTimeout(1500);
await mom.goto(BASE + "/courses"); await mom.getByText("Papier toilette").waitFor();
ok(await mom.getByText(`pour ${ajoute}`).count() > 0, `« ${ajoute} » ajouté au Menu : ses ingrédients arrivent sur la liste`);
ok(await mom.locator("button[aria-pressed=true]").count() === 1 && await mom.getByText("Papier toilette").count() === 1, "mise à jour : coches et articles libres conservés");
// « J'en ai déjà » : un ingrédient de recette retiré ne revient pas à la mise à jour
const retirer = mom.locator('button[aria-label^="Retirer "]').first(); const nomRetire = (await retirer.getAttribute("aria-label")).slice(8);
await retirer.click(); await mom.getByText(/déjà à la maison|retiré/).first().waitFor(); await mom.waitForTimeout(800);
await mom.goto(BASE + "/menu"); await mom.getByRole("button", { name: `Retirer ${ajoute} du Menu` }).click(); await mom.getByRole("button", { name: "Pas ce soir" }).click(); await mom.waitForTimeout(1500);
await mom.goto(BASE + "/courses"); await mom.getByText("Papier toilette").waitFor();
ok(await mom.getByText(`pour ${ajoute}`).count() === 0, `« ${ajoute} » retiré du Menu : ses ingrédients quittent la liste`);
ok(await mom.getByRole("button", { name: `Retirer ${nomRetire}`, exact: true }).count() === 0, `« ${nomRetire} » retiré ne revient pas`);

// Recette : création avec photo
await madji.goto(BASE + "/recettes/nouvelle");
await madji.fill("input[name=title]", "Pâtes carbonara");
await madji.getByRole("textbox", { name: "Ingrédient" }).fill("Spaghetti"); await madji.getByLabel("Quantité").fill("500"); await madji.getByLabel("Unité").fill("g");
await madji.getByLabel("Rayon").selectOption("epicerie");
await madji.getByRole("button", { name: "Ajouter un ingrédient" }).click();
await madji.getByRole("textbox", { name: "Ingrédient" }).nth(1).fill("Lardons"); await madji.getByLabel("Quantité").nth(1).fill("200"); await madji.getByLabel("Unité").nth(1).fill("g");
await madji.getByLabel("Rayon").nth(1).selectOption("boucherie");
await madji.setInputFiles("input[type=file]", `${SP}/p.jpg`); await madji.waitForTimeout(800);
await madji.screenshot({ path: `${SP}/shots/16-recette-form.png`, fullPage: true });
await madji.getByRole("button", { name: "Enregistrer" }).click(); await madji.waitForURL("**/recettes");
ok(await madji.getByText("Pâtes carbonara").count() >= 1, "recette créée"); await shot(madji, "17-recettes");
await madji.getByText("Pâtes carbonara", { exact: true }).first().click(); await madji.waitForURL(/recettes\/[0-9a-f-]{36}$/);
ok(await madji.getByRole("heading", { name: "Les étapes" }).count() === 1, "page de la recette");
await madji.getByRole("link", { name: "Modifier" }).click(); await madji.waitForURL(/\/modifier$/);
ok(await madji.locator("img").count() === 1, "photo enregistrée et affichée");
ok(await madji.getByRole("textbox", { name: "Ingrédient" }).count() === 2, "ingrédients enregistrés");

// Fin des courses
await mom.goto(BASE + "/courses"); mom.on("dialog", (d) => d.accept());
await mom.getByRole("button", { name: /J'ai fini les courses/ }).click();
await mom.getByRole("alertdialog").waitFor(); await mom.waitForTimeout(500); await shot(mom, "18-confirmation-kaddie");
await mom.getByRole("button", { name: "Oui, c'est fini" }).click();
// L'écran se recharge sur la nouvelle liste : ce qui n'a pas été pris y est proposé.
await mom.getByRole("button", { name: "Ajouter Papier toilette à la liste" }).waitFor({ timeout: 15000 });
ok(await mom.getByRole("button", { name: "Je pars faire les courses" }).count() === 1, "courses terminées : une nouvelle liste est prête");
// Ce qui n'a pas été pris est proposé (« À ajouter ? »), rien n'est recopié d'office
ok(await mom.getByRole("button", { name: "Ajouter Papier toilette à la liste" }).count() === 1, "articles pas pris proposés aux courses suivantes");
ok(await mom.getByText(`pour ${tMatch}`).count() === 0, "le plat acheté n'est plus sur la nouvelle liste");

// Goût et envie : le plat acheté n'est plus une envie de Madji, mais il l'aime toujours
await madji.goto(BASE + "/menu");
ok(await madji.getByRole("button", { name: `Ajouter ${tMatch} au Menu` }).count() === 0 && await madji.getByRole("button", { name: `Retirer ${tMatch} du Menu` }).count() === 0, "plat acheté : plus au Menu ni en envie (l'envie s'est éteinte)");
ok(await madji.getByText("Déjà acheté, à cuisiner").count() === 1, "le plat acheté est « à cuisiner »");
await madji.goto(BASE + "/recettes"); await madji.getByText(tMatch, { exact: true }).first().click(); await madji.waitForURL(/recettes\/[0-9a-f-]{36}$/);
await madji.getByText("Tu aimes ce plat, sans envie en ce moment.").waitFor(); ok(true, "fiche recette : goût gardé, sans envie");
await madji.getByRole("button", { name: "J'en ai envie" }).click(); await madji.waitForTimeout(1000); await madji.reload();
await madji.getByText("Tu en as envie en ce moment.").waitFor(); ok(true, "fiche recette : l'avis se corrige (envie à nouveau)");

console.log(errors.length ? "ERREURS NAVIGATEUR:\n" + errors.join("\n") : "aucune erreur navigateur");
await browser.close();
