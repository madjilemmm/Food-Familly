// Audit mobile (rapide) : champs de saisie < 16 px (zoom automatique sur iPhone), cibles tactiles < 44 px, débordements, sur les écrans principaux.
import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import { settle } from "./settle.mjs";
const SP = process.env.SP, BASE = "http://localhost:3000";
execSync(`bash ${SP}/restore-base.sh`, { stdio: "ignore" }); execSync(`bash ${SP}/reset.sh`);
const b = await lancer();
const sizes = [[320, 568], [360, 640], [390, 844], [430, 932], [768, 1024]];
const pages = ["/menu", "/envies", "/courses", "/famille", "/reglages", "/recettes", "/recettes/nouvelle", "/profil/gouts", "/profil/portrait", "/annee"];
const out = [];
for (const [w, h] of sizes) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: w, height: h }, locale: "fr-FR", timezoneId: "Europe/Paris" });
  const p = settle(await ctx.newPage());
  await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
  await p.getByLabel("Code famille").fill(" Poulet Test "); await p.getByRole("button", { name: "C'est parti" }).click();
  await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Madji" }).click(); await p.waitForURL(/menu/);
  for (const chemin of pages) {
    await p.goto(BASE + chemin); await p.waitForTimeout(900);
    const m = await p.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
      const champs = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select")].filter(vis);
      const petitsChamps = champs.filter((c) => parseFloat(getComputedStyle(c).fontSize) < 16).map((c) => `${c.tagName.toLowerCase()}${c.name ? "[" + c.name + "]" : ""} ${getComputedStyle(c).fontSize}`);
      const cliquables = [...document.querySelectorAll("button, a[href], [role=button], summary")].filter(vis).filter((e) => !e.closest("nav.fixed, [aria-hidden=true]") || true);
      const petits = cliquables.filter((e) => { const r = e.getBoundingClientRect(); return (r.height < 44 || r.width < 44) && !(e.tagName === "A" && e.closest("p, li") && r.height >= 24 && e.textContent.trim().split(" ").length > 1 && getComputedStyle(e).display === "inline"); }).map((e) => `${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30)} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`);
      return { debordeX: document.documentElement.scrollWidth > innerWidth + 1, petitsChamps, petits: petits.slice(0, 6), nPetits: petits.length };
    });
    out.push({ taille: `${w}×${h}`, page: chemin, ...m });
  }
  await ctx.close();
}
console.log("Débordements horizontaux :", out.filter((o) => o.debordeX).map((o) => `${o.page} @${o.taille}`).join(" ; ") || "aucun");
const champs = new Map(); for (const o of out) for (const c of o.petitsChamps) champs.set(`${o.page} : ${c}`, 1);
console.log("Champs de saisie sous 16 px (zoom iPhone au focus) :", [...champs.keys()].join(" | ") || "aucun");
const cibles = new Map(); for (const o of out.filter((x) => x.taille === "390×844")) if (o.nPetits) cibles.set(o.page, `${o.nPetits} : ${o.petits.join(" ; ")}`);
console.log("Cibles tactiles sous 44 px à 390×844 :"); for (const [k, v] of cibles) console.log("  ", k, "→", v);
await b.close();
