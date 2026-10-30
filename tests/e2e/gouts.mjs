// Questionnaire de goûts : étapes (fun et simple), règles appliquées au swipe et aux recettes.
import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000";
const FAM = "20000000-0000-4000-8000-000000000001";
const sql = (q) => execSync(`PGPASSWORD=postgres psql -h localhost -U postgres -d atable -Atq -c "${q}"`).toString().trim();
const shot = (p, n) => p.screenshot({ path: `${SP}/shots/${n}.png` });
const ok = (c, m) => { if (!c) throw new Error("ÉCHEC: " + m); console.log("✓", m); };
const errors = [];

// Les profils de test n'ont jamais vu le questionnaire ; une recette au canard pour tester.
sql(`update profiles set tastes_seen_at = null, tastes_done_at = null, envies_done_at = null, envies = '{}'::jsonb where family_id = '${FAM}'; delete from profile_tastes`);
const magret = sql(`insert into recipes (family_id, title, emoji) values ('${FAM}', 'Magret de canard au miel', '🍽️') returning id`).split("\n")[0];
sql(`insert into recipe_ingredients (recipe_id, position, name, aisle) values ('${magret}', 1, '2 magrets de canard', 'boucherie'), ('${magret}', 2, 'Miel', 'epicerie')`);

const b = await lancer();
async function login(name) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, locale: "fr-FR" });
  const p = settle(await ctx.newPage());
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
  await p.getByLabel("Code famille").fill("poulet-test"); await p.getByRole("button", { name: "C'est parti" }).click();
  await p.waitForURL("**/profil"); await p.getByRole("button", { name }).click();
  // Première connexion : une seule question (régime) ; le questionnaire complet reste dans Réglages.
  await p.waitForURL("**/menu");
  await p.goto(BASE + "/profil/gouts"); await p.waitForTimeout(400);
  return p;
}

// Madji (fun) : sans porc, n'aime pas le canard, adore les champignons
const madji = await login("Madji"); ok(true, "Madji arrive sur Ce soir (plus de questionnaire à l'entrée)");
await shot(madji, "60-gouts-regime-fun");
await madji.getByRole("button", { name: "Sans porc" }).click();
await madji.getByLabel("Autre").fill("céleri"); await madji.getByRole("button", { name: "Ajouter", exact: true }).click();
await shot(madji, "61-gouts-regime-coche");
await madji.getByRole("button", { name: "Suivant" }).click(); await madji.waitForTimeout(400);
// Tes envies
await madji.getByRole("button", { name: "Burgers, street food" }).click(); await madji.getByRole("button", { name: "Mexicain" }).click();
await madji.getByRole("radio", { name: "Moins d'1 h" }).click(); await madji.getByRole("radio", { name: "J'adore" }).click();
await shot(madji, "61b-gouts-envies"); await madji.getByRole("button", { name: "Suivant" }).click(); await madji.waitForTimeout(400);
await shot(madji, "62-gouts-cartes-fun");
// Répond carte par carte : canard = j'aime pas, champignons = j'adore (geste vers le haut), le reste = ça me va.
const carte = (p) => p.locator("article p.kd-titre-1").last().textContent();
let cartes = 0;
while (!(await madji.getByText("C'est noté.").count())) {
  const nom = (await carte(madji))?.trim(); cartes++;
  if (nom === "Canard") await madji.getByLabel("J'aime pas").click();
  else if (nom === "Champignons") {
    const box = await madji.locator(".touch-none").last().boundingBox();
    await madji.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await madji.mouse.down();
    for (let i = 1; i <= 12; i++) await madji.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - i * 20);
    await shot(madji, "63-gouts-glisser-haut"); await madji.mouse.up();
  } else await madji.getByLabel("Ça me va").click();
  await madji.waitForTimeout(330);
  if (cartes > 80) throw new Error("ÉCHEC: le questionnaire ne se termine pas");
}
ok(cartes >= 40, `Madji a répondu à ${cartes} cartes (porc et charcuterie retirés par « sans porc »)`);
await madji.getByText("C'est noté.").waitFor(); await madji.waitForTimeout(300);
await shot(madji, "64-gouts-resultat-fun");
ok(await madji.locator("li", { hasText: "Toi et Karin" }).getByText("pas encore répondu").count() === 1, "Madji : Karin n'a pas encore répondu");
const t = sql(`select string_agg(food || '=' || level, ',' order by food) from profile_tastes t join profiles p on p.id = t.profile_id where p.name = 'Madji'`);
ok(t === "autre:céleri=interdit,canard=pas_fan,champignons=adore,piment=adore,sans_porc=interdit", `goûts enregistrés, piquant compris (${t})`);
const env = sql(`select envies::text from profiles where name = 'Madji'`);
ok(env.includes("street_food") && env.includes("mexicain") && env.includes('"temps": "60"'), `envies enregistrées (${env})`);
await madji.getByRole("button", { name: "C'est parti" }).click(); await madji.waitForURL("**/menu"); await madji.goto(BASE + "/envies");

