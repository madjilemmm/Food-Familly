import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import fs from "node:fs";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000";
const shot = (p, n) => p.screenshot({ path: `${SP}/shots/${n}.png` });
const b = await lancer();
const errors = [];
const ok = (c, m) => { if (!c) throw new Error("ÉCHEC: " + m); console.log("✓", m); };
async function ctxPage(name) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris" });
  const p = settle(await ctx.newPage());
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  p.on("dialog", (d) => d.accept());
  return { ctx, p };
}
async function skipInstall(p) {
  // L'accueil ne montre qu'« Commencer » : le champ du code s'ouvre avec « J'ai déjà un code ».
  await p.getByRole("button", { name: "J'ai déjà un code" }).click();
  await p.getByLabel("Code famille").waitFor();
}
async function join(name, code) {
  const { ctx, p } = await ctxPage(name);
  await p.goto(BASE); await skipInstall(p);
  await p.getByLabel("Code famille").fill(code); await p.getByRole("button", { name: "C'est parti" }).click();
  await p.waitForURL("**/profil"); await p.getByRole("button", { name }).click();
  await plusTard(p);
  await p.waitForURL(/\/(menu|envies|courses)/); await p.goto(BASE + "/envies"); return { ctx, p };
}
/** Le questionnaire de goûts apparaît à la première connexion : on le passe. */
async function plusTard(p) {
  await p.waitForURL(/\/(menu|envies|courses|profil\/gouts)/);
  if (p.url().includes("/profil/gouts")) await p.getByRole("button", { name: "Plus tard" }).click();
}

// 1. Ancien cookie converti sans ressaisir le code
{ const { ctx, p } = await ctxPage("legacy");
  await ctx.addCookies([{ name: "ff_session", value: fs.readFileSync(`${SP}/legacy-madji`, "utf8"), url: BASE }]);
  await p.goto(BASE + "/enfant/courses"); await p.waitForLoadState();
  ok(p.url().endsWith("/courses"), `ancien cookie converti → ${new URL(p.url()).pathname}`); await ctx.close(); }

// 2. Mauvais code puis code « Poulet Test » (casse/espaces tolérés)
const { p: karin } = await (async () => {
  const { ctx, p } = await ctxPage("Karin"); await p.goto(BASE); await skipInstall(p);
  await shot(p, "40-bienvenue");
  await p.getByLabel("Code famille").fill("faux-code"); await p.getByRole("button", { name: "C'est parti" }).click();
  await p.getByText("Ce code ne correspond").waitFor(); ok(true, "mauvais code refusé");
  await p.getByLabel("Code famille").fill("  Poulet Test "); await p.getByRole("button", { name: "C'est parti" }).click();
  await p.waitForURL("**/profil"); await shot(p, "41-profil");
  await p.getByRole("button", { name: "Karin" }).click(); await p.waitForURL("**/menu"); await p.goto(BASE + "/envies"); return { ctx, p };
})();
ok(karin.url().endsWith("/envies"), "Karin arrive sur les envies");
const { p: madji } = await join("Madji", "poulet-test");
ok(madji.url().endsWith("/envies"), "Madji arrive sur les envies");
const { p: yoalem } = await join("Yoalem", "poulet-test");

// 3. Madji part faire les courses : la liste est déjà là, il prévient seulement la famille
await madji.goto(BASE + "/courses", { waitUntil: "networkidle" }); await shot(madji, "42-fun-courses");
ok(await madji.getByText(/Faire ma liste|Je pars faire les courses dans/).count() === 0, "pas de course à lancer : la liste est déjà là");
await madji.getByRole("button", { name: "Je pars faire les courses" }).click(); await madji.getByText(/La famille est prévenue/).first().waitFor();
await shot(madji, "43-fun-je-pars"); ok(true, "Madji prévient la famille");

// 4. Karin le voit, et ajoute un article à la même liste
await karin.goto(BASE + "/envies"); await karin.getByText(/Madji fait les courses/).waitFor(); ok(true, "Karin voit que Madji fait les courses");
await karin.goto(BASE + "/courses"); await shot(karin, "44-simple-liste");
ok(await karin.getByRole("button", { name: "Je pars faire les courses" }).count() === 0, "un seul « Je pars » à la fois");
await karin.fill("input[name=article]", "Yaourts"); await karin.getByLabel("Ajouter l'article").click(); await karin.waitForTimeout(1000);

// 5. Madji voit l'article de Karin sur sa liste
await madji.reload(); await madji.getByText("Yaourts", { exact: true }).waitFor(); await shot(madji, "45-fun-liste");
ok(true, "Madji voit l'article de Karin sur la liste");

