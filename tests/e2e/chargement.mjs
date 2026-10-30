import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000", OUT = `${SP}/audit2`;
const b = await lancer();
const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
const p = settle(await ctx.newPage());
await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
await p.getByLabel("Code famille").fill("poulet-test"); await p.getByRole("button", { name: "C'est parti" }).click(); await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Madji" }).click(); await p.waitForURL(/menu/);
await p.waitForTimeout(2500);
// Réseau lent : chaque navigation prend 1,5 s
await ctx.route("**/*", async (r) => { if (/_rsc=|\/courses$|\/envies$|\/menu$/.test(r.request().url()) && r.request().resourceType() !== "image") await new Promise((s) => setTimeout(s, 1500)); r.continue(); });
await p.evaluate(() => performance.clearResourceTimings?.());
await p.goto(BASE + "/envies", { waitUntil: "commit" }); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/30-chargement-envies.jpg`, type: "jpeg", quality: 70 });
await p.waitForTimeout(3500);
await p.locator("nav a", { hasText: "Ce soir" }).click(); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/31-chargement-ce-soir-via-onglet.jpg`, type: "jpeg", quality: 70 });
await b.close();