// Karin : les mêmes cartes, avec les boutons
const karin = await login("Karin");
await shot(karin, "65-gouts-regime-simple");
await karin.getByRole("button", { name: "Rien de tout ça" }).click(); await karin.waitForTimeout(300);
await karin.getByRole("button", { name: "Suivant" }).click(); await karin.waitForTimeout(300);
await shot(karin, "66-gouts-cartes-simple");
while (!(await karin.getByText("C'est noté.").count())) {
  const nom = (await carte(karin))?.trim();
  await karin.getByLabel(nom === "Canard" ? "J'adore" : "Ça me va").click(); await karin.waitForTimeout(330);
}
await karin.getByText("C'est noté.").waitFor(); await karin.waitForTimeout(300);
await shot(karin, "67-gouts-resultat-simple");
ok(await karin.getByText("98 % compatibles").count() === 1, "Toi et Madji : 98 % compatibles (seul désaccord : le canard)");
await karin.getByRole("button", { name: "C'est parti" }).click(); await karin.waitForURL("**/menu");

// Yoalem passe le questionnaire : la petite carte reste sur le swipe
const yoalem = await login("Yoalem");
await yoalem.getByRole("button", { name: "Plus tard" }).click(); await yoalem.waitForURL("**/menu"); await yoalem.goto(BASE + "/envies");
ok(await yoalem.getByText("Tes goûts en détail, si tu veux").count() === 1, "« Plus tard » : la carte (facultative) reste sur le swipe");
await yoalem.reload(); ok(yoalem.url().endsWith("/envies"), "« Plus tard » : on ne redemande pas");

// Mode strict (par défaut) : le magret disparaît pour tout le monde ; la quiche (lardons) toujours
const deckTitles = async (p) => { await p.goto(BASE + "/envies"); await p.waitForTimeout(600); return p.locator(".kd-carte__titre").allTextContents(); };
sql(`insert into swipes (profile_id, recipe_id, liked) select p.id, r.id, false from profiles p, recipes r where p.name = 'Yoalem' and r.family_id = '${FAM}' and r.id <> '${magret}' and r.title <> 'Quiche lorraine'`);
let titres = await deckTitles(yoalem);
ok(!titres.includes("Magret de canard au miel") && !titres.includes("Quiche lorraine"), `mode strict : magret et quiche cachés (${titres.join(", ") || "paquet vide"})`);

// Mode strict coupé : le magret revient en fin de paquet avec la pastille
await karin.goto(BASE + "/reglages"); await karin.getByRole("switch", { name: "Mode strict" }).click(); await karin.waitForTimeout(800);
await shot(karin, "68-famille-mode-strict");
titres = await deckTitles(yoalem);
ok(titres.includes("Magret de canard au miel") && !titres.includes("Quiche lorraine"), "sans mode strict : le magret revient, la quiche reste interdite");
ok(await yoalem.getByText("Madji n'aime pas").count() >= 1, "pastille « Madji n'aime pas » sur la carte");
await shot(yoalem, "69-swipe-pastille");

