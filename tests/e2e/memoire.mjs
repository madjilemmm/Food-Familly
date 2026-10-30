// La mémoire de la maison : mesure, « Prévenir la famille ? », lien partagé, « La dernière fois », « On refait ? », « ton envie ».
// MODE=avant : la migration de mesure n'est pas passée (la décision doit marcher quand même) ; MODE=apres : rang et raison sont gardés.
// ONLY=mesure,lien,derniere,refait,envie,ouvertures pour n'en lancer que certains.
import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import fs from "node:fs";
import { settle } from "./settle.mjs";

const SP = process.env.SP, BASE = "http://localhost:3000", OUT = `${SP}/memoire`;
const mode = process.env.MODE || "apres";
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
fs.mkdirSync(OUT, { recursive: true });

const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
const reset = () => execSync(`bash ${SP}/reset.sh`);
const F = "20000000-0000-4000-8000-000000000001";
const K = "00000000-0000-4000-8000-000000000001"; // Karin
const M = "00000000-0000-4000-8000-000000000002"; // Madji
const R = { blanquette: "10000000-0000-4000-8000-000000000001", hachis: "10000000-0000-4000-8000-000000000002", gratin: "10000000-0000-4000-8000-000000000003", quiche: "10000000-0000-4000-8000-000000000006", potaufeu: "10000000-0000-4000-8000-000000000008" };
const PROP = "section[aria-label='La proposition de ce soir']";
const DECIDE = "section[aria-label='Le repas de ce soir']";

const browser = await lancer();
const mk = (viewport = { width: 390, height: 844 }) => browser.newContext({ ...devices["iPhone 13"], viewport, locale: "fr-FR", timezoneId: "Europe/Paris" });
const errors = [];
const surveiller = (p, nom) => {
  p.on("pageerror", (e) => errors.push(`${nom}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/WebSocket|Failed to load resource/.test(m.text()) && errors.push(`${nom} console: ${m.text()}`));
  return p;
};
const shot = async (p, n) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${mode}-${n}.png` }); };
const ok = (c, m) => { if (!c) throw new Error("ÉCHEC: " + m); console.log("✓", m); };

async function login(nom, ctx) {
  ctx ??= await mk();
  const p = surveiller(settle(await ctx.newPage()), nom);
  await p.goto(BASE + "/");
  await p.getByRole("button", { name: "J'ai déjà un code" }).click();
  await p.getByLabel("Code famille").fill(" Poulet Test ");
  await p.getByRole("button", { name: "C'est parti" }).click();
  await p.waitForURL("**/profil");
  await p.getByRole("button", { name: nom }).click();
  await p.waitForURL(/menu|envies|courses/);
  return p;
}
const titre = async (p) => (await p.locator(`${PROP} h2`).textContent()).trim();
const ligne = async (p) => (await p.locator(`${PROP} .soir-haut > p > span:last-child`).first().innerText()).replace(/\s+/g, " ").trim();
async function changeDe(p, avant) {
  await p.waitForFunction(([s, t]) => document.querySelector(s)?.textContent?.trim() !== t, [`${PROP} h2`, avant], { timeout: 20000 });
}
async function decider(p) {
  await p.getByRole("button", { name: "Ce sera ça" }).click();
  await p.locator(DECIDE).waitFor({ timeout: 25000 });
}
const compteur = (etape) => Number(sql(`select coalesce(sum(n), 0) from parcours_etapes where etape = '${etape}'`));
const jourDeSemaine = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "Europe/Paris" }).format(new Date());

