// « Ce soir » décidé avec la question « Prévenir la famille ? » : tient-il au-dessus de la barre d'onglets, sur une ligne, sur tous les écrans ?
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import fs from "node:fs";
const SP = process.env.SP, BASE = "http://localhost:3000", OUT = `${SP}/memoire`;
fs.mkdirSync(OUT, { recursive: true });
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
const DEVICES = [
  { n: "SE 1re gén. 320×568", w: 320, h: 568, top: 20, bottom: 0 },
  { n: "Android 360×640", w: 360, h: 640, top: 24, bottom: 0 },
  { n: "SE 375×667", w: 375, h: 667, top: 20, bottom: 0 },
  { n: "Safari 13 390×664", w: 390, h: 664, top: 0, bottom: 0 },
  { n: "13 PWA 390×844", w: 390, h: 844, top: 47, bottom: 34 },
  { n: "Android 412×915", w: 412, h: 915, top: 24, bottom: 0 },
  { n: "ProMax 430×932", w: 430, h: 932, top: 59, bottom: 34 },
];
const b = await lancer();
const out = [];
const aujourdhui = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
for (const etat of (process.env.ETATS ?? "sans,prevenir,allergie").split(",")) {
  for (const d of DEVICES) {
    execSync(`bash ${SP}/reset.sh || true`, { stdio: "ignore" });
    // « allergie » : la question d'allergie passe en premier (le cas le plus haut) ; « prevenir » : celle de la famille.
    if (etat === "allergie") sql("update profiles set tastes_seen_at = null where name = 'Madji'");
    sql("insert into ce_soir_choix (family_id, jour, recipe_id, choisi_par) select '20000000-0000-4000-8000-000000000001', (now() at time zone 'Europe/Paris')::date, id, '00000000-0000-4000-8000-000000000002' from recipes where title = 'Croque-monsieur et salade'");
    const ctx = await b.newContext({ viewport: { width: d.w, height: d.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "fr-FR", timezoneId: "Europe/Paris" });
    // « sans » : la question a déjà reçu sa réponse aujourd'hui (l'écran tel qu'il était avant).
    if (etat === "sans") await ctx.addCookies([{ name: "prevenu", value: aujourdhui, url: BASE }]);
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: d.top, bottom: d.bottom, left: 0, right: 0 } });
    await p.goto(BASE + "/"); await p.getByRole("button", { name: "J'ai déjà un code" }).click();
    await p.getByLabel("Code famille").fill("poulet-test"); await p.getByRole("button", { name: "C'est parti" }).click();
    await p.waitForURL("**/profil"); await p.getByRole("button", { name: "Madji" }).click(); await p.waitForURL(/menu/);
    await p.waitForSelector("section[aria-label='Le repas de ce soir']"); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/vp-${etat}-${d.w}x${d.h}.jpg`, type: "jpeg", quality: 80 });
    const m = await p.evaluate(() => {
      const r = (e) => e?.getBoundingClientRect();
      const nav = r(document.querySelector("nav.fixed")), sec = document.querySelector("section[aria-label='Le repas de ce soir']");
      const q = sec.querySelector(".soir-question");
      const boutons = q ? [...q.querySelectorAll("button, a")].map((x) => Math.round(r(x).height)) : [];
      const dernier = [...sec.querySelectorAll("button")].filter((x) => /Changer de plat/.test(x.textContent)).pop();
      const photo = r(sec.querySelector("a"));
      const haut = sec.querySelector(".soir-haut");
      return {
        // Ce que la partie haute cache (elle défile sans barre quand l'écran est trop bas) : 0 = tout est visible.
        cache: Math.max(0, haut.scrollHeight - haut.clientHeight),
        question: q ? q.getAttribute("aria-label") : "—",
        hQuestion: q ? Math.round(r(q).height) : 0,
        boutons: boutons.join("/"),
        photoH: Math.round(photo.height),
        navTop: Math.round(nav.top),
        dernier: Math.round(r(dernier).bottom),
        debordeX: document.documentElement.scrollWidth > innerWidth,
      };
    });
    out.push({ etat, ecran: d.n, ...m, ok: m.dernier <= m.navTop && !m.debordeX && m.cache === 0 ? "tout visible" : m.dernier <= m.navTop && !m.debordeX ? "tient (défile)" : "NE TIENT PAS" });
    await ctx.close();
  }
}
console.table(out);
await b.close();
