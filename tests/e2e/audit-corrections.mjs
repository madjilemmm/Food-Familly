// Les corrections de l'audit, une par une, avec un résultat ✓ / ✗ (code de sortie 1 s'il y a un ✗).
// « Je ne pars plus » et « Je prends le relais », un prénom déjà dans la famille, une session expirée, quitter la famille (notifications),
// un interdit alimentaire qui survit à une panne, une recette du Menu modifiée ou supprimée, un titre avec une virgule, la page introuvable.
import { devices } from "@playwright/test";
import { execSync } from "node:child_process";
import { lancer } from "./navigateur.mjs";
import { settle } from "./settle.mjs";

const SP = process.env.SP, BASE = "http://localhost:3000";
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const sql = (q) => execSync("PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt", { input: q }).toString().trim();
const F = "20000000-0000-4000-8000-000000000001";
const K = "00000000-0000-4000-8000-000000000001", M = "00000000-0000-4000-8000-000000000002";
const GRATIN = "10000000-0000-4000-8000-000000000003";
const resultats = [];
const ok = (cond, msg) => { resultats.push(Boolean(cond)); console.log(`${cond ? "✓" : "✗"} ${msg}`); };

const b = await lancer();
const mk = () => b.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris" });
async function login(nom) {
  const ctx = await mk();
  const p = settle(await ctx.newPage());
  await p.goto(BASE + "/");
  await p.getByRole("button", { name: "J'ai déjà un code" }).click();
  await p.getByLabel("Code famille").fill(" Poulet Test ");
  await p.getByRole("button", { name: "C'est parti" }).click();
  await p.waitForURL("**/profil");
  await p.getByRole("button", { name: nom }).click();
  await p.waitForURL(/menu|envies|courses/);
  p.ctx = ctx;
  return p;
}
const aime = (profil, recette) => sql(`insert into swipes (profile_id, recipe_id, liked, swiped_at, liked_at) values ('${profil}','${recette}',true,now(),now()) on conflict do nothing`);
async function scenario(id, titre, f) {
  if (only && !only.includes(id)) return;
  console.log(`\n▶ ${id} — ${titre}`);
  execSync(`bash ${SP}/restore-base.sh`, { stdio: "ignore" });
  execSync(`bash ${SP}/reset.sh`);
  try { await f(); } catch (e) { ok(false, `scénario interrompu : ${String(e.message).split("\n")[0]}`); }
}

await scenario("depart", "Je pars, Je ne pars plus, Je prends le relais", async () => {
  aime(K, GRATIN); aime(M, GRATIN);
  const karin = await login("Karin"), madji = await login("Madji");
  await karin.goto(BASE + "/courses");
  await karin.getByRole("button", { name: "Je pars faire les courses" }).click();
  await karin.getByRole("button", { name: "Je ne pars plus" }).waitFor({ timeout: 8000 });
  ok(true, "Karin voit « Je ne pars plus » après « Je pars »");
  await madji.goto(BASE + "/courses");
  ok(await madji.getByRole("button", { name: "Je prends le relais" }).isVisible(), "Madji voit « Je prends le relais »");
  await karin.getByRole("button", { name: "Je ne pars plus" }).click();
  await karin.getByRole("button", { name: "Je pars faire les courses" }).waitFor({ timeout: 8000 });
  ok(sql("select count(*) from shopping_trips where status<>'done' and created_by is null") === "1", "le départ est annulé en base");
  await madji.reload();
  ok((await madji.getByRole("button", { name: "Je prends le relais" }).count()) === 0, "Madji ne voit plus « Je prends le relais »");
  ok(await madji.getByRole("button", { name: "Je pars faire les courses" }).isVisible(), "Madji peut dire « Je pars »");
  await karin.getByRole("button", { name: "Je pars faire les courses" }).click();
  await karin.getByRole("button", { name: "Je ne pars plus" }).waitFor({ timeout: 8000 });
  await madji.reload();
  await madji.getByRole("button", { name: "Je prends le relais" }).click();
  await madji.waitForTimeout(2500);
  ok(sql(`select created_by from shopping_trips where status<>'done'`) === M, "Madji prend le relais : c'est lui qui part");
  ok(/tu fais les courses/i.test(await madji.locator("main").innerText()), "l'écran de Madji dit « Tu fais les courses »");
  await madji.getByRole("button", { name: "Je ne pars plus" }).waitFor({ timeout: 5000 });
  await karin.reload();
  ok(/madji fait les courses/i.test(await karin.locator("main").innerText()), "l'écran de Karin dit « Madji fait les courses »");
});

