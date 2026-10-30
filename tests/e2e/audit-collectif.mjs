// Audit : scénarios collectifs (plusieurs téléphones). On OBSERVE et on note : rien ici ne modifie l'appli.
// ONLY=c1,c2,... pour n'en lancer que certains.
import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import fs from "node:fs";
import { settle } from "./settle.mjs";

const SP = process.env.SP, BASE = "http://localhost:3000", OUT = `${SP}/audit`;
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
const reset = () => { execSync(`bash ${SP}/reset.sh`); sql("truncate parcours_etapes; delete from suggestions_reponses; delete from a_table; delete from push_subscriptions;"); };
const F = "20000000-0000-4000-8000-000000000001";
const K = "00000000-0000-4000-8000-000000000001", M = "00000000-0000-4000-8000-000000000002", Y = "00000000-0000-4000-8000-000000000003";
const R = { blanquette: "10000000-0000-4000-8000-000000000001", hachis: "10000000-0000-4000-8000-000000000002", gratin: "10000000-0000-4000-8000-000000000003", poulet: "10000000-0000-4000-8000-000000000004", bourguignon: "10000000-0000-4000-8000-000000000005", quiche: "10000000-0000-4000-8000-000000000006", potaufeu: "10000000-0000-4000-8000-000000000008", croque: "10000000-0000-4000-8000-000000000009" };
const PROP = "section[aria-label='La proposition de ce soir']", DECIDE = "section[aria-label='Le repas de ce soir']";

