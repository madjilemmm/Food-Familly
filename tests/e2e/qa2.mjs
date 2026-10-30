import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import { settle } from "./settle.mjs";
const BASE = "http://localhost:3000";
const sql = (q) => execSync(`PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt -c "${q}"`).toString().trim();
const b = await lancer();
const migre = process.argv[2] !== "nonmigre";
if (!migre) sql("alter table ce_soir_choix rename to ce_soir_choix_x");
try {
  for (let n = 0; n < 10; n++) {
    const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
    const p = settle(await ctx.newPage());
    await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
    await p.getByLabel("Code famille").fill("poulet-test"); await p.getByRole("button", { name: "C'est parti" }).click();
    await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Madji" }).click(); await p.waitForURL(/menu/);
    await p.waitForSelector("section[aria-label]"); await p.waitForTimeout(800);
    await p.getByRole("button", { name: "Ce sera ça" }).click();
    const decide = await p.locator("section[aria-label='Le repas de ce soir']").waitFor({ timeout: 8000 }).then(() => true, () => false);
    if (!decide) { console.log(n, "ÉCHEC 1re action ; DB:", sql("select count(*) from ce_soir_choix")); await p.reload(); await p.waitForTimeout(1500); console.log("   après reload:", await p.locator("section[aria-label]").evaluateAll((e) => e.map((x) => x.getAttribute("aria-label")))); await ctx.close(); sql("delete from ce_soir_choix"); continue; }
    await p.waitForTimeout(600 * n);
    await p.getByRole("button", { name: "Changer de plat" }).click();
    const t0 = Date.now();
    const back = await p.locator("section[aria-label='La proposition de ce soir']").waitFor({ timeout: 15000 }).then(() => Date.now() - t0, () => -1);
    if (back < 0) { console.log("   DB lignes:", sql("select count(*) from ce_soir_choix")); await p.waitForTimeout(5000); console.log("   +5s:", await p.locator("section[aria-label]").evaluateAll((e) => e.map((x) => x.getAttribute("aria-label")))); await p.reload(); await p.waitForTimeout(1500); console.log("   après reload:", await p.locator("section[aria-label]").evaluateAll((e) => e.map((x) => x.getAttribute("aria-label")))); }
    console.log(n, migre ? "migré" : "non migré", "retour à la proposition:", back, "ms", back < 0 ? "| état: " + (await p.locator("section[aria-label]").evaluateAll((e) => e.map((x) => x.getAttribute("aria-label")))) + " cookies:" + (await ctx.cookies()).map((c) => c.name).join(",") : "");
    await ctx.close();
    sql("delete from ce_soir_choix" + (migre ? "" : "_x"));
  }
} finally { if (!migre) sql("alter table ce_soir_choix_x rename to ce_soir_choix"); }
await b.close();