/** Une course terminée il y a `jours` jours avec ces plats (et ces articles ajoutés à la main : [nom, coché]). */
let n = 0;
function course({ jours, plats = [], articles = [] }) {
  const id = `30000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  sql(`insert into shopping_trips (id, family_id, created_by, status, created_at, departs_at, deadline_at, validated_at, finished_at)
       values ('${id}', '${F}', '${M}', 'done', now() - interval '${jours + 1} days', now() - interval '${jours} days', now() - interval '${jours} days', now() - interval '${jours} days', now() - interval '${jours} days');`);
  for (const r of plats) sql(`insert into trip_recipes (trip_id, recipe_id, selected) values ('${id}', '${r}', true);`);
  for (const [nom, coche] of articles) sql(`insert into shopping_list_items (trip_id, name, aisle, source, checked) values ('${id}', '${nom.replace(/'/g, "''")}', 'autre', 'manual', ${coche});`);
  return id;
}
/** Le plat décidé il y a `jours` jours (le jour à Paris). */
const decision = (jours, recette) =>
  sql(`insert into ce_soir_choix (family_id, jour, recipe_id, choisi_par, choisi_le) values ('${F}', (now() at time zone 'Europe/Paris')::date - ${jours}, '${recette}', '${M}', now() - interval '${jours} days');`);
const aime = (profil, recette, jours) =>
  sql(`insert into swipes (profile_id, recipe_id, liked, swiped_at, liked_at) values ('${profil}', '${recette}', true, now() - interval '${jours} days', now() - interval '${jours} days');`);

async function scenario(nom, f) {
  if (only && !only.includes(nom)) return;
  console.log(`\n── ${nom} (${mode})`);
  reset();
  sql("truncate parcours_etapes");
  await f();
}

// ─────────────────────────────────────────────────────────────────────────────
await scenario("mesure", async () => {
  const p = await login("Madji");
  await p.goto(BASE + "/menu");
  await p.locator(PROP).waitFor();
  const t0 = await titre(p);
  await shot(p, "1-proposition");
  await p.getByRole("button", { name: "Autre idée" }).click(); await changeDe(p, t0);
  const t1 = await titre(p);
  await p.getByRole("button", { name: "Autre idée" }).click(); await changeDe(p, t1);
  const t2 = await titre(p);
  ok(new Set([t0, t1, t2]).size === 3, `« Autre idée » fait défiler : ${t0} → ${t1} → ${t2}`);
  await decider(p);
  ok(Number(sql("select count(*) from ce_soir_choix")) === 1, "la décision du soir est enregistrée");

  if (mode === "apres") {
    const [rang, raison] = sql("select rang, raison from ce_soir_choix").split("|");
    ok(rang === "2", `rang = ${rang} (deux idées écartées avant « Ce sera ça »)`);
    ok(["achete", "envie", "classique_jour", "adore", "classique", "aime", "pas_fait", "idee"].includes(raison), `raison gardée : ${raison}`);
  } else {
    ok(sql("select count(*) from information_schema.columns where table_name = 'ce_soir_choix' and column_name in ('rang', 'raison')") === "0", "base non migrée : pas de colonnes de mesure, et la décision marche quand même");
  }
  ok(compteur("autre_idee") === 2, "compteur autre_idee = 2");
  ok(compteur("premier_choix") === 1, "compteur premier_choix = 1");
  ok(compteur("ce_soir_affiche") === 1, "compteur ce_soir_affiche = 1 (une fois par visite)");

  // « Prévenir la famille ? »
  const rangee = p.getByRole("region", { name: "Prévenir la famille" });
  await rangee.waitFor({ timeout: 15000 });
  await shot(p, "2-decide-prevenir");
  await p.waitForTimeout(600);
  ok(compteur("prevenir_propose") === 1, "compteur prevenir_propose = 1");
  await rangee.getByRole("button", { name: "Prévenir" }).click();
  const feuille = p.getByRole("dialog", { name: "Prévenir la famille" });
  await feuille.waitFor();
  await shot(p, "3-apercu");
  ok(/Ce soir : /.test(await feuille.innerText()), "« Prévenir » ouvre l'aperçu du message");
  await rangee.waitFor({ state: "detached", timeout: 15000 });
  ok(await feuille.isVisible(), "la question disparaît, l'aperçu reste ouvert");
  ok(compteur("prevenir_oui") === 1, "compteur prevenir_oui = 1");
  await feuille.getByRole("button", { name: "Plus tard" }).click();
  await p.reload();
  await p.locator(DECIDE).waitFor();
  ok((await rangee.count()) === 0, "la question ne revient pas pour ce dîner");

  // Un autre plat : la question revient ; « Plus tard » la ferme sans rien ouvrir.
  await p.getByRole("button", { name: "Changer de plat" }).click();
  await p.locator(PROP).waitFor({ timeout: 20000 });
  await decider(p);
  await rangee.waitFor({ timeout: 15000 });
  ok(true, "après « Changer de plat », la question revient");
  await rangee.getByRole("button", { name: "Plus tard" }).click();
  await rangee.waitFor({ state: "detached", timeout: 15000 });
  ok((await p.getByRole("dialog").count()) === 0, "« Plus tard » ne l'ouvre pas");
  ok(compteur("prevenir_plus_tard") === 1, "compteur prevenir_plus_tard = 1");
});

