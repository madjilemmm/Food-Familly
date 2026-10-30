import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000";
execSync(`bash ${SP}/restore-base.sh`, { stdio: "ignore" }); execSync(`bash ${SP}/reset.sh`);
const b = await lancer();
const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "fr-FR" });
const p = settle(await ctx.newPage());
await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
await p.getByLabel("Code famille").fill(" Poulet Test "); await p.getByRole("button", { name: "C'est parti" }).click();
await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Madji" }).click(); await p.waitForURL(/menu/);
for (const chemin of ["/pas-une-page", "/recettes/00000000-0000-4000-8000-0000000000ff", "/recettes/pas-un-identifiant"]) {
  const r = await p.goto(BASE + chemin); await p.waitForTimeout(600);
  console.log(chemin, "→", r.status(), "—", (await p.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 140));
}
await b.close();
