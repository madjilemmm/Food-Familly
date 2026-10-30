import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000", OUT = `${SP}/audit2`;
const sql = (q) => execSync(`PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt -c "${q}"`).toString().trim();
const b = await lancer();
const photos = { "93191": "b.webp", "14699": "a.jpg", "133382": "c.webp" };
const mk = async (w = 390, h = 844) => {
  const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: w, height: h }, deviceScaleFactor: 1.5, locale: "fr-FR", timezoneId: "Europe/Paris" });
  await ctx.route("**/assets.afcdn.com/**", (r) => { const k = Object.keys(photos).find((x) => r.request().url().includes(x)); return k ? r.fulfill({ path: `${SP}/photos/${photos[k]}`, contentType: photos[k].endsWith("webp") ? "image/webp" : "image/jpeg" }) : r.abort(); });
  return ctx;
};
let n = 0;
const shot = async (p, nom, full = false) => { await p.waitForTimeout(1000); n++; await p.screenshot({ path: `${OUT}/${String(n).padStart(2, "0")}-${nom}.jpg`, type: "jpeg", quality: 78, fullPage: full }); console.log("→", n, nom); };
const skip = async (p) => { await p.getByRole("button", { name: "J'ai déjà un code" }).click(); };
// A. Première utilisation, seule
{ const ctx = await mk(); const p = settle(await ctx.newPage()); await p.goto(BASE + "/");
  await p.getByRole("link", { name: "Commencer" }).click(); await p.waitForURL("**/bienvenue/creer"); await shot(p, "creer");
  await p.getByLabel("Ton prénom").fill("Anne"); await p.getByRole("button", { name: "Voir ce soir" }).click(); await p.waitForURL("**/menu");
  await shot(p, "solo-ce-soir");
  await p.getByRole("button", { name: "Ce sera ça" }).click(); await p.locator("section[aria-label='Le repas de ce soir']").waitFor({ timeout: 8000 }).catch(async () => { console.log("(écran non mis à jour : rechargement)"); await p.reload(); }); await shot(p, "solo-decide");
  await p.getByRole("button", { name: "Non", exact: true }).click(); await p.waitForTimeout(1500); await shot(p, "solo-decide-apres-allergie", true);
  await p.getByRole("link", { name: "Je cuisine" }).click(); await p.waitForURL(/recettes/); await p.waitForTimeout(1200); await shot(p, "cuisine-1");
  await shot(p, "cuisine-bas", true);
  await p.goto(BASE + "/courses"); await shot(p, "solo-caddie", true);
  await p.goto(BASE + "/envies"); await shot(p, "solo-idees");
  await p.goto(BASE + "/famille"); await shot(p, "solo-table", true);
  await p.goto(BASE + "/reglages"); await shot(p, "reglages", true);
  await p.goto(BASE + "/recettes"); await shot(p, "recettes");
  await ctx.close(); }
// B. Famille à plusieurs : Madji
{ const ctx = await mk(); const p = settle(await ctx.newPage()); await p.goto(BASE + "/"); await skip(p);
  await p.getByLabel("Code famille").fill("poulet-test"); await p.getByRole("button", { name: "C'est parti" }).click(); await p.waitForURL("**/profil"); await shot(p, "profils");
  await p.getByRole("button", { name: "Madji" }).click(); await p.waitForURL(/menu/); await shot(p, "multi-ce-soir");
  await p.goto(BASE + "/envies"); await p.waitForTimeout(800); await p.getByRole("button", { name: "Miam", exact: true }).click(); await shot(p, "multi-miam");
  await p.goto(BASE + "/courses"); await shot(p, "multi-caddie-apres-miam", true);
  await p.goto(BASE + "/menu"); await shot(p, "multi-ce-soir-apres-miam", true);
  await ctx.close(); }
await b.close();