// ─────────────────────────────────────────────────────────────────────────────
await scenario("lien", async () => {
  const ancien = "a1".repeat(16), valide = "b2".repeat(16);
  sql(`insert into invitations (family_id, jeton, created_by, expires_at) values ('${F}', '${ancien}', '${K}', now() - interval '30 days'), ('${F}', '${valide}', '${K}', now() + interval '3 days');`);

  const q = surveiller(settle(await (await mk()).newPage()), "inconnu");
  await q.goto(BASE + "/rejoindre/" + ancien);
  await q.getByText("Ce lien a expiré").waitFor();
  ok(true, "quelqu'un qui n'est pas de la famille voit « Ce lien a expiré »");
  await q.goto(BASE + "/rejoindre/" + valide);
  await q.getByLabel("Ton prénom").waitFor();
  ok(true, "un lien valable propose toujours de rejoindre");

  const p = await login("Madji");
  await p.goto(BASE + "/rejoindre/" + ancien);
  await p.waitForURL("**/menu");
  ok(true, "un membre qui rouvre un lien de plus de 7 jours arrive sur Ce soir");
  ok(compteur("ouverture_lien") === 1, "compteur ouverture_lien = 1");
  await p.goto(BASE + "/rejoindre/" + valide);
  await p.waitForURL("**/menu");
  ok(true, "un lien valable : un membre arrive aussi sur Ce soir");

  const a = surveiller(settle(await (await mk()).newPage()), "Anne");
  await a.goto(BASE + "/");
  await a.getByRole("link", { name: "Commencer" }).click();
  await a.waitForURL("**/bienvenue/creer");
  await a.getByLabel("Ton prénom").fill("Anne");
  await a.getByRole("button", { name: "Voir ce soir" }).click();
  await a.waitForURL("**/menu");
  await a.goto(BASE + "/rejoindre/" + ancien);
  await a.getByText("Ce lien a expiré").waitFor();
  ok(true, "un membre d'une AUTRE famille voit toujours « Ce lien a expiré »");
});

// ─────────────────────────────────────────────────────────────────────────────
await scenario("derniere", async () => {
  course({ jours: 6, articles: [["Lait", true], ["Œufs", true], ["Pain", true], ["Yaourts nature", true], ["Papier toilette", false]] });
  const p = await login("Karin");
  await p.goto(BASE + "/courses");
  await p.getByRole("heading", { name: "À ajouter ?" }).waitFor();
  await shot(p, "caddie-derniere-fois");
  ok(await p.getByText("La dernière fois", { exact: true }).isVisible(), "le groupe « La dernière fois » apparaît à la deuxième course");
  ok(await p.getByText("Pas pris la dernière fois", { exact: true }).isVisible(), "…à côté de « Pas pris la dernière fois »");
  for (const nom of ["Lait", "Œufs", "Pain", "Yaourts nature"]) ok((await p.getByRole("button", { name: `Ajouter ${nom} à la liste` }).count()) === 1, `proposé : ${nom}`);
  ok((await p.getByRole("button", { name: "Ajouter Papier toilette à la liste" }).count()) === 1, "proposé : Papier toilette (pas pris)");
  // Un « × » (pas besoin) retire une pastille.
  await p.getByRole("button", { name: "Pas besoin de Pain" }).click();
  await p.getByRole("button", { name: "Ajouter Pain à la liste" }).waitFor({ state: "detached" });
  // « Tout ajouter » met le reste sur la liste.
  await p.getByRole("button", { name: "Tout ajouter" }).click();
  await p.getByRole("heading", { name: "À ajouter ?" }).waitFor({ state: "detached", timeout: 15000 });
  const sur = sql("select string_agg(name, ',' order by name) from shopping_list_items i join shopping_trips t on t.id = i.trip_id where t.status <> 'done' and i.source = 'manual'");
  ok(sur === "Lait,Papier toilette,Yaourts nature,Œufs", `sur la liste : ${sur}`);
  ok(sql("select string_agg(name, ',') from shopping_list_items where origine is not null and trip_id in (select id from shopping_trips where status <> 'done')") === "Papier toilette", "seul l'article « pas pris » garde une étiquette : ceux de « La dernière fois » n'en ont pas (la base n'en connaît que deux)");
  await shot(p, "caddie-apres-tout-ajouter");
});

