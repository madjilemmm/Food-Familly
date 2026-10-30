// La finition mobile : aucun débordement, zones tactiles ≥ 44 px, un seul h1, texte ≥ 12 px, marge basse, « Ce soir » à texte agrandi,
// Bof / Miam en paysage, la fenêtre « Je cuisine » au clavier. Code de sortie 1 s'il y a un ✗.
import { devices } from "@playwright/test";
import { execSync } from "node:child_process";
import { lancer } from "./navigateur.mjs";
import { settle } from "./settle.mjs";

const SP = process.env.SP, BASE = "http://localhost:3000";
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
const GRATIN = "10000000-0000-4000-8000-000000000003";
const resultats = [];
const ok = (cond, msg) => { resultats.push(Boolean(cond)); console.log(`${cond ? "✓" : "✗"} ${msg}`); };
execSync(`bash ${SP}/restore-base.sh`, { stdio: "ignore" }); execSync(`bash ${SP}/reset.sh`);
sql(`insert into swipes (profile_id, recipe_id, liked, swiped_at, liked_at) select p.id, '${GRATIN}', true, now(), now() from profiles p where p.name in ('Karin','Madji') on conflict do nothing`);

const FORMATS = { "320×568": [320, 568], "375×667": [375, 667], "390×844": [390, 844], "430×932": [430, 932], "844×390 (paysage)": [844, 390] };
const PAGES = ["/menu", "/envies", "/courses", "/famille", "/reglages", "/recettes", `/recettes/${GRATIN}`, "/profil/portrait"];
// Le texte agrandi : les tailles du design system multipliées (design-system/tokens/tokens.css).
const BASE_TAILLES = { "--taille-display": 6, "--taille-titre-1": 3, "--taille-titre-2": 2, "--taille-titre-3": 1.5, "--taille-bouton": 1.25, "--taille-corps": 1.0625, "--taille-petit": 0.875, "--taille-etiquette": 0.75 };
const agrandi = (k) => `:root{${Object.entries(BASE_TAILLES).map(([n, v]) => `${n}:${v * k}rem !important`).join(";")}}`;

const b = await lancer();
async function ouvrir([w, h]) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: w, height: h }, locale: "fr-FR", timezoneId: "Europe/Paris" });
  const p = settle(await ctx.newPage());
  await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
  await p.getByLabel("Code famille").fill(" Poulet Test "); await p.getByRole("button", { name: "C'est parti" }).click();
  await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Madji" }).click(); await p.waitForURL(/menu|envies|courses/);
  return { ctx, p };
}
const visible = `(e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; }`;

for (const [nom, taille] of Object.entries(FORMATS)) {
  const { ctx, p } = await ouvrir(taille);
  const debord = [], petits = [], h1 = [], minuscule = [];
  for (const c of PAGES) {
    await p.goto(BASE + c); await p.waitForTimeout(600);
    const m = await p.evaluate(`(() => { const vis = ${visible};
      const actifs = [...document.querySelectorAll("button, a[href], input, textarea, select, summary, [role=button]")].filter(vis);
      return {
        debord: document.documentElement.scrollWidth > innerWidth + 1,
        petits: actifs.filter((e) => { const r = e.getBoundingClientRect(); return (r.height < 44 || r.width < 44) && !e.closest("nav") && !(e.tagName === "A" && e.closest("p, li") && r.height >= 24); }).length,
        h1: document.querySelectorAll("h1").length,
        minuscule: [...document.querySelectorAll("body *")].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12).length,
      }; })()`);
    if (m.debord) debord.push(c); if (m.petits && !nom.includes("paysage")) petits.push(c); if (m.h1 !== 1) h1.push(c); if (m.minuscule) minuscule.push(c);
  }
  ok(debord.length === 0, `${nom} : aucun débordement horizontal${debord.length ? " (" + debord.join(", ") + ")" : ""}`);
  if (!nom.includes("paysage")) ok(petits.length === 0, `${nom} : aucune zone tactile sous 44 px${petits.length ? " (" + petits.join(", ") + ")" : ""}`);
  ok(h1.length === 0, `${nom} : un seul h1 par écran${h1.length ? " (" + h1.join(", ") + ")" : ""}`);
  ok(minuscule.length === 0, `${nom} : aucun texte sous 12 px${minuscule.length ? " (" + minuscule.join(", ") + ")" : ""}`);
  await ctx.close();
}

// « Ce soir » à texte agrandi : le nom du plat reste atteignable (la page défile, pas de défilement caché) et « Ce sera ça » reste au-dessus des onglets.
for (const [nom, taille, k] of [["320×568", FORMATS["320×568"], 1.5], ["320×568", FORMATS["320×568"], 2], ["375×667", FORMATS["375×667"], 2]]) {
  const { ctx, p } = await ouvrir(taille);
  await p.goto(BASE + "/menu"); await p.addStyleTag({ content: agrandi(k) }); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const haut = document.querySelector(".soir-haut"), btn = document.querySelector(".soir-bas .kd-btn"), nav = document.querySelector("nav");
    const b = btn.getBoundingClientRect();
    return { cache: haut.scrollHeight - haut.clientHeight > 1 && getComputedStyle(haut).overflowY !== "visible", bouton: b.bottom <= nav.getBoundingClientRect().top + 1 };
  });
  ok(!r.cache, `Ce soir à ${nom}, texte ×${k} : aucun contenu caché dans un défilement interne`);
  ok(r.bouton, `Ce soir à ${nom}, texte ×${k} : « Ce sera ça » reste au-dessus des onglets`);
  await ctx.close();
}

// Paysage : Bof et Miam visibles sans défiler.
{
  const { ctx, p } = await ouvrir(FORMATS["844×390 (paysage)"]);
  await p.goto(BASE + "/envies"); await p.waitForTimeout(700);
  const r = await p.evaluate(() => { const nav = document.querySelector("nav").getBoundingClientRect().top; return [...document.querySelectorAll("button")].filter((e) => /^(Miam|Bof)$/.test(e.textContent.trim())).map((e) => e.getBoundingClientRect().bottom <= nav + 1); });
  ok(r.length === 2 && r.every(Boolean), "paysage 844×390 : Bof et Miam au-dessus de la barre d'onglets");
  await ctx.close();
}

// « Je cuisine » : le focus entre dans la fenêtre, Tab y reste, Échap la ferme.
{
  const { ctx, p } = await ouvrir(FORMATS["390×844"]);
  await p.goto(BASE + `/recettes/${GRATIN}?depuis=/menu&cuisine=1`); await p.waitForTimeout(800);
  const dialog = p.locator("[data-feuille=cuisine]");
  if (await dialog.count()) {
    ok(await dialog.evaluate((d) => d.contains(document.activeElement)), "Je cuisine : le focus est entré dans la fenêtre");
    for (let i = 0; i < 12; i++) await p.keyboard.press("Tab");
    ok(await dialog.evaluate((d) => d.contains(document.activeElement)), "Je cuisine : 12 fois Tab, le focus reste dans la fenêtre");
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    ok((await p.locator("[data-feuille=cuisine]").count()) === 0, "Je cuisine : Échap ferme la fenêtre");
  } else ok(false, "Je cuisine : la fenêtre ne s'est pas ouverte (recette sans étapes ?)");
  await ctx.close();
}

await b.close();
const echecs = resultats.filter((r) => !r).length;
console.log(`\n${resultats.length - echecs}/${resultats.length} vérifications passent`);
process.exit(echecs ? 1 : 0);
