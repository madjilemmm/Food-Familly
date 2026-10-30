// Le moteur de découverte, de bout en bout, avec la FAUSSE source (tests/e2e/fake-marmiton.mjs) : reproductible, sans réseau, pannes à la demande.
// Prérequis : base de démonstration remise à zéro (stack/reset.sh), migration import_decouverte appliquée, appli lancée par `bash tests/e2e/stack/appli.sh`.
// Lancer : node tests/e2e/decouverte.mjs longue epuisement panne lente refus jours concurrent coupure      (sans argument : tous, dans cet ordre)
// Chaque scénario part d'une base remise à zéro et d'une source remise à neuf. Il écrit ses MESURES (« ▸ … »), pas seulement ✓/✗ : c'est la matière du rapport.
// Ce que ces essais ne prouvent PAS : le ressenti (vitesse perçue, plaisir du choix) ni le comportement avec la vraie source — voir le rapport.
import { devices } from "@playwright/test";
import { execSync } from "node:child_process";
import { lancer } from "./navigateur.mjs";
import { settle } from "./settle.mjs";

const BASE = "http://localhost:3000";
const SOURCE = "http://localhost:3200";
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
const source = async (chemin) => (await fetch(SOURCE + chemin)).text();
const stats = async () => JSON.parse(await source("/__stats"));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const mediane = (xs) => { const t = [...xs].sort((a, b) => a - b); return t.length ? t[Math.floor(t.length / 2)] : 0; };
const centile = (xs, q) => { const t = [...xs].sort((a, b) => a - b); return t.length ? t[Math.min(t.length - 1, Math.floor(t.length * q))] : 0; };
let echecs = 0;
const ok = (c, m) => { console.log(c ? "✓" : "✗", m); if (!c) echecs++; };
const mesure = (m) => console.log("▸", m);

function remiseAZero() {
  execSync("bash tests/e2e/stack/reset.sh", { stdio: "ignore" });
  sql("truncate import_decouverte");
}

async function ouvrir(browser, nom = "Madji", { contexte = {} } = {}) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris", ...contexte });
  const p = settle(await ctx.newPage());
  p.erreurs = [];
  p.on("pageerror", (e) => p.erreurs.push(e.message));
  await p.goto(BASE + "/");
  await p.getByRole("button", { name: "J'ai déjà un code" }).click();
  await p.getByLabel("Code famille").fill(" Poulet Test ");
  await p.getByRole("button", { name: "C'est parti" }).click();
  await p.waitForURL("**/profil");
  await p.getByRole("button", { name: nom }).click();
  await p.waitForURL(/menu|envies|courses/);
  await p.goto(BASE + "/envies");
  p.ctx = ctx;
  return p;
}

/** Ce que l'écran montre : une carte (son titre) ou un écran sans carte (son titre à lui). */
async function etat(p) {
  const h = p.locator("h2");
  if (await h.count()) return { carte: (await h.last().textContent()).trim() };
  const s = p.locator("[role=status] .kd-titre-2, .kd-carte .kd-titre-2").first();
  return { vide: (await s.count()) ? (await s.textContent()).trim() : "?" };
}

/** Un swipe (« Miam » ou « Bof ») puis l'attente de la carte suivante ; renvoie le temps pris et ce qui s'affiche ensuite. */
async function swiper(p, aime) {
  const avant = (await etat(p)).carte;
  const t0 = Date.now();
  await p.getByRole("button", { name: aime ? "Miam" : "Bof", exact: true }).click();
  for (let i = 0; i < 400; i++) {
    const e = await etat(p);
    if (e.vide || e.carte !== avant) return { ms: Date.now() - t0, apres: e, avant };
    await dormir(25);
  }
  return { ms: Date.now() - t0, apres: await etat(p), avant, bloque: true };
}

const AIME = /poulet|burger|pizza|tacos|pates|spaghetti|lasagne|gratin|croque|fajitas|pad thai|curry/i;
const style = (t) => (t.match(AIME)?.[0] ?? "autre").toLowerCase();