await scenario("derniere", async () => {
  // Trois courses faites : les habitudes prennent le relais, « La dernière fois » s'efface.
  for (const j of [8, 15, 23]) course({ jours: j, articles: [["Lait", true]] });
  const p = await login("Karin");
  await p.goto(BASE + "/courses");
  await p.getByText("Tes habituels", { exact: true }).waitFor();
  ok((await p.getByText("La dernière fois", { exact: true }).count()) === 0, "à partir de trois courses : « Tes habituels », plus de « La dernière fois »");
});

// ─────────────────────────────────────────────────────────────────────────────
await scenario("refait", async () => {
  // Le gratin : mangé il y a trois semaines, adoré après coup. Le hachis : un classique du jour, mangé quatre fois ce jour-là.
  course({ jours: 22, plats: [R.gratin] }); decision(21, R.gratin); aime(M, R.gratin, 20);
  for (const j of [14, 28, 35, 42]) { course({ jours: j + 1, plats: [R.hachis] }); decision(j, R.hachis); }
  // La quiche : décidée hier, courses faites, jamais marquée « C'est fait ».
  course({ jours: 2, plats: [R.quiche] }); decision(1, R.quiche);
  ok(sql("select count(*) from repas") === "0", "aucun « C'est fait » : tout vient des décisions et des courses");

  const p = await login("Madji");
  await p.goto(BASE + "/menu");
  await p.locator(PROP).waitFor();
  await shot(p, "refait-1-proposition");
  ok((await titre(p)) === "Gratin dauphinois", `en premier : ${await titre(p)} (aimé et déjà mangé)`);
  ok((await ligne(p)) === "Adoré il y a 3 semaines", `la ligne dit : « ${await ligne(p)} »`);
  const g = await titre(p);
  await p.getByRole("button", { name: "Autre idée" }).click(); await changeDe(p, g);
  ok((await titre(p)) === "Hachis parmentier", `ensuite : ${await titre(p)}`);
  ok((await ligne(p)) === `Votre classique du ${jourDeSemaine}`, `la ligne dit : « ${await ligne(p)} »`);
  await shot(p, "refait-2-classique-du-jour");

  // La carte « C'était bon ? » du lendemain, sans « C'est fait ».
  await p.goto(BASE + "/envies");
  await p.getByText("Mangé hier", { exact: true }).waitFor({ timeout: 15000 });
  ok(/Quiche lorraine/.test(await p.locator("body").innerText()), "« Mangé hier » : la quiche, sans « C'est fait »");
  await shot(p, "refait-3-mange-hier");
});