// 6. Matchs à la majorité (2 sur 3) : le plat va au Menu, ses ingrédients sur la liste
await yoalem.goto(BASE + "/envies"); const t = (await yoalem.locator("h2").last().textContent()).trim();
await yoalem.getByRole("button", { name: "Miam", exact: true }).click(); await yoalem.waitForTimeout(700);
await karin.goto(BASE + "/envies"); await shot(karin, "47-simple-swipe");
// Une seule envie (Yoalem) : la voix de Karin ferait le match, la carte arrive en premier.
ok((await karin.locator("h2").last().textContent()).trim() === t, `Karin voit d'abord « ${t} » (ta voix fait le match)`);
ok(await karin.getByText("Ta voix fait le match").count() === 1, "la carte le dit");
await karin.getByRole("button", { name: "Miam", exact: true }).click(); await karin.getByText(/et toi :/).first().waitFor({ timeout: 5000 });
await karin.waitForTimeout(500); await shot(karin, "48-simple-match"); ok(true, "2 likes sur 3 = match (majorité)");
ok(await karin.getByText(/\d+ articles? dans le caddie/).count() === 1, "le match va au Menu");
await madji.reload(); await madji.getByText(`pour ${t}`).first().waitFor(); ok(true, "ses ingrédients arrivent sur la liste de Madji");

// 7. Nouvelle famille
const { ctx: nctx, p: anne } = await ctxPage("Anne"); await anne.goto(BASE);
await anne.getByRole("link", { name: "Commencer" }).click(); await anne.waitForURL("**/bienvenue/creer");
// Créer sa famille : son prénom (le nom de famille est facultatif), une question, puis le swipe.
await anne.getByLabel("Ton prénom").fill("Anne");
await anne.screenshot({ path: `${SP}/shots/49-creer-famille.png`, fullPage: true });
await anne.getByRole("button", { name: "Voir ce soir" }).click(); await anne.waitForURL("**/menu");
await anne.goto(BASE + "/envies");
ok(true, "Anne arrive sur Ce soir, puis sur les envies");
await anne.goto(BASE + "/reglages");
const code = (await anne.locator("[data-code]").textContent()).trim();
await anne.goto(BASE + "/famille");
await anne.screenshot({ path: `${SP}/shots/50-famille-creee.png`, fullPage: true });
ok(/^[a-z]+-\d{4}-[a-z]+$/.test(code), `famille créée, code ${code}`);
// Anne ajoute Léo depuis Ma famille
await anne.getByRole("button", { name: "Ajouter un membre" }).click();
await anne.getByLabel("Prénom").fill("Léo"); await anne.getByRole("button", { name: "Ajouter", exact: true }).click();
await anne.getByText("Léo").first().waitFor(); ok(true, "Léo ajouté dans Ma famille");
await anne.goto(BASE + "/recettes"); const nb = await anne.locator("main li, ul li").count();
ok(nb >= 10, `10 recettes de départ (${nb})`);
await anne.goto(BASE + "/courses"); ok(await anne.getByText(/Madji/).count() === 0, "aucune donnée de l'autre famille visible");
// Léo rejoint avec le code
const { p: leo } = await join("Léo", code.toUpperCase());
ok(leo.url().endsWith("/envies"), "Léo rejoint avec le code (en majuscules) → /envies");
// Quelqu'un s'ajoute lui-même
const { ctx: zctx, p: zoe } = await ctxPage("Zoé"); await zoe.goto(BASE); await skipInstall(zoe);
await zoe.getByLabel("Code famille").fill(code); await zoe.getByRole("button", { name: "C'est parti" }).click();
await zoe.waitForURL("**/profil"); await zoe.getByRole("link", { name: /Je ne suis pas dans la liste/ }).click();
await zoe.getByLabel("Prénom").fill("Zoé"); await zoe.getByRole("button", { name: "C'est parti" }).click();
await plusTard(zoe); await zoe.waitForURL("**/menu"); ok(true, "Zoé s'ajoute elle-même à la famille");
// Anne retire Zoé
await anne.goto(BASE + "/famille"); await anne.getByRole("button", { name: "Retirer Zoé" }).click(); await anne.getByRole("button", { name: "Oui, retirer Zoé" }).click(); await anne.waitForTimeout(1200);
await anne.reload(); ok(await anne.getByText("Zoé").count() === 0, "Anne retire Zoé de la famille");
await anne.screenshot({ path: `${SP}/shots/51-famille-membres.png`, fullPage: true });

console.log(errors.length ? "ERREURS NAVIGATEUR:\n" + errors.join("\n") : "aucune erreur navigateur");
await b.close();