const choisis = process.argv.slice(2);
const tous = ["longue", "epuisement", "panne", "lente", "refus", "jours", "concurrent", "coupure"];
const aLancer = choisis.length ? choisis : tous;
const browser = await lancer();

const scenarios = {
  // 1. Une longue session : 150 propositions d'affilée. Pas d'écran bloqué, pas de doublon, de la variété, une source peu sollicitée.
  async longue() {
    remiseAZero(); await source("/__reset");
    const t0 = Date.now(); const p = await ouvrir(browser); const e0 = await etat(p);
    const premiere = Date.now() - t0;
    ok(Boolean(e0.carte), `première carte affichée (« ${e0.carte ?? e0.vide} ») — ouverture complète ${premiere} ms`);
    const vues = []; const temps = []; let vides = 0; let bloques = 0; const imports = [];
    let dernierVide = null; let attente = 0; let i = 0;
    while (vues.length < 150) {
      const e = await etat(p);
      if (!e.carte) { dernierVide = e.vide; vides++; attente += 2500; if (attente > 150_000) break; await p.waitForTimeout(2500); await p.reload(); continue; }
      vues.push(e.carte);
      const aime = AIME.test(e.carte);
      const r = await swiper(p, aime);
      temps.push(r.ms); if (r.bloque) bloques++;
      i++; await p.waitForTimeout(700); // un rythme de pouce humain, pas une rafale
    }
    const distinctes = new Set(vues).size;
    mesure(`${vues.length} cartes vues, ${distinctes} titres distincts, doublons : ${vues.length - distinctes}`);
    mesure(`temps jusqu'à la carte suivante : médiane ${mediane(temps)} ms, 95e centile ${centile(temps, 0.95)} ms, max ${Math.max(...temps)} ms`);
    mesure(`temps total passé devant un écran sans carte : ${Math.round(attente / 1000)} s ; écrans « sans carte » rencontrés : ${vides}${dernierVide ? ` (dernier : « ${dernierVide} »)` : ""} ; swipes sans carte suivante après 10 s : ${bloques}`);
    const s = await stats(); mesure(`la source a reçu ${s.recherches} recherches et ${s.fiches} fiches pour ${vues.length} swipes`);
    const lignes = (n) => vues.slice(n * 25, n * 25 + 25);
    const part = (xs) => (xs.length ? Math.round((100 * xs.filter((t) => AIME.test(t)).length) / xs.length) : 0);
    mesure(`part de plats « aimés par Madji » par tranche de 25 : ${[0, 1, 2, 3, 4, 5].map((n) => (lignes(n).length ? part(lignes(n)) + " %" : "-")).join(" · ")}`);
    const styles = {}; vues.forEach((t) => (styles[style(t)] = (styles[style(t)] ?? 0) + 1));
    mesure(`répartition par type de plat : ${Object.entries(styles).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`);
    const run = (xs) => { let m = 1, c = 1; for (let i = 1; i < xs.length; i++) { c = style(xs[i]) === style(xs[i - 1]) && style(xs[i]) !== "autre" ? c + 1 : 1; m = Math.max(m, c); } return m; };
    mesure(`plus longue série du même type de plat d'affilée : ${run(vues)}`);
    const sources = sql("select count(*) from recipes where source_url is not null");
    mesure(`recettes importées de la source en base : ${sources}`);
    ok(vues.length === distinctes, "aucune recette proposée deux fois dans la session");
    ok(bloques === 0, "aucun swipe sans carte suivante");
    ok(p.erreurs.length === 0, `aucune erreur JS dans la page (${p.erreurs.length})`);
    ok(dernierVide === null || /fait le tour|cherche|n'arrive pas/i.test(dernierVide), "si la pile se vide, un message explicite s'affiche");
    await p.ctx.close();
  },

  // 2. Le catalogue est limité : la source ne montre que 40 recettes. La pile finit par se vider ; il faut un message clair, pas une boucle.
  async epuisement() {
    remiseAZero(); await source("/__reset"); await source("/__pool?n=40");
    const p = await ouvrir(browser);
    let vues = 0; let texte = ""; const evolution = []; const t0 = Date.now(); let terminal = false;
    while (!terminal && Date.now() - t0 < 240_000) {
      const e = await etat(p);
      if (e.carte) { vues++; await swiper(p, false); continue; }
      texte = e.vide ?? ""; if (!evolution.length || evolution.at(-1) !== texte) evolution.push(texte);
      if (/fait le tour|n'arrive pas/i.test(texte)) terminal = true; else await p.waitForTimeout(1500);
    }
    mesure(`${vues} cartes vues (toutes refusées) avant la fin ; messages successifs : ${evolution.join("  →  ")} ; message final après ${Math.round((Date.now() - t0) / 1000)} s`);
    const s0 = await stats(); await p.waitForTimeout(20_000); const s1 = await stats();
    mesure(`requêtes vers la source pendant 20 s sur l'écran final : ${s1.recherches - s0.recherches} recherches, ${s1.fiches - s0.fiches} fiches`);
    ok(/fait le tour/i.test(texte), `l'épuisement est dit clairement (« ${texte} »)`);
    ok(s1.recherches - s0.recherches <= 2, "plus de martèlement de la source une fois épuisé");
    mesure(`mémoire en base : ${sql("select dernier_resultat||' / essais vides='||essais_vides||' / prochain essai dans '||round(extract(epoch from (prochain_essai-now()))/60)||' min' from import_decouverte limit 1")}`);
    ok((await p.getByRole("link", { name: /revoir/i }).count()) > 0, "un lien pour revoir ses plats est proposé");
    ok((await p.getByRole("link", { name: /ajouter une recette/i }).count()) > 0, "un lien pour ajouter sa propre recette est proposé");
    // « Revoir » : la demande explicite fait revenir les plats refusés, un par un, sans rien cacher.
    await p.goto(BASE + "/envies?revoir=refuses"); await p.waitForTimeout(1200);
    const e = await etat(p);
    ok(Boolean(e.carte), `« revoir mes refus » montre bien des plats refusés à la demande (« ${e.carte ?? e.vide} »)`);
    await p.ctx.close();
  },

  // 3. La source est en panne (500). Rien ne doit tourner dans le vide, ni inonder la source.
  async panne() {
    remiseAZero(); await source("/__reset"); await source("/__mode?m=fail");
    const p = await ouvrir(browser);
    let vues = 0;
    for (let i = 0; i < 400; i++) { const e = await etat(p); if (!e.carte) break; vues++; await swiper(p, false); }
    let texte = ""; const t0 = Date.now();
    for (let i = 0; i < 40; i++) { await p.waitForTimeout(1500); const e = await etat(p); texte = e.vide ?? ""; if (/n'arrive pas|fait le tour/i.test(texte)) break; }
    mesure(`après ${vues} cartes, avec la source en panne : « ${texte} » en ${Math.round((Date.now() - t0) / 1000)} s`);
    const s = await stats(); mesure(`tentatives vers la source en panne pendant la phase : ${s.refusees}`);
    ok(/n'arrive pas|fait le tour/i.test(texte), "la panne est dite clairement au bout de quelques secondes (pas de « cherche… » sans fin)");
    const avant = (await stats()).refusees; await p.waitForTimeout(15_000); const apres = (await stats()).refusees;
    mesure(`tentatives pendant 15 s de plus : ${apres - avant}`);
    ok(apres - avant <= 2, "pas de martèlement d'une source en panne (attente qui s'allonge)");
    // La source revient : on lève l'attente (comme le ferait le temps qui passe) et on rouvre.
    await source("/__mode?m=ok"); sql("update import_decouverte set prochain_essai = now() - interval '1 minute', verrou_jusqu = null");
    await p.goto(BASE + "/envies");
    let carte = null; for (let i = 0; i < 40 && !carte; i++) { await p.waitForTimeout(1500); const e = await etat(p); carte = e.carte ?? null; if (!carte) await p.reload(); }
    ok(Boolean(carte), `la source revient : de nouvelles cartes apparaissent (« ${carte} »)`);
    await p.ctx.close();
  },

  // 4. La source répond avec 15 s de retard : l'import est coupé à 6 s par page, la page de l'utilisateur ne doit jamais attendre après lui.
  async lente() {
    remiseAZero(); await source("/__reset");
    const p = await ouvrir(browser); await source("/__mode?m=slow");
    const temps = []; let vues = 0;
    for (let i = 0; i < 90; i++) { const e = await etat(p); if (!e.carte) break; vues++; const r = await swiper(p, false); temps.push(r.ms); }
    mesure(`${vues} swipes pendant que la source est lente : médiane ${mediane(temps)} ms, max ${Math.max(...temps)} ms`);
    ok(Math.max(...temps) < 5000, "aucun swipe n'attend la source (max < 5 s)");
    await source("/__mode?m=ok"); await p.ctx.close();
  },

  // 5. La mémoire des refus : on refuse beaucoup, on revient plus tard — rien de refusé ne revient avant 90 jours, et les « Bof » ne sont jamais effacés.
  async refus() {
    remiseAZero(); await source("/__reset");
    const p = await ouvrir(browser); const refuses = [];
    for (let i = 0; i < 45; i++) { const e = await etat(p); if (!e.carte) break; refuses.push(e.carte); await swiper(p, false); }
    const nb = Number(sql("select count(*) from swipes where liked = false"));
    mesure(`${refuses.length} plats refusés, ${nb} refus en base`);
    await p.goto(BASE + "/envies"); await p.waitForTimeout(1500);
    const revues = []; for (let i = 0; i < 30; i++) { const e = await etat(p); if (!e.carte) break; revues.push(e.carte); await swiper(p, false); }
    const retours = revues.filter((t) => refuses.includes(t));
    mesure(`après rechargement : ${revues.length} cartes, dont ${retours.length} déjà refusées`);
    ok(retours.length === 0, "aucun plat refusé n'est reproposé après rechargement");
    // 28 jours plus tard (l'ancien nettoyage supprimait alors les recettes importées refusées, et leurs refus avec).
    sql("update swipes set swiped_at = now() - interval '29 days'; update recipes set created_at = now() - interval '29 days' where source_url is not null");
    const avant = Number(sql("select count(*) from swipes"));
    await p.goto(BASE + "/envies"); await p.waitForTimeout(8000);
    const apres = Number(sql("select count(*) from swipes"));
    ok(apres >= avant, `29 jours plus tard, aucun refus n'a été effacé (${avant} → ${apres})`);
    const vus2 = []; for (let i = 0; i < 30; i++) { const e = await etat(p); if (!e.carte) break; vus2.push(e.carte); await swiper(p, false); }
    ok(vus2.filter((t) => refuses.includes(t)).length === 0, `29 jours plus tard : 0 plat refusé reproposé (${vus2.length} cartes vues)`);
    await p.ctx.close();
  },

  // 6. Le temps qui passe : après des semaines, quoi revient ? (aimés après 21 jours ; refusés après 90 jours seulement, jamais cachés)
  async jours() {
    remiseAZero(); await source("/__reset");
    const p = await ouvrir(browser); const aimes = []; const refuses = [];
    for (let i = 0; i < 60; i++) { const e = await etat(p); if (!e.carte) break; const aime = AIME.test(e.carte); (aime ? aimes : refuses).push(e.carte); await swiper(p, aime); }
    mesure(`session de départ : ${aimes.length} plats aimés, ${refuses.length} refusés`);
    sql("drop table if exists _sauv_swipes; create table _sauv_swipes as select * from swipes");
    const apresJours = async (jours) => {
      // Les choix de départ ont maintenant `jours` jours ; ceux faits pendant la mesure sont jetés à chaque tour.
      sql(`delete from swipes; insert into swipes select * from _sauv_swipes; update swipes set swiped_at = now() - interval '${jours} days'`);
      await p.goto(BASE + "/envies"); await p.waitForTimeout(1500);
      const vues = []; for (let i = 0; i < 30; i++) { const e = await etat(p); if (!e.carte) break; vues.push(e.carte); await swiper(p, false); }
      return vues;
    };
    for (const j of [3, 10, 25, 100]) {
      const v = await apresJours(j);
      const a = v.filter((t) => aimes.includes(t)).length, r = v.filter((t) => refuses.includes(t)).length;
      mesure(`${j} jours plus tard — ${v.length} cartes : ${a} plats aimés revus, ${r} plats refusés revus`);
      if (j <= 10) ok(a === 0 && r === 0, `${j} jours : rien de ce qu'on a déjà tranché ne revient`);
      if (j === 25) ok(r === 0, "25 jours : aucun plat refusé ne revient");
      if (j === 100) ok(a + r > 0, "100 jours : des plats d'autrefois peuvent revenir (le rythme de retour existe)");
    }
    sql("drop table if exists _sauv_swipes");
    await p.ctx.close();
  },

  // 7. Plusieurs personnes de la même famille, en même temps, quand la pile est presque vide : un seul import, pas de doublon, pas d'orage.
  async concurrent() {
    remiseAZero(); await source("/__reset");
    const noms = ["Madji", "Yoalem", "Karin"]; const pages = [];
    for (const n of noms) pages.push(await ouvrir(browser, n));
    await Promise.all(pages.map(async (p) => { for (let i = 0; i < 40; i++) { const e = await etat(p); if (!e.carte) break; await swiper(p, i % 3 === 0); } }));
    await dormir(6000);
    const s = await stats();
    const total = Number(sql("select count(*) from recipes where source_url is not null"));
    const distincts = Number(sql("select count(distinct source_url) from recipes where source_url is not null"));
    mesure(`3 personnes, ${3 * 40} swipes en parallèle : ${s.recherches} recherches et ${s.fiches} fiches ; ${total} recettes importées (${distincts} distinctes)`);
    ok(total === distincts, "aucune recette importée deux fois");
    ok(pages.every((p) => p.erreurs.length === 0), "aucune erreur JS");
    const verrous = sql("select count(*) from import_decouverte");
    mesure(`lignes de verrou/mémoire en base : ${verrous}`);
    for (const p of pages) await p.ctx.close();
  },

  // 8. Le réseau du téléphone coupe pendant le swipe : les choix sont gardés et envoyés au retour, l'écran ne tourne pas dans le vide.
  async coupure() {
    remiseAZero(); await source("/__reset");
    const p = await ouvrir(browser); const avant = Number(sql("select count(*) from swipes"));
    await p.ctx.setOffline(true);
    let faits = 0; for (let i = 0; i < 4; i++) { const e = await etat(p); if (!e.carte) break; await swiper(p, false); faits++; }
    const e = await etat(p);
    ok(faits === 4 && Boolean(e.carte), `hors connexion : 4 swipes possibles, une carte reste affichée (« ${e.carte ?? e.vide} »)`);
    await p.ctx.setOffline(false); await p.waitForTimeout(6000);
    const apres = Number(sql("select count(*) from swipes"));
    mesure(`choix envoyés au retour du réseau : ${apres - avant} sur 4`);
    ok(apres - avant === 4, "les 4 choix faits hors connexion sont bien enregistrés au retour");
    await p.ctx.close();
  },
};

for (const nom of aLancer) {
  if (!scenarios[nom]) { console.log("scénario inconnu :", nom); continue; }
  console.log(`\n── ${nom} ──`);
  try { await scenarios[nom](); } catch (e) { echecs++; console.log("✗ scénario interrompu :", e.message.split("\n")[0]); }
}
await browser.close();
console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est passé");
process.exit(echecs ? 1 : 0);
