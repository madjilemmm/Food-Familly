import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000", OUT = `${SP}/audit2`;
const b = await lancer();
const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, locale: "fr-FR", timezoneId: "Europe/Paris" });
const photos = { "93191": "b.webp", "14699": "a.jpg", "133382": "c.webp" };
await ctx.route("**/assets.afcdn.com/**", (r) => { const k = Object.keys(photos).find((x) => r.request().url().includes(x)); return k ? r.fulfill({ path: `${SP}/photos/${photos[k]}`, contentType: photos[k].endsWith("webp") ? "image/webp" : "image/jpeg" }) : r.abort(); });
const p = settle(await ctx.newPage()); let n = 20;
const shot = async (nom) => { await p.waitForTimeout(900); n++; await p.screenshot({ path: `${OUT}/${n}-${nom}.jpg`, type: "jpeg", quality: 78 }); console.log("→", nom); };
await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
await p.getByLabel("Code famille").fill("poulet-test"); await p.getByRole("button", { name: "C'est parti" }).click(); await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Madji" }).click(); await p.waitForURL(/menu/);
await p.goto(BASE + "/recettes/10000000-0000-4000-8000-000000000003?depuis=/menu&cuisine=1"); await p.waitForTimeout(1500); await shot("cuisine-ingredients");
const btn = p.getByRole("button", { name: /C'est parti|Étape suivante|J'ai fini/ }); 
for (let i = 0; i < 4 && await btn.count(); i++) { await btn.first().click(); await shot("cuisine-etape" + i); }
await b.close();