// Recettes : tout reste listé, avec l'étiquette
await yoalem.goto(BASE + "/recettes"); await yoalem.waitForTimeout(500);
ok(await yoalem.getByText("Interdit pour Madji").count() >= 3, "recettes : « Interdit pour Madji » sur les plats au porc");
await yoalem.getByText("Interdit pour Madji").first().scrollIntoViewIfNeeded(); await shot(yoalem, "70-recettes-etiquettes");
// Formulaire : avertissement en direct
await yoalem.goto(BASE + "/recettes/nouvelle"); await yoalem.fill("input[name=title]", "Croque au jambon");
await yoalem.getByText(/Interdit pour Madji/).waitFor(); ok(true, "formulaire : avertissement pour un aliment interdit");

// Réglages → Mes goûts : prérempli
await madji.goto(BASE + "/reglages"); await madji.getByRole("link", { name: "Mes goûts" }).click(); await madji.waitForURL("**/profil/gouts**");
ok(await madji.getByRole("button", { name: "Sans porc", pressed: true }).count() === 1, "« Mes goûts » : réponses préremplies");

// Questionnaire rempli avant les 48 cartes : seulement les nouvelles, une fois, sans perdre les réponses
sql(`update profiles set tastes_done_at = '2026-10-14T10:00:00Z' where name = 'Madji'`);
await madji.goto(BASE + "/envies"); await madji.waitForURL("**/profil/gouts?nouvelles=1");
ok(await madji.getByText(/carte 1 sur 28/).count() === 1, "anciens répondants : 28 nouvelles cartes (30 moins porc et charcuterie)");
await shot(madji, "71-nouvelles-cartes");
while (!(await madji.getByText("C'est noté.").count())) { await madji.getByLabel("Ça me va").click({ timeout: 3000 }).catch(() => {}); await madji.waitForTimeout(300); }
const apres = sql(`select string_agg(food || '=' || level, ',' order by food) from profile_tastes t join profiles p on p.id = t.profile_id where p.name = 'Madji'`);
ok(apres.includes("canard=pas_fan") && apres.includes("sans_porc=interdit"), "anciennes réponses gardées");
await madji.getByRole("button", { name: "C'est parti" }).click(); await madji.waitForURL("**/menu"); await madji.goto(BASE + "/envies");
await madji.reload(); ok(madji.url().endsWith("/envies"), "nouvelles cartes : demandées une seule fois");

// Questionnaire rempli avant l'écran « Tes envies » : seulement celui-là, une fois
sql(`update profiles set envies_done_at = null where name = 'Karin'`);
await karin.goto(BASE + "/envies"); await karin.waitForURL("**/profil/gouts?envies=1");
await karin.getByRole("button", { name: "Pâtes" }).click(); await shot(karin, "72-envies-seules");
await karin.getByRole("button", { name: "C'est noté" }).click(); await karin.waitForURL("**/menu");
ok(sql(`select envies->>'styles' from profiles where name = 'Karin'`).includes("pates"), "anciens répondants : écran des envies seul, enregistré");

// Relance « plus que 10 minutes » : une fois, à ceux qui n'ont pas répondu
sql(`update shopping_trips set status = 'done'`);
const tid = sql(`insert into shopping_trips (family_id, created_by, deadline_at, departs_at) select '${FAM}', id, now() + interval '5 minutes', now() + interval '5 minutes' from profiles where name = 'Karin' returning id`).split("\n")[0];
const r1 = await (await fetch(BASE + "/api/cron/relance")).json(); const r2 = await (await fetch(BASE + "/api/cron/relance")).json();
ok(r1.envoyees === 2 && r2.envoyees === 0, `relance : 2 membres relancés, une seule fois (${r1.envoyees} puis ${r2.envoyees})`);
sql(`delete from shopping_trips where id = '${tid}'`);

console.log(errors.length ? "erreurs : " + errors.join(" | ") : "aucune erreur navigateur");
await b.close();
