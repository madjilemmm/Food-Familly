// Le ressenti : « Annuler » après « Ce sera ça », les articles qui arrivent dans le caddie, le match annoncé sans interrompre.
import { devices } from "@playwright/test";
import { execSync } from "node:child_process";
import { lancer } from "./navigateur.mjs";
import { settle } from "./settle.mjs";

const SP = process.env.SP, BASE = "http://localhost:3000";
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
const K = "00000000-0000-4000-8000-000000000001", M = "00000000-0000-4000-8000-000000000002";
const GRATIN = "10000000-0000-4000-8000-000000000003";
const resultats = [];
const ok = (cond, msg) => { resultats.push(Boolean(cond)); console.log(`${cond ? "✓" : "✗"} ${msg}`); };
const aime = (profil, recette) => sql(`insert into swipes (profile_id, recipe_id, liked, swiped_at, liked_at) values ('${profil}','${recette}',true,now(),now()) on conflict do nothing`);

const b = await lancer();
async function login(nom) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris" });
  const p = settle(await ctx.newPage());
  await p.goto(BASE + "/");
  await p.getByRole("button", { name: "J'ai déjà un code" }).click();
  await p.getByLabel("Code famille").fill(" Poulet Test ");
  await p.getByRole("button", { name: "C'est parti" }).click();
  await p.waitForURL("**/profil");
  await p.getByRole("button", { name: nom }).click();
  await p.waitForURL(/menu|envies|courses/);
  return p;
}
async function scenario(titre, f) {
  console.log(`\n▶ ${titre}`);
  execSync(`bash ${SP}/restore-base.sh`, { stdio: "ignore" });
  execSync(`bash ${SP}/reset.sh`);
  try { await f(); } catch (e) { ok(false, `scénario interrompu : ${String(e.message).split("\n")[0]}`); }
}

await scenario("« Ce sera ça » : les articles arrivent, puis « Annuler » défait", async () => {
  aime(K, GRATIN); aime(M, GRATIN);
  const karin = await login("Karin");
  await karin.goto(BASE + "/menu");
  const section = karin.locator("section[aria-label='La proposition de ce soir']");
  await section.waitFor({ timeout: 8000 });
  await karin.getByRole("button", { name: "Ce sera ça" }).click();
  await karin.locator("section[aria-label='Le repas de ce soir']").waitFor({ timeout: 10000 });
  ok(true, "le repas de ce soir est retenu");
  const bandeau = karin.getByRole("button", { name: "Annuler" });
  await bandeau.waitFor({ timeout: 3000 });
  ok(/Au menu ce soir/.test(await karin.locator("[aria-live='polite']").last().innerText()), "le bandeau dit « Au menu ce soir : … »");
  ok((await karin.locator(".kd-arrivee").count()) === 1, "la ligne du caddie se pose (animation d'arrivée)");
  ok((await karin.locator("[data-pastille='Caddie'].kd-tick").count()) === 1, "le compteur du caddie marque le coup");
  ok((await karin.getByRole("button", { name: "Ce sera ça" }).count()) === 0, "pas de second « Ce sera ça »");
  await bandeau.click();
  await karin.locator("section[aria-label='La proposition de ce soir']").waitFor({ timeout: 10000 });
  ok(sql("select count(*) from ce_soir_choix") === "0", "« Annuler » : le choix est défait en base");
  ok(sql("select count(*) from pas_ce_soir") === "0", "le plat n'est pas écarté pour deux jours");
  // Revenir plus tard sur l'écran ne rejoue pas l'animation.
  await karin.getByRole("button", { name: "Ce sera ça" }).click();
  await karin.locator("section[aria-label='Le repas de ce soir']").waitFor({ timeout: 10000 });
  await karin.waitForTimeout(5800);
  await karin.reload();
  await karin.locator("section[aria-label='Le repas de ce soir']").waitFor({ timeout: 8000 });
  ok((await karin.locator(".kd-arrivee").count()) === 0, "au rechargement, rien ne se rejoue");
});

await scenario("Un accord s'annonce par un bandeau, sans interrompre", async () => {
  aime(M, GRATIN);
  const karin = await login("Karin");
  await karin.goto(BASE + "/envies");
  const titre = (await karin.locator("h2").last().textContent()).trim();
  await karin.getByRole("button", { name: "Miam", exact: true }).click();
  const voir = karin.getByRole("link", { name: "Voir" });
  await voir.waitFor({ timeout: 5000 });
  ok((await karin.locator("[role=dialog]").count()) === 0, "aucune fenêtre ne bloque l'écran");
  ok(new RegExp(`Madji et toi : ${titre.replace(/[()]/g, "\\$&")}`).test(await karin.locator("[aria-live='polite']").first().innerText()), `le bandeau dit « Madji et toi : ${titre} »`);
  await karin.getByRole("button", { name: "Bof", exact: true }).click();
  await karin.getByText(/^Bof : /).waitFor({ timeout: 3000 });
  ok(true, "on peut continuer à swiper tout de suite (le « Bof » est pris)");
  ok(sql(`select count(*) from swipes where profile_id='${K}'`) === "2", "les deux réponses sont enregistrées");
});

await b.close();
const echecs = resultats.filter((r) => !r).length;
console.log(`\n${resultats.length - echecs}/${resultats.length} vérifications passent`);
process.exit(echecs ? 1 : 0);