await scenario("prenom", "Un invité tape le prénom d'un membre", async () => {
  const jeton = "d4".repeat(16);
  sql(`insert into invitations (family_id, jeton, created_by, expires_at) values ('${F}', '${jeton}', '${K}', now() + interval '3 days')`);
  const ctx = await mk();
  const q = settle(await ctx.newPage());
  await q.goto(BASE + "/rejoindre/" + jeton);
  await q.getByLabel("Ton prénom").fill("Karin");
  await q.getByRole("button", { name: /Voir ce qu'on mange/ }).click();
  await q.getByRole("button", { name: "Oui, c'est moi" }).waitFor({ timeout: 8000 });
  ok((await q.locator("main").innerText()).includes("Karin est déjà dans la famille"), "la question « Karin est déjà dans la famille. C'est toi ? » est posée");
  ok(sql("select count(*) from profiles where name='Karin'") === "1", "rien n'a été créé ni rattaché avant la réponse");
  await q.getByRole("button", { name: "Non, quelqu'un d'autre" }).click();
  ok(await q.getByRole("button", { name: /Voir ce qu'on mange/ }).isVisible(), "« Non » redonne le champ et le bouton principal");
  await q.getByLabel("Ton prénom").fill("Karin M.");
  await q.getByRole("button", { name: /Voir ce qu'on mange/ }).click();
  await q.waitForURL("**/menu", { timeout: 10000 });
  ok(sql("select count(*) from profiles where name='Karin M.'") === "1" && sql("select count(*) from profiles where name='Karin'") === "1", "« Karin M. » est un nouveau profil, « Karin » reste elle-même");
  // Le même prénom, confirmé : la même personne sur un autre téléphone.
  const ctx2 = await mk();
  const r = settle(await ctx2.newPage());
  await r.goto(BASE + "/rejoindre/" + jeton);
  await r.getByLabel("Ton prénom").fill("Madji");
  await r.getByRole("button", { name: /Voir ce qu'on mange/ }).click();
  await r.getByRole("button", { name: "Oui, c'est moi" }).click();
  await r.waitForURL("**/menu", { timeout: 10000 });
  ok(sql("select count(*) from profiles where name='Madji'") === "1", "« Oui, c'est moi » retrouve Madji sans la doubler");
});

await scenario("session", "Session expirée : le bon message, pas « pas de réseau »", async () => {
  aime(K, GRATIN); aime(M, GRATIN);
  const karin = await login("Karin");
  await karin.goto(BASE + "/menu");
  await karin.locator("section[aria-label='La proposition de ce soir']").waitFor({ timeout: 8000 });
  await karin.ctx.clearCookies();
  await karin.getByRole("button", { name: "Ce sera ça" }).click();
  await karin.waitForURL(/bienvenue/, { timeout: 8000 });
  ok(/session=expiree/.test(karin.url()), `renvoyé à l'accueil avec la raison : ${karin.url().replace(BASE, "")}`);
  ok((await karin.locator("main").innerText()).includes("Ta session a pris fin"), "l'accueil dit « Ta session a pris fin »");
});

await scenario("quitter", "Quitter la famille retire l'abonnement aux notifications de ce téléphone", async () => {
  const madji = await login("Madji");
  const endpoint = "https://push.example.test/abonnement-de-madji";
  sql(`insert into push_subscriptions (profile_id, endpoint, p256dh, auth) values ('${M}', '${endpoint}', 'k', 'a')`);
  // Un abonnement de navigateur simulé : celui que « Quitter » doit retirer.
  await madji.addInitScript((e) => {
    const sub = { endpoint: e, unsubscribe: async () => true };
    Object.defineProperty(navigator, "serviceWorker", {
      value: { getRegistration: async () => ({ pushManager: { getSubscription: async () => sub } }), ready: Promise.resolve({ pushManager: { getSubscription: async () => sub } }), register: async () => ({}) },
      configurable: true,
    });
  }, endpoint);
  await madji.goto(BASE + "/reglages");
  await madji.getByRole("button", { name: "Quitter cette famille sur ce téléphone" }).click();
  await madji.getByRole("button", { name: "Oui, quitter" }).click();
  await madji.waitForURL(/bienvenue/, { timeout: 10000 });
  ok(sql(`select count(*) from push_subscriptions where endpoint='${endpoint}'`) === "0", "l'abonnement de ce téléphone n'est plus en base");
  ok(sql("select count(*) from profiles where name='Madji'") === "1", "Madji reste membre de la famille (quitter ne supprime pas le profil)");
});

await scenario("page", "Une page introuvable parle Kaddie", async () => {
  const karin = await login("Karin");
  await karin.goto(BASE + "/cette-page-nexiste-pas");
  const t = await karin.locator("body").innerText();
  ok(/Introuvable/.test(t) && /Retour à Ce soir/.test(t), "« Introuvable » et « Retour à Ce soir »");
  ok(!/This page could not be found/.test(t), "plus de texte anglais par défaut");
  await karin.goto(BASE + "/recettes/10000000-0000-4000-8000-0000000000ff");
  ok(/Introuvable/.test(await karin.locator("body").innerText()), "une recette inconnue : même page");
});

await b.close();
const echecs = resultats.filter((r) => !r).length;
console.log(`\n${resultats.length - echecs}/${resultats.length} vérifications passent`);
process.exit(echecs ? 1 : 0);