await scenario("refait", async () => {
  // Une envie passe devant un plat à refaire.
  course({ jours: 22, plats: [R.gratin] }); decision(21, R.gratin); aime(M, R.gratin, 20);
  aime(K, R.potaufeu, 1);
  const p = await login("Madji");
  await p.goto(BASE + "/menu");
  await p.locator(PROP).waitFor();
  ok((await titre(p)) === "Pot-au-feu", `une envie passe devant un plat à refaire : ${await titre(p)}`);
  ok((await ligne(p)) === "Karin en a envie", `la ligne dit : « ${await ligne(p)} »`);
  const t = await titre(p);
  await p.getByRole("button", { name: "Autre idée" }).click(); await changeDe(p, t);
  ok((await titre(p)) === "Gratin dauphinois", `puis le plat à refaire : ${await titre(p)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
await scenario("envie", async () => {
  aime(K, R.potaufeu, 1);
  const madji = await login("Madji");
  await madji.goto(BASE + "/menu");
  await madji.locator(PROP).waitFor();
  ok((await titre(madji)) === "Pot-au-feu", "Madji voit le pot-au-feu, que Karin voulait");
  await decider(madji);
  await madji.getByRole("button", { name: "Prévenir la famille" }).first().click();
  const feuille = madji.getByRole("dialog", { name: "Prévenir la famille" });
  await feuille.waitFor();
  const texte = await feuille.innerText();
  ok(/Ce soir : Pot-au-feu, comme Karin le voulait/.test(texte), "le message dit : « Ce soir : Pot-au-feu, comme Karin le voulait »");
  await shot(madji, "envie-1-message");

  const karin = await login("Karin");
  await karin.goto(BASE + "/menu");
  await karin.locator(DECIDE).waitFor();
  const haut = (await karin.locator(`${DECIDE} .soir-haut > p`).first().innerText()).replace(/\s+/g, " ");
  ok(/choisi par Madji · ton envie/.test(haut), `sur l'écran de Karin : « ${haut} »`);
  ok((await karin.getByRole("region", { name: "Prévenir la famille" }).count()) === 0, "Karin n'a pas la question « Prévenir la famille ? » (ce n'est pas elle qui a choisi)");
  await shot(karin, "envie-2-ton-envie");
  const yoalem = await login("Yoalem");
  await yoalem.goto(BASE + "/menu");
  await yoalem.locator(DECIDE).waitFor();
  const hautY = (await yoalem.locator(`${DECIDE} .soir-haut > p`).first().innerText()).replace(/\s+/g, " ");
  ok(/choisi par Madji/.test(hautY) && !/ton envie/.test(hautY), `Yoalem n'a pas « ton envie » : « ${hautY} »`);
});

// ─────────────────────────────────────────────────────────────────────────────
await scenario("ouvertures", async () => {
  // Une notification : « ?via=notification » est compté, puis retiré de l'adresse.
  const p = await login("Madji");
  await p.goto(BASE + "/menu?via=notification");
  await p.locator("section[aria-label]").first().waitFor();
  await p.waitForTimeout(900);
  ok(!p.url().includes("via="), `l'adresse est nettoyée : ${p.url().replace(BASE, "")}`);
  ok(compteur("ouverture_notification") === 1, "compteur ouverture_notification = 1");
  ok(compteur("ouverture_icone") === 0, "pas de compteur « icône » dans un simple navigateur");
  await p.reload();
  await p.waitForTimeout(900);
  ok(compteur("ouverture_notification") === 1, "recharger la page ne recompte pas");

  // L'icône de l'écran d'accueil : l'appli installée (display-mode: standalone), une fois par visite.
  const ctx = await mk();
  await ctx.addInitScript(() => {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) =>
      /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false } : mm(q);
  });
  const a = await login("Karin", ctx);
  await a.waitForTimeout(900);
  ok(compteur("ouverture_icone") === 1, "compteur ouverture_icone = 1 (appli installée)");
  await a.goto(BASE + "/courses");
  await a.goto(BASE + "/envies");
  await a.waitForTimeout(900);
  ok(compteur("ouverture_icone") === 1, "une seule fois par visite, pas à chaque écran");
});

await browser.close();
console.log(errors.length ? `\nErreurs de page :\n${[...new Set(errors)].join("\n")}` : "\nAucune erreur de page.");
if (errors.length) process.exitCode = 1;