const browser = await lancer();
const mk = (viewport = { width: 390, height: 844 }) => browser.newContext({ ...devices["iPhone 13"], viewport, locale: "fr-FR", timezoneId: "Europe/Paris" });
const journal = [];
const obs = (id, titre, faits) => { journal.push({ id, titre, faits }); console.log(`\n▶ ${id} — ${titre}`); for (const f of faits) console.log("   •", f); };
const erreursPage = [];
async function login(nom, ctx) {
  ctx ??= await mk();
  const p = settle(await ctx.newPage());
  p.on("pageerror", (e) => erreursPage.push(`${nom}: ${e.message}`));
  await p.goto(BASE + "/");
  await p.getByRole("button", { name: "J'ai déjà un code" }).click();
  await p.getByLabel("Code famille").fill(" Poulet Test ");
  await p.getByRole("button", { name: "C'est parti" }).click();
  await p.waitForURL("**/profil");
  await p.getByRole("button", { name: nom }).click();
  await p.waitForURL(/menu|envies|courses/);
  p.nom = nom;
  return p;
}
const texte = async (p, sel = "main") => ((await p.locator(sel).first().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
const trips = () => sql("select substr(id::text,1,4)||' '||status||' fin='||coalesce(to_char(finished_at,'HH24:MI:SS'),'-')||' plats='||(select count(*) from trip_recipes r where r.trip_id=t.id and selected)||' articles='||(select count(*) from shopping_list_items i where i.trip_id=t.id) from shopping_trips t order by created_at");
const aime = (profil, recette, jours = 0) => sql(`insert into swipes (profile_id, recipe_id, liked, swiped_at, liked_at) values ('${profil}', '${recette}', true, now() - interval '${jours} days', now() - interval '${jours} days') on conflict do nothing;`);
async function scenario(id, f) {
  if (only && !only.includes(id)) return;
  execSync(`bash ${SP}/restore-base.sh`, { stdio: "ignore" });
  reset();
  try { await f(); } catch (e) { obs(id, "SCÉNARIO INTERROMPU", [String(e.message).split("\n")[0]]); }
}

// ── C1 : deux personnes appuient sur « J'ai fini les courses » (la seconde sur un écran pas encore à jour)
await scenario("c1", async () => {
  aime(K, R.gratin); aime(M, R.gratin);
  const karin = await login("Karin"); const madji = await login("Madji");
  await karin.goto(BASE + "/courses"); await madji.goto(BASE + "/courses");
  const avant = trips();
  const faits = [`Avant : ${avant}`];
  await karin.getByRole("button", { name: "J'ai fini les courses" }).click();
  await karin.getByRole("button", { name: "Oui, c'est fini" }).click();
  await karin.waitForURL("**/courses"); await karin.waitForTimeout(1500);
  faits.push(`Après le « J'ai fini » de Karin : ${trips().replace(/\n/g, " | ")}`);
  faits.push(`Écran de Madji (pas rechargé) montre encore le bouton : ${await madji.getByRole("button", { name: "J'ai fini les courses" }).isVisible()}`);
  await madji.getByRole("button", { name: "J'ai fini les courses" }).click();
  await madji.getByRole("button", { name: "Oui, c'est fini" }).click();
  await madji.waitForTimeout(3500);
  faits.push(`Après le « J'ai fini » de Madji (écran périmé) : ${trips().replace(/\n/g, " | ")}`);
  await madji.goto(BASE + "/courses"); await madji.waitForTimeout(1200);
  faits.push(`Écran de Madji ensuite : « ${(await texte(madji)).slice(0, 220)} »`);
  faits.push(`Ce soir ensuite : « ${(await texte(await (async () => { await madji.goto(BASE + "/menu"); return madji; })())).slice(0, 260)} »`);
  obs("C1", "Deux « J'ai fini les courses » presque ensemble", faits);
});

// ── C2 : deux personnes retiennent deux plats différents au même moment
await scenario("c2", async () => {
  const karin = await login("Karin"); const madji = await login("Madji");
  await karin.goto(BASE + "/menu"); await madji.goto(BASE + "/menu");
  await karin.locator(PROP).waitFor(); await madji.locator(PROP).waitFor();
  const t0 = (await karin.locator(`${PROP} h2`).textContent()).trim();
  await karin.getByRole("button", { name: "Autre idée" }).click();
  await karin.waitForFunction(([s, t]) => document.querySelector(s)?.textContent?.trim() !== t, [`${PROP} h2`, t0]);
  const tK = (await karin.locator(`${PROP} h2`).textContent()).trim();
  const tM = (await madji.locator(`${PROP} h2`).textContent()).trim();
  const faits = [`Karin voit « ${tK} », Madji (écran pas à jour) voit encore « ${tM} »`];
  await Promise.all([karin.getByRole("button", { name: "Ce sera ça" }).click(), madji.getByRole("button", { name: "Ce sera ça" }).click()]);
  await Promise.all([karin.locator(DECIDE).waitFor({ timeout: 25000 }), madji.locator(DECIDE).waitFor({ timeout: 25000 })]);
  await karin.waitForTimeout(1200);
  const lignes = async (p) => (await p.locator(`${DECIDE} .soir-haut > p`).first().innerText()).replace(/\s+/g, " ");
  const titreDecide = async (p) => (await p.locator(`${DECIDE} h2`).textContent()).trim();
  faits.push(`Karin voit : « ${await titreDecide(karin)} » — ${await lignes(karin)}`);
  faits.push(`Madji voit : « ${await titreDecide(madji)} » — ${await lignes(madji)}`);
  faits.push(`Base : ${sql("select (select title from recipes where id=recipe_id)||' choisi_par='||(select name from profiles where id=choisi_par) from ce_soir_choix")}`);
  faits.push(`Plats au Menu : ${sql("select string_agg(r.title, ' + ') from trip_recipes tr join recipes r on r.id=tr.recipe_id join shopping_trips t on t.id=tr.trip_id where t.status<>'done' and tr.selected")}`);
  faits.push(`Articles sur la liste : ${sql("select count(*) from shopping_list_items i join shopping_trips t on t.id=i.trip_id where t.status<>'done'")}`);
  obs("C2", "Deux plats retenus en même temps par deux personnes", faits);
});

// ── C3 : « Changer de plat » : que devient l'ancien plat ?
await scenario("c3", async () => {
  const p = await login("Madji");
  await p.goto(BASE + "/menu"); await p.locator(PROP).waitFor();
  const t1 = (await p.locator(`${PROP} h2`).textContent()).trim();
  await p.getByRole("button", { name: "Ce sera ça" }).click(); await p.locator(DECIDE).waitFor({ timeout: 25000 });
  await p.getByRole("button", { name: "Changer de plat" }).click(); await p.locator(PROP).waitFor({ timeout: 25000 });
  const t2 = (await p.locator(`${PROP} h2`).textContent()).trim();
  const faits = [`Premier plat retenu : « ${t1} » ; après « Changer de plat », Kaddie propose : « ${t2} »`];
  faits.push(`Ligne sous le plat proposé : « ${(await p.locator(`${PROP} .soir-ligne`).first().innerText().catch(() => "—")).replace(/\s+/g, " ")} »`);
  faits.push(`Au Menu (base) : ${sql("select string_agg(r.title, ' + ') from trip_recipes tr join recipes r on r.id=tr.recipe_id join shopping_trips t on t.id=tr.trip_id where t.status<>'done' and tr.selected")}`);
  faits.push(`Articles sur la liste : ${sql("select count(*) from shopping_list_items i join shopping_trips t on t.id=i.trip_id where t.status<>'done'")}`);
  await p.getByRole("button", { name: "Ce sera ça" }).click(); await p.locator(DECIDE).waitFor({ timeout: 25000 });
  faits.push(`Après un second choix : plats au Menu = ${sql("select string_agg(r.title, ' + ') from trip_recipes tr join recipes r on r.id=tr.recipe_id join shopping_trips t on t.id=tr.trip_id where t.status<>'done' and tr.selected")} ; articles = ${sql("select count(*) from shopping_list_items i join shopping_trips t on t.id=i.trip_id where t.status<>'done'")}`);
  faits.push(`Le caddie annonce : « ${(await p.locator(`${DECIDE} .soir-ligne`).first().innerText()).replace(/\s+/g, " ")} »`);
  obs("C3", "« Changer de plat » : l'ancien plat reste au Menu et sur la liste", faits);
});

// ── C4 : un membre est retiré pendant qu'il utilise l'appli
await scenario("c4", async () => {
  const karin = await login("Karin"); const madji = await login("Madji");
  await karin.goto(BASE + "/menu"); await karin.locator(PROP).waitFor();
  await madji.goto(BASE + "/famille");
  await madji.getByRole("button", { name: "Retirer Karin" }).click();
  await madji.getByRole("button", { name: "Oui, retirer Karin" }).click();
  await madji.waitForTimeout(1500);
  const faits = [`Karin est-elle encore en base ? ${sql("select count(*) from profiles where name='Karin'")}`];
  await karin.getByRole("button", { name: "Autre idée" }).click().catch(() => {});
  await karin.waitForTimeout(3000);
  faits.push(`Karin appuie sur « Autre idée » : elle arrive sur ${karin.url().replace(BASE, "")} — « ${(await texte(karin)).slice(0, 200)} »`);
  await karin.goto(BASE + "/menu"); await karin.waitForTimeout(1200);
  faits.push(`Karin ouvre Ce soir : ${karin.url().replace(BASE, "")} — « ${(await texte(karin)).slice(0, 200)} »`);
  obs("C4", "Un membre retiré pendant qu'il utilise l'appli", faits);
});

// ── C5 : la famille est supprimée pendant qu'un autre téléphone est ouvert
await scenario("c5", async () => {
  const karin = await login("Karin"); const madji = await login("Madji");
  await karin.goto(BASE + "/menu"); await karin.locator(PROP).waitFor();
  await madji.goto(BASE + "/reglages");
  await madji.getByRole("button", { name: "Supprimer la famille et ses données" }).click();
  await madji.getByRole("button", { name: "Oui, tout supprimer" }).click();
  await madji.waitForTimeout(2500);
  const faits = [`Familles restantes : ${sql("select count(*) from families where id='" + F + "'")}`];
  await karin.reload().catch(() => {}); await karin.waitForTimeout(1500);
  faits.push(`Karin recharge : ${karin.url().replace(BASE, "")} — « ${(await texte(karin, "body")).slice(0, 260)} »`);
  const bouton = karin.getByRole("button", { name: /Karin|Madji|Yoalem/ });
  faits.push(`Boutons de profil proposés : ${await bouton.count()}`);
  await karin.goto(BASE + "/profil/nouveau").catch(() => {});
  obs("C5", "La famille est supprimée alors qu'un autre téléphone est ouvert", faits);
});

// ── C6 : changer le code de la famille : et ceux qui sont déjà dedans ?
await scenario("c6", async () => {
  const karin = await login("Karin"); const madji = await login("Madji");
  await madji.goto(BASE + "/reglages");
  const ancien = sql(`select join_code from families where id='${F}'`);
  await madji.getByRole("button", { name: "Changer le code" }).first().click();
  await madji.getByRole("button", { name: "Oui, changer le code" }).click();
  await madji.waitForTimeout(2000);
  const faits = [`Code avant : ${ancien} ; après : ${sql(`select join_code from families where id='${F}'`)}`];
  await karin.goto(BASE + "/menu"); await karin.waitForTimeout(1000);
  faits.push(`Karin (déjà connectée) ouvre Ce soir : ${karin.url().replace(BASE, "")} — l'écran s'affiche normalement : ${await karin.locator("section[aria-label]").first().isVisible()}`);
  const nouvelle = await mk(); const q = settle(await nouvelle.newPage());
  await q.goto(BASE + "/"); await q.getByRole("button", { name: "J'ai déjà un code" }).click();
  await q.getByLabel("Code famille").fill(ancien); await q.getByRole("button", { name: "C'est parti" }).click(); await q.waitForTimeout(2500);
  faits.push(`Quelqu'un tape l'ancien code : « ${(await texte(q, "body")).slice(0, 160)} »`);
  obs("C6", "Changement du code : les téléphones déjà connectés restent connectés", faits);
});

// ── C7 : « Je pars » : personne ne peut annuler, et l'appli s'ouvre sur le caddie pendant 6 h
await scenario("c7", async () => {
  aime(K, R.gratin); aime(M, R.gratin);
  const karin = await login("Karin"); const madji = await login("Madji");
  await karin.goto(BASE + "/courses");
  await karin.getByRole("button", { name: "Je pars faire les courses" }).click();
  await karin.waitForTimeout(2500);
  const faits = [`Karin voit : « ${(await texte(karin)).slice(0, 260)} »`];
  const boutonsKarin = await karin.getByRole("button").allInnerTexts();
  faits.push(`Boutons de Karin sur le caddie : ${boutonsKarin.map((t) => t.trim()).filter(Boolean).join(" · ")}`);
  await madji.goto(BASE + "/courses"); await madji.waitForTimeout(1200);
  faits.push(`Madji voit : « ${(await texte(madji)).slice(0, 260)} »`);
  faits.push(`Madji peut-il dire qu'il part à sa place ? bouton « Je pars » visible = ${await madji.getByRole("button", { name: "Je pars faire les courses" }).isVisible().catch(() => false)}`);
  await karin.goto(BASE + "/"); await karin.waitForTimeout(1500);
  faits.push(`Karin ouvre l'appli (adresse « / ») : elle arrive sur ${karin.url().replace(BASE, "")}`);
  obs("C7", "« Je pars faire les courses » : pas de retour en arrière, l'appli s'ouvre sur le caddie", faits);
});

// ── C8 : quelqu'un rejoint par le lien pendant que Karin est partie faire les courses
await scenario("c8", async () => {
  aime(K, R.gratin); aime(M, R.gratin);
  const karin = await login("Karin");
  await karin.goto(BASE + "/courses"); await karin.getByRole("button", { name: "Je pars faire les courses" }).click(); await karin.waitForTimeout(2000);
  const jeton = "c3".repeat(16);
  sql(`insert into invitations (family_id, jeton, created_by, expires_at) values ('${F}', '${jeton}', '${K}', now() + interval '3 days')`);
  const invite = surveiller(await mk());
  function surveiller(c) { return c; }
  const q = settle(await invite.newPage());
  await q.goto(BASE + "/rejoindre/" + jeton);
  await q.getByLabel("Ton prénom").fill("Léo"); await q.getByRole("button", { name: /Voir ce qu'on mange/ }).click(); await q.waitForURL("**/menu");
  const faits = [`Léo arrive sur : « ${(await texte(q)).slice(0, 200)} »`];
  await q.goto(BASE + "/courses"); await q.waitForTimeout(1200);
  faits.push(`Léo ouvre le caddie : « ${(await texte(q)).slice(0, 300)} »`);
  faits.push(`Profils : ${sql("select string_agg(name, ', ' order by created_at) from profiles")}`);
  obs("C8", "Un invité rejoint en cours de route, pendant que Karin fait les courses", faits);
});

// ── C9 : deux personnes ajoutent le même article en même temps, et cochent le même
await scenario("c9", async () => {
  const karin = await login("Karin"); const madji = await login("Madji");
  await karin.goto(BASE + "/courses"); await madji.goto(BASE + "/courses");
  const champ = (p) => p.getByPlaceholder("Ajouter un article…");
  await champ(karin).fill("Lait"); await champ(madji).fill("lait");
  await Promise.all([champ(karin).press("Enter"), champ(madji).press("Enter")]);
  await karin.waitForTimeout(2500);
  const faits = [`Lignes « lait » en base : ${sql("select count(*) from shopping_list_items where lower(name)='lait'")}`];
  await champ(karin).fill("Lait entier"); await champ(karin).press("Enter"); await karin.waitForTimeout(2500);
  faits.push(`Après « Lait entier » : ${sql("select string_agg(name||' x'||coalesce(quantity::text,'-'), ', ') from shopping_list_items")} ; Karin voit : « ${(await texte(karin)).replace(/.*La liste/, "La liste").slice(0, 160)} »`);
  await champ(karin).fill("2 L de lait"); await champ(karin).press("Enter"); await karin.waitForTimeout(2500);
  faits.push(`Après « 2 L de lait » : en base ${sql("select string_agg(name||' x'||coalesce(quantity::text,'-')||coalesce(unit,''), ', ') from shopping_list_items")} ; à l'écran de Karin (liste) : « ${(await karin.locator("ul").allInnerTexts()).join(" | ").replace(/\s+/g, " ").slice(0, 200)} »`);
  obs("C9", "Même article ajouté deux fois, par deux personnes ou avec une quantité", faits);
});

// ── C10 : beaucoup de chargements d'écran en même temps quand il n'y a pas de liste ouverte
await scenario("c10", async () => {
  aime(K, R.gratin); aime(M, R.gratin);
  const karin = await login("Karin");
  sql("delete from shopping_trips");
  const reponses = await Promise.all(Array.from({ length: 8 }, () => karin.request.get(BASE + "/courses").then((r) => r.status())));
  await karin.waitForTimeout(1500);
  obs("C10", "Huit écrans demandés en même temps sans liste ouverte", [`Statuts : ${reponses.join(",")}`, `Listes en base : ${trips().replace(/\n/g, " | ")}`, `Doublons d'articles : ${sql("select count(*) from (select trip_id, lower(name), count(*) from shopping_list_items group by 1,2 having count(*)>1) x")}`]);
});

// ── C11 : deux personnes disent « Miam » au même moment sur le même plat
await scenario("c11", async () => {
  const karin = await login("Karin"); const madji = await login("Madji");
  await karin.goto(BASE + "/envies"); await madji.goto(BASE + "/envies");
  await karin.waitForTimeout(1500);
  const titreCarte = async (p) => (await p.locator("h2").last().textContent().catch(() => "")).trim();
  const tk = await titreCarte(karin), tm = await titreCarte(madji);
  const faits = [`Cartes affichées : Karin « ${tk} », Madji « ${tm} »`];
  if (tk === tm) {
    await Promise.all([karin.getByRole("button", { name: "Miam" }).click(), madji.getByRole("button", { name: "Miam" }).click()]);
    await karin.waitForTimeout(3500);
    faits.push(`Swipes en base : ${sql("select count(*) from swipes where liked")} ; plats au Menu : ${sql("select string_agg(r.title, ' + ') from trip_recipes tr join recipes r on r.id=tr.recipe_id join shopping_trips t on t.id=tr.trip_id where t.status<>'done' and tr.selected")}`);
    faits.push(`Karin voit : « ${(await texte(karin, "body")).slice(0, 180)} »`);
    faits.push(`Madji voit : « ${(await texte(madji, "body")).slice(0, 180)} »`);
  }
  obs("C11", "Deux « Miam » au même moment sur le même plat", faits);
});

// ── C12 : « Quitter cette famille sur ce téléphone » : le téléphone reste-t-il abonné aux notifications ?
await scenario("c12", async () => {
  const p = await login("Madji");
  sql(`insert into push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent) values ('${M}', 'https://push.example/test-audit', 'k', 'a', 'audit')`);
  await p.goto(BASE + "/reglages");
  await p.getByRole("button", { name: "Quitter cette famille sur ce téléphone" }).click();
  await p.getByRole("button", { name: "Oui, quitter" }).click();
  await p.waitForTimeout(2000);
  obs("C12", "Quitter la famille sur ce téléphone", [`Après « Quitter » : adresse ${p.url().replace(BASE, "")}`, `Abonnement aux notifications encore en base : ${sql("select count(*) from push_subscriptions where endpoint='https://push.example/test-audit'")}`, `Profil de Madji encore dans la famille : ${sql("select count(*) from profiles where id='" + M + "'")}`]);
});

await browser.close();
fs.writeFileSync(`${OUT}/collectif.json`, JSON.stringify({ journal, erreursPage }, null, 2));
console.log(erreursPage.length ? `\nErreurs de page :\n${[...new Set(erreursPage)].join("\n")}` : "\nAucune erreur de page.");
