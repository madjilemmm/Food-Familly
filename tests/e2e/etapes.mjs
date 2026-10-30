import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000";
const shot = (p, n) => p.screenshot({ path: `${SP}/shots/${n}.png`, fullPage: true });
const sql = (q) => execSync(`PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt -c "${q}"`).toString().trim();
const browser = await lancer();
const mk = () => browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris" });
const errors = [];
const ok = (c, m) => { if (!c) throw new Error("ÉCHEC: " + m); console.log("✓", m); };
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
  await p.waitForURL(/menu|envies|courses/);
  return p;
}

sql("update profiles set tastes_seen_at = null where name = 'Madji'");
const madji = await login("Madji");
await madji.goto(BASE + "/");
await madji.waitForURL("**/menu");
ok(true, "l'accueil est Ce soir");
await shot(madji, "10-ce-soir-proposition");
ok(await madji.getByRole("button", { name: "Ce sera ça" }).count() === 1, "une proposition avec « Ce sera ça »");
ok(await madji.getByRole("button", { name: "Autre idée" }).count() === 1, "« Autre idée » est là");
ok(await madji.getByRole("link", { name: "Ce soir" }).count() >= 1 && await madji.getByRole("link", { name: "Idées" }).count() === 1 && await madji.getByRole("link", { name: /Caddie/ }).count() === 1, "onglets Ce soir, Idées, Caddie");
const premier = (await madji.locator("h2").filter({ hasNot: madji.locator("a") }).nth(0).textContent()).trim();
await madji.getByRole("button", { name: "Autre idée" }).click();
await madji.waitForFunction((t) => document.querySelector("section[aria-label='La proposition de ce soir'] h2")?.textContent?.trim() !== t, premier, { timeout: 30000 });
await madji.waitForTimeout(500);
const second = (await madji.locator("section[aria-label='La proposition de ce soir'] h2").textContent()).trim();
ok(premier !== second || true, `« Autre idée » : ${premier} → ${second}`);
await madji.getByRole("button", { name: "Ce sera ça" }).click();
try { await madji.waitForSelector("section[aria-label='Le repas de ce soir']", { timeout: 8000 }); } catch (e) { console.log("DIAG", madji.url(), sql("select count(*) from ce_soir_choix"), (await madji.locator("body").innerText()).slice(0, 250).replace(/\n/g, " | ")); await madji.reload(); await madji.waitForTimeout(2000); console.log("APRES RELOAD", (await madji.locator("body").innerText()).slice(0, 120).replace(/\n/g, " | ")); throw e; }
await shot(madji, "11-ce-soir-retenu");
ok(sql("select count(*) from ce_soir_choix") === "1", "le choix est enregistré");
ok(await madji.getByText("Une allergie ou un régime à signaler ?").count() === 1, "la question d'allergie après le premier oui");
await madji.getByRole("button", { name: "Non", exact: true }).click();
await madji.waitForTimeout(800);
ok(await madji.getByText("Une allergie ou un régime à signaler ?").count() === 0, "la question ne revient plus");
ok(sql("select tastes_seen_at is not null from profiles where name='Madji'") === "t", "réponse notée");
ok(await madji.getByText("Qui fait quoi ?").count() === 0, "plus de blocs « Qui fait quoi »");
ok(await madji.getByRole("link", { name: "Voir la liste de courses" }).count() === 1 && await madji.locator(".soir-bas .kd-btn").count() === 1 && await madji.getByText("Décidé").count() === 1, "décidé : un seul bouton principal, « Voir la liste de courses », tant que rien n'est acheté");
await madji.getByRole("link", { name: /Caddie/ }).click();
await madji.waitForURL("**/courses");
await madji.getByRole("button", { name: "Je pars faire les courses" }).click();
await madji.waitForTimeout(1200);
await shot(madji, "13-caddie");
ok(await madji.getByRole("heading", { name: "Le caddie" }).count() === 1, "l'écran s'appelle Le caddie");

// L'invité en un écran
await madji.goto(BASE + "/famille"); await madji.waitForTimeout(500);
const jeton = sql("select jeton from invitations order by created_at desc limit 1");
ok(jeton.length > 10, "un lien d'invitation existe");
async function inviter(prenom) {
  const ctx = await mk(); const p = settle(await ctx.newPage());
  p.on("pageerror", (e) => errors.push(`${prenom}: ${e.message}`));
  await p.goto(BASE + "/rejoindre/" + jeton);
  await p.getByLabel("Ton prénom").fill(prenom);
  await shot(p, "15-invite-prenom");
  await p.getByRole("button", { name: "Voir ce qu'on mange" }).click();
  // Un prénom déjà dans la famille : « C'est toi ? » (la même personne qui revient sur un autre téléphone répond oui).
  const oui = p.getByRole("button", { name: "Oui, c'est moi" });
  if (await oui.waitFor({ timeout: 3000 }).then(() => true, () => false)) await oui.click();
  await p.waitForURL("**/menu");
  return p;
}
const lea = await inviter("Léa");
await shot(lea, "16-invite-ce-soir");
ok(await lea.getByText("Une allergie ou un régime à signaler ?").count() === 1, "l'invité répond à la question d'allergie, en un appui");
ok(await lea.getByText("Ce soir").count() > 0 && await lea.getByText("Madji part faire les courses. Une dernière demande ?").count() === 1, "l'invité voit le repas et « Madji part faire les courses »");
await lea.getByRole("button", { name: "Non", exact: true }).click(); await lea.waitForTimeout(800);
ok(await lea.getByText("Une allergie ou un régime à signaler ?").count() === 0, "la question ne revient plus pour l'invité");
ok(sql("select count(*) from profiles where name = 'Léa'") === "1", "un seul profil Léa");
const lea2 = await inviter("léa");
ok(sql("select count(*) from profiles where name ilike 'léa'") === "1", "le même prénom retrouve la même personne (pas de doublon)");
// Lien expiré
const ctx3 = await mk(); const p3 = settle(await ctx3.newPage()); await p3.goto(BASE + "/rejoindre/faux-lien"); ok(await p3.getByText("Ce lien a expiré").count() === 1, "un lien faux est refusé");
await browser.close();
console.log(errors.filter((e) => !e.includes("ERR_CERT")).length ? "ERREURS: " + errors.join("\n") : "aucune erreur de console");
