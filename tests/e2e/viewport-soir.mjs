import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
const SP = process.env.SP, BASE = "http://localhost:3000";
const sql = (q) => execSync(`PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt -c "${q}"`).toString().trim();
const DEVICES = [
  { n: "Android 360×640", w: 360, h: 640, top: 24, bottom: 0 },
  { n: "SE 375×667", w: 375, h: 667, top: 20, bottom: 0 },
  { n: "Safari 13 390×664", w: 390, h: 664, top: 0, bottom: 0 },
  { n: "13 PWA 390×844", w: 390, h: 844, top: 47, bottom: 34 },
  { n: "ProMax 430×932", w: 430, h: 932, top: 59, bottom: 34 },
];
const b = await lancer();
const out = [];
for (const etat of (process.env.ETATS ?? "proposition,decide").split(",")) {
  for (const d of DEVICES) {
    execSync(`bash ${SP}/reset.sh || true`, { stdio: "ignore" });
    sql("update profiles set tastes_seen_at = null where name = 'Madji'");
    sql("insert into pas_ce_soir (family_id, recipe_id, jusqu_a) select '20000000-0000-4000-8000-000000000001', id, now() + interval '2 days' from recipes where title <> 'Poulet rôti et pommes de terre' and id::text like '10000000%'");
    if (etat === "decide") sql("insert into ce_soir_choix (family_id, jour, recipe_id, choisi_par) select '20000000-0000-4000-8000-000000000001', (now() at time zone 'Europe/Paris')::date, id, '00000000-0000-4000-8000-000000000002' from recipes where title = 'Poulet rôti et pommes de terre'");
    const ctx = await b.newContext({ viewport: { width: d.w, height: d.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "fr-FR", timezoneId: "Europe/Paris" });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: d.top, bottom: d.bottom, left: 0, right: 0 } });
    await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
    await p.getByLabel("Code famille").fill("poulet-test"); await p.getByRole("button", { name: "C'est parti" }).click();
    await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Madji" }).click(); await p.waitForURL(/menu/);
    await p.waitForSelector("section[aria-label]"); await p.waitForTimeout(1200);
    if (etat === "idees") {
      await p.goto(BASE + "/envies"); await p.waitForTimeout(1500);
      const m = await p.evaluate(() => {
        const r = (e) => e.getBoundingClientRect();
        const nav = r(document.querySelector("nav.fixed")); const miam = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Miam");
        const carte = document.querySelector("[class*=kd-carte]"); const band = r(document.querySelector("header.bandeau"));
        return { navTop: Math.round(nav.top), bouton: Math.round(r(miam).bottom), dernier: Math.round(r(miam).bottom), photoH: Math.round(r(carte).height), bande: Math.round(band.height), defile: document.documentElement.scrollHeight > innerHeight };
      });
      out.push({ etat, ecran: d.n, ...m, ok: m.dernier <= m.navTop ? "tient" : "NE TIENT PAS" }); await ctx.close(); continue;
    }
    await p.screenshot({ path: `${SP}/apres/vp-${etat}-${d.w}x${d.h}.jpg`, type: "jpeg", quality: 80 });
    const m = await p.evaluate(() => {
      const r = (e) => e?.getBoundingClientRect();
      const nav = r(document.querySelector("nav.fixed")), sec = document.querySelector("section[aria-label]");
      const btn = [...sec.querySelectorAll("button, a.kd-btn")].find((x) => /Ce sera ça|Je cuisine|Voir la liste|Voir la recette/.test(x.textContent));
      const dernier = [...sec.querySelectorAll("button")].filter((x) => /Autre idée|Changer de plat/.test(x.textContent)).pop();
      const photo = r(sec.querySelector("a"));
      const band = r(document.querySelector("header.bandeau"));
      return { navTop: Math.round(nav.top), bouton: Math.round(r(btn).bottom), dernier: Math.round(r(dernier).bottom), photoH: Math.round(photo.height), bande: Math.round(band.height), defile: document.documentElement.scrollHeight > innerHeight };
    });
    out.push({ etat, ecran: d.n, ...m, ok: m.dernier <= m.navTop ? "tient" : (m.bouton <= m.navTop ? "bouton seul" : "NE TIENT PAS") });
    await ctx.close();
  }
}
console.table(out);
await b.close();
