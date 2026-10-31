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
  sql("truncate import_decouverte, import_frontiere");
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
const tous = ["longue", "epuisement", "panne", "lente", "refus", "jours", "concurrent", "coupure", "flux"];
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
    mesure(`${vues.length} cartes vues, ${distinctes} titres distincts, retours : ${vues.length - distinctes}`);
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
    const dernier = new Map(); const ecarts = []; vues.forEach((t, i) => { if (dernier.has(t)) ecarts.push(i - dernier.get(t)); dernier.set(t, i); });
    mesure(`plats revenus : ${ecarts.length} fois${ecarts.length ? `, au plus tôt après ${Math.min(...ecarts)} cartes` : ""}`);
    ok(vues.filter((t, i) => i > 0 && t === vues[i - 1]).length === 0, "jamais le même plat deux fois de suite");
    ok(ecarts.length === 0 || Math.min(...ecarts) >= 8, "un plat ne revient jamais avant 8 cartes");
    ok(bloques === 0, "aucun swipe sans carte suivante");
    ok(p.erreurs.length === 0, `aucune erreur JS dans la page (${p.erreurs.length})`);
    ok(vides === 0, `jamais d'écran sans carte (${vides})`);
    await p.ctx.close();
  },

  // 2. Le catalogue est fini (la source ne montre que 40 recettes) : le swipe ne s'arrête JAMAIS, les plats reviennent, jamais deux fois de suite.
  async epuisement() {
    remiseAZero(); await source("/__reset"); await source("/__pool?n=40");
    const p = await ouvrir(browser); const vues = []; let vides = 0; let bloques = 0; const temps = [];
    while (vues.length < 300) {
      const e = await etat(p);
      if (!e.carte) { vides++; if (vides > 40) break; await p.waitForTimeout(1500); continue; }
      vues.push(e.carte);
      const r = await swiper(p, AIME.test(e.carte)); temps.push(r.ms); if (r.bloque) bloques++;
      await p.waitForTimeout(300);
    }
    const distincts = new Set(vues).size;
    const dernier = new Map(); const ecarts = [];
    vues.forEach((t, i) => { if (dernier.has(t)) ecarts.push(i - dernier.get(t)); dernier.set(t, i); });
    const suite = vues.filter((t, i) => i > 0 && t === vues[i - 1]).length;
    vues.forEach((t, i) => { if (i > 0 && ecarts.length && (t === vues[i - 1])) mesure(`  répétition au rang ${i} : …${vues.slice(Math.max(0, i - 3), i + 3).join(" | ")}…  (ids : ${sql(`select string_agg(id::text, ',') from recipes where title = '${t.replace(/'/g, "''")}'`)})`); });
    mesure(`${vues.length} cartes d'affilée sur ${distincts} plats distincts ; écrans sans carte : ${vides} ; swipes sans suite : ${bloques}`);
    mesure(`retour d'un plat : au plus tôt après ${Math.min(...ecarts)} cartes, médiane ${mediane(ecarts)} ; même plat deux fois de suite : ${suite} ; carte suivante : médiane ${mediane(temps)} ms, max ${Math.max(...temps)} ms`);
    const s0 = await stats(); await p.waitForTimeout(10_000); const s1 = await stats();
    mesure(`source : ${s0.recherches} recherches et ${s0.fiches} fiches au total ; 10 s de plus à l'arrêt : ${s1.recherches - s0.recherches} recherches`);
    ok(vues.length >= 300, `le swipe va jusqu'à 300 cartes sans s'arrêter (${vues.length})`);
    ok(vides === 0, `aucun écran sans carte (${vides})`);
    ok(suite === 0, "jamais le même plat deux fois de suite");
    ok(Math.min(...ecarts) >= Math.min(8, Math.floor(distincts / 4)), `un plat ne revient pas avant ${Math.min(8, Math.floor(distincts / 4))} cartes au moins (minimum constaté : ${Math.min(...ecarts)})`);
    ok(bloques === 0, "aucun swipe sans carte suivante");
    await p.ctx.close();
  },

  // 3. La source est en panne (500) : le swipe continue avec les plats déjà là, la source n'est pas martelée.
  async panne() {
    remiseAZero(); await source("/__reset"); await source("/__mode?m=fail");
    const p = await ouvrir(browser); const vues = []; let vides = 0; let bloques = 0;
    for (let i = 0; i < 120; i++) {
      const e = await etat(p); if (!e.carte) { vides++; await p.waitForTimeout(1500); continue; }
      vues.push(e.carte); const r = await swiper(p, i % 2 === 0); if (r.bloque) bloques++; await p.waitForTimeout(300);
    }
    const s = await stats(); mesure(`${vues.length} cartes (${new Set(vues).size} plats distincts) avec la source en panne ; écrans sans carte : ${vides} ; tentatives vers la source : ${s.refusees}`);
    ok(vides === 0 && bloques === 0, "la panne ne coupe pas le swipe");
    // Une tentative complète = 6 recherches + les voisines de 5 recettes (≈ 11 requêtes) ; ensuite le délai s'allonge.
    ok(s.refusees <= 24, `la source en panne n'est pas martelée (${s.refusees} requêtes, soit ${Math.ceil(s.refusees / 11)} tentative(s) complète(s) sur ${vues.length} cartes)`);
    // La source revient : de nouvelles recettes arrivent.
    await source("/__mode?m=ok"); sql("update import_decouverte set prochain_essai = now() - interval '1 minute', verrou_jusqu = null");
    const avant = Number(sql("select count(*) from recipes where source_url is not null"));
    for (let i = 0; i < 12; i++) { const e = await etat(p); if (e.carte) await swiper(p, false); await p.waitForTimeout(800); }
    await p.waitForTimeout(6000);
    const apres = Number(sql("select count(*) from recipes where source_url is not null"));
    ok(apres > avant, `la source revient : de nouvelles recettes arrivent (${avant} → ${apres})`);
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

  // 5. La mémoire des refus : un « Bof » est gardé pour toujours ; tant qu'il reste des nouveautés, aucun plat refusé ne repasse devant.
  async refus() {
    remiseAZero(); await source("/__reset");
    const p = await ouvrir(browser); const refuses = [];
    for (let i = 0; i < 30; i++) { const e = await etat(p); if (!e.carte) break; refuses.push(e.carte); await swiper(p, false); await p.waitForTimeout(300); }
    const nb = Number(sql("select count(*) from swipes where liked = false"));
    mesure(`${refuses.length} plats refusés, ${nb} refus en base`);
    ok(nb >= refuses.length, "chaque « Bof » est enregistré");
    // Laisser l'import apporter des nouveautés avant de rouvrir (au plus 60 s).
    for (let i = 0; i < 30 && Number(sql("select count(*) from recipes r where not exists (select 1 from swipes s where s.recipe_id = r.id)")) < 12; i++) await p.waitForTimeout(2000);
    await p.goto(BASE + "/envies"); await p.waitForTimeout(1500);
    const nouveautes = Number(sql("select count(*) from recipes r where not exists (select 1 from swipes s where s.recipe_id = r.id)"));
    const premieres = []; const statuts = []; for (let i = 0; i < 8; i++) { const e = await etat(p); if (!e.carte) break; premieres.push(e.carte); statuts.push(sql(`select coalesce(string_agg(case when s.liked then 'aimé' else 'refusé' end, ','), 'jamais swipé') from recipes r left join swipes s on s.recipe_id = r.id where r.title = '${e.carte.replace(/'/g, "''")}'`)); await swiper(p, false); await p.waitForTimeout(300); }
    const revus = premieres.filter((t) => refuses.includes(t)).length;
    mesure(`${nouveautes} nouveautés en base ; sur les ${premieres.length} cartes suivantes, ${revus} plats déjà refusés`);
    premieres.forEach((t, i) => mesure(`  « ${t} » : ${statuts[i]}`));
    ok(nouveautes > 8 ? revus === 0 : true, "avec des nouveautés disponibles, aucun plat refusé ne repasse devant");
    // 29 jours plus tard (l'ancien nettoyage supprimait alors les recettes importées refusées, et leurs refus avec).
    sql("update swipes set swiped_at = now() - interval '29 days'; update recipes set created_at = now() - interval '29 days' where source_url is not null");
    const avant = Number(sql("select count(*) from swipes"));
    await p.goto(BASE + "/envies"); await p.waitForTimeout(8000);
    ok(Number(sql("select count(*) from swipes")) >= avant, `29 jours plus tard, aucun refus n'a été effacé (${avant} → ${sql("select count(*) from swipes")})`);
    await p.ctx.close();
  },

  // 6. Le temps qui passe : après quelques jours, les plats déjà vus reviennent en reprise, les aimés avant les refusés.
  async jours() {
    remiseAZero(); await source("/__reset"); await source("/__pool?n=40");
    const p = await ouvrir(browser); const aimes = new Set(); const refuses = new Set();
    for (let i = 0; i < 60; i++) { const e = await etat(p); if (!e.carte) break; const aime = AIME.test(e.carte); (aime ? aimes : refuses).add(e.carte); await swiper(p, aime); await p.waitForTimeout(250); }
    mesure(`session de départ : ${aimes.size} plats aimés, ${refuses.size} refusés`);
    sql("drop table if exists _sauv_swipes; create table _sauv_swipes as select * from swipes");
    for (const j of [3, 25, 100]) {
      sql(`delete from swipes; insert into swipes select * from _sauv_swipes; update swipes set swiped_at = now() - interval '${j} days'`);
      await p.goto(BASE + "/envies"); await p.waitForTimeout(1500);
      const vues = []; for (let i = 0; i < 30; i++) { const e = await etat(p); if (!e.carte) break; vues.push(e.carte); await swiper(p, false); await p.waitForTimeout(200); }
      const premierAime = vues.findIndex((t) => aimes.has(t)), premierRefuse = vues.findIndex((t) => refuses.has(t));
      mesure(`${j} jours plus tard — ${vues.length} cartes ; premier plat aimé revu : n° ${premierAime + 1 || "-"} ; premier plat refusé revu : n° ${premierRefuse + 1 || "-"}`);
      ok(vues.length === 30, `${j} jours : le swipe continue (${vues.length} cartes)`);
      if (premierAime >= 0 && premierRefuse >= 0) ok(premierAime < premierRefuse, `${j} jours : les plats aimés reviennent avant les plats refusés`);
    }
    sql("drop table if exists _sauv_swipes");
    await p.ctx.close();
  },

  // 9. Le flux : un fonds très large (appli lancée avec DIVERSE=1 POOL=1200). 400 cartes d'affilée, presque toutes JAMAIS VUES, sans écran vide,
  // sans qu'une page de la source soit lue deux fois, et avec peu de requêtes par carte nouvelle.
  async flux() {
    remiseAZero(); await source("/__reset");
    const p = await ouvrir(browser); const vues = []; const deja = new Set(); let neuves = 0; let vides = 0; let bloques = 0; const temps = [];
    const tranches = [];
    while (vues.length < 400) {
      const e = await etat(p);
      if (!e.carte) { vides++; if (vides > 60) break; await p.waitForTimeout(1500); continue; }
      vues.push(e.carte); const neuve = !deja.has(e.carte); deja.add(e.carte); if (neuve) neuves++;
      const r = await swiper(p, AIME.test(e.carte) || vues.length % 3 === 0); temps.push(r.ms); if (r.bloque) bloques++;
      if (vues.length % 100 === 0) tranches.push(`${neuves} neuves sur ${vues.length}`);
      await p.waitForTimeout(250);
    }
    const part = (xs) => (xs.length ? Math.round((100 * xs.filter((t) => AIME.test(t)).length) / xs.length) : 0);
    const s = await stats();
    mesure(`pertinence : part de plats que Madji aime (burgers, pâtes, poulet, curry…) par tranche de 100 cartes : ${[0, 1, 2, 3].map((n) => part(vues.slice(n * 100, n * 100 + 100)) + " %").join(" · ")} ; sur les 100 premières NOUVEAUTÉS : ${part([...new Set(vues)].slice(0, 100))} %`);
    mesure(`${vues.length} cartes, ${neuves} jamais vues (${Math.round((100 * neuves) / vues.length)} %) — cumul : ${tranches.join(" · ")}`);
    mesure(`écrans sans carte : ${vides} ; swipes sans suite : ${bloques} ; carte suivante : médiane ${mediane(temps)} ms, 95e centile ${centile(temps, 0.95)} ms`);
    mesure(`source : ${s.recherches} recherches, ${s.fiches} fiches lues dont ${s.fichesUniques} différentes (${s.fiches - s.fichesUniques} relues) ; ${(s.fiches / Math.max(1, neuves)).toFixed(1)} fiches lues par carte nouvelle`);
    mesure(`en base : ${sql("select count(*) from recipes where source_url is not null")} recettes importées ; frontière : ${sql("select string_agg(etat || ' ' || n, ' · ') from (select etat, count(*) n from import_frontiere group by etat order by etat) t")}`);
    ok(vues.length >= 400, `400 cartes d'affilée (${vues.length})`);
    ok(vides === 0 && bloques === 0, `jamais d'écran vide ni de swipe sans suite (${vides} / ${bloques})`);
    ok(neuves / vues.length >= 0.95, `au moins 95 % de cartes jamais vues (${Math.round((100 * neuves) / vues.length)} %)`);
    ok(s.fiches === s.fichesUniques, `aucune fiche relue (${s.fiches - s.fichesUniques} relues)`);
    ok(p.erreurs.length === 0, "aucune erreur JS");
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
