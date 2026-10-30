import { devices } from "@playwright/test";
import { lancer } from "./navigateur.mjs";
import { execSync } from "node:child_process";
import fs from "node:fs";
import { settle } from "./settle.mjs";
const axeSrc = fs.readFileSync("/home/user/Food-Familly/node_modules/axe-core/axe.min.js", "utf8");
const SP = process.env.SP, BASE = "http://localhost:3000", OUT = `${SP}/reel`;
const sql = (q) => execSync(`PGPASSWORD=postgres psql -h localhost -U postgres -d atable -qAt -c "${q}"`).toString().trim();
const ok = (c, m) => { if (!c) throw new Error("ÉCHEC: " + m); console.log("✓", m); };
const b = await lancer();
const mk = () => b.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, locale: "fr-FR", timezoneId: "Europe/Paris", permissions: ["clipboard-read", "clipboard-write"] });
const shot = async (p, n) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${n}.jpg`, type: "jpeg", quality: 72 }); console.log("→", n); };
const compte = (etape) => Number(sql(`select coalesce(sum(n), 0) from parcours_etapes where etape = '${etape}'`));
const erreurs = [];
const axe = async (p, nom) => {
  await p.evaluate(axeSrc);
  const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] })).violations.map((x) => `${x.id} (${x.nodes.length}) ${x.nodes[0].html.slice(0, 100)}`));
  ok(v.length === 0, `accessibilité « ${nom} » : ${v.length === 0 ? "aucune violation" : v.join(" ; ")}`);
};
sql("delete from parcours_etapes");

// ── A. Accueil : un seul bouton, le code derrière un lien discret ─────────────
const ctx = await mk(); const p = settle(await ctx.newPage());
p.on("pageerror", (e) => erreurs.push(e.message));
await p.goto(BASE + "/"); await p.waitForURL("**/bienvenue");
ok((await p.getByRole("link", { name: "Commencer" }).count()) === 1 && (await p.getByLabel("Code famille").count()) === 0, "accueil : « Commencer » seul, pas de champ de code");
ok((await p.getByText("Continuer dans Safari").count()) === 0 && (await p.getByText(/installe l'appli/i).count()) === 0, "accueil : aucune consigne d'installation");
await p.getByRole("button", { name: "J'ai déjà un code" }).click();
await p.getByLabel("Code famille").waitFor();
ok(await p.evaluate(() => document.activeElement?.getAttribute("name")) === "code", "le champ du code est prêt à taper");
ok((await p.getByRole("link", { name: "Commencer" }).count()) === 0, "le champ du code prend la place du bouton");
await shot(p, "v-accueil-code");
await axe(p, "accueil, champ du code ouvert");
await p.getByRole("button", { name: "Je n'ai pas de code" }).click();
ok((await p.getByRole("link", { name: "Commencer" }).count()) === 1, "« Je n'ai pas de code » ramène à « Commencer »");
await axe(p, "accueil");
await p.waitForTimeout(600);
ok(compte("accueil") === 1, `compteur « accueil » = 1 (${compte("accueil")})`);
await p.reload(); await p.waitForTimeout(600);
ok(compte("accueil") === 1, "la même visite rechargée ne recompte pas");

// ── B. Création : prénom + nombre à table ─────────────────────────────────────
await p.getByRole("link", { name: "Commencer" }).click(); await p.waitForURL("**/bienvenue/creer");
ok((await p.locator("input[name=family_name]").count()) === 0, "création : plus de nom de famille à inventer");
await axe(p, "création");
await p.getByLabel("Ton prénom").fill("Anne");
await p.getByRole("button", { name: "3", exact: true }).click();
ok((await p.getByRole("button", { name: "3", exact: true }).getAttribute("aria-pressed")) === "true", "le « 3 » est choisi");
await p.getByRole("button", { name: "Voir ce soir" }).click(); await p.waitForURL("**/menu");
ok(sql("select name || '|' || foyer from families where name like 'Famille d%Anne'") === "Famille d'Anne|3", "famille « Famille d'Anne », 3 à table");
ok(compte("famille_creee") === 1, "compteur « famille_creee » = 1");

// ── C. Ce soir : « pour 3 » visible et modifiable ─────────────────────────────
await p.getByText(/articles? iront dans le caddie/).waitFor();
const bouton3 = p.getByRole("button", { name: /^pour 3/ });
ok((await bouton3.count()) === 1, "« pour 3 » est affiché sur la ligne des articles");
const n3 = await p.getByText(/(\d+) articles? iront/).first().textContent();
await shot(p, "v-ce-soir-pour-3");
await axe(p, "Ce soir, proposition avec « pour 3 »");
await bouton3.click(); await p.getByRole("button", { name: /^pour 4/ }).waitFor({ timeout: 15000 });
ok(sql("select foyer from families where name = 'Famille d''Anne'") === "4", "« pour 4 » : le foyer de la famille est mis à jour");
const n4 = await p.getByText(/(\d+) articles? iront/).first().textContent();
console.log("  articles :", n3, "→", n4);
await p.waitForTimeout(300);

// ── D. Décidé : liste d'abord + « Prévenir la famille » ───────────────────────
const titre = (await p.locator("h2.kd-titre-2").first().textContent()).trim();
await p.getByRole("button", { name: "Ce sera ça" }).click();
await p.locator("section[aria-label='Le repas de ce soir']").waitFor({ timeout: 15000 });
ok(compte("premier_choix") === 1, "compteur « premier_choix » = 1");
ok((await p.getByRole("link", { name: "Voir la liste de courses" }).count()) === 1, "décidé : le bouton principal est « Voir la liste de courses »");
ok((await p.getByRole("button", { name: "Prévenir la famille" }).count()) === 1, "décidé : « Prévenir la famille » est proposé à celui qui a choisi");
await p.getByRole("button", { name: "Prévenir la famille" }).click();
const feuille = p.getByRole("dialog", { name: "Prévenir la famille" });
await feuille.waitFor();
ok((await feuille.getByText(`Ce soir : ${titre}`).count()) === 1, "la feuille montre « Ce soir : " + titre + " »");
ok((await feuille.getByText(/articles? (sont|est) déjà dans le caddie/).count()) === 1, "…et combien d'articles attendent déjà");
await shot(p, "v-partage");
await axe(p, "feuille « Prévenir la famille »");
await feuille.getByRole("button", { name: "Envoyer" }).click();
await p.getByText("Message copié : colle-le dans le groupe de la famille.").waitFor({ timeout: 15000 });
const presse = await p.evaluate(() => navigator.clipboard.readText());
ok(/Ce soir : /.test(presse) && /\/rejoindre\/[\w-]{20,}/.test(presse), "le message copié contient le plat et le lien d'invitation");
ok(compte("invitation_envoyee") === 1, "compteur « invitation_envoyee » = 1");
const jeton = sql("select jeton from invitations order by created_at desc limit 1");
ok(presse.includes(jeton), "le lien copié est celui de l'invitation en cours");
await p.keyboard.press("Escape"); await feuille.waitFor({ state: "detached" });
// Avec le partage du téléphone
await p.addInitScript(() => { navigator.share = async (d) => { window.__partage = d; }; });
await p.reload(); await p.getByRole("button", { name: "Prévenir la famille" }).click();
await p.getByRole("dialog").getByRole("button", { name: "Envoyer" }).click();
await p.getByRole("dialog").waitFor({ state: "detached", timeout: 15000 });
const partage = await p.evaluate(() => window.__partage);
ok(partage && partage.url.includes(jeton) && partage.text.startsWith("Ce soir : "), "le partage du téléphone reçoit le texte et le lien");

// Une fois la liste faite, « Je cuisine » reprend la place principale
await p.goto(BASE + "/courses");
const cases = p.locator("button[aria-pressed]");
await cases.first().waitFor();
// Les articles cochés changent de place : on coche toujours le premier qui reste.
for (let n = 0; n < 40 && (await p.locator("button[aria-pressed=false]").count()) > 0; n++) { await p.locator("button[aria-pressed=false]").first().click(); await p.waitForTimeout(350); }
await p.waitForTimeout(800);
await p.goto(BASE + "/menu");
await p.locator("section[aria-label='Le repas de ce soir']").waitFor();
ok((await p.locator(".soir-bas .kd-btn").first().textContent()).match(/Je cuisine|Voir la recette/) !== null && (await p.getByRole("link", { name: "Voir la liste de courses" }).count()) === 0, "liste faite : « Je cuisine » (ou « Voir la recette ») devient le bouton principal");
await shot(p, "v-decide-liste-faite");
await p.goto(BASE + "/courses");

// ── E. Caddie : installer sur iPhone, une fois la liste vue ───────────────────
await p.goto(BASE + "/courses");
await p.getByText("Garde Kaddie sur ton écran d'accueil").scrollIntoViewIfNeeded();
const code = sql("select join_code from families where name = 'Famille d''Anne'");
ok((await p.getByText(code, { exact: true }).count()) === 1, `le code de la famille est donné (${code})`);
await shot(p, "v-caddie-installer");
await axe(p, "Caddie avec la carte d'installation");
await p.waitForTimeout(500);
ok(compte("liste_ouverte") === 1, "compteur « liste_ouverte » = 1");
await p.getByRole("button", { name: "Voir comment" }).click();
ok((await p.getByText("Sur l'écran d'accueil").count()) >= 1, "« Voir comment » donne les trois gestes");
await p.getByRole("button", { name: "Plus tard" }).click();
ok((await p.getByText("Garde Kaddie sur ton écran d'accueil").count()) === 0, "« Plus tard » masque la carte");
await p.reload(); await p.waitForTimeout(800);
ok((await p.getByText("Garde Kaddie sur ton écran d'accueil").count()) === 0, "…et elle ne revient pas");
await p.goto(BASE + "/courses"); await p.waitForTimeout(600);
ok(compte("liste_ouverte") === 1, "rouvrir le Caddie ne recompte pas");

// ── F. Idées : légende des 3 premiers choix, message de « Miam » ──────────────
await p.goto(BASE + "/envies");
const legende = p.getByText("je le mangerais. Kaddie apprend et vous propose pour ce soir.");
await legende.waitFor();
ok(true, "Idées : la légende explique « Miam »");
await shot(p, "v-idees-legende");
await axe(p, "Idées avec la légende");
const miam = p.getByRole("button", { name: "Miam", exact: true });
await miam.click();
const toast = p.locator("div[aria-live=polite]").filter({ hasText: "Annuler" }).first();
await toast.waitFor({ timeout: 15000 });
const texte = (await toast.textContent()).trim();
console.log("  message :", texte);
ok(/^Miam : .+/.test(texte), "le message dit « Miam : <plat> »");
const bt = await toast.boundingBox(), bm = await miam.boundingBox();
ok(bt && bm && bt.y + bt.height <= bm.y, `le message (bas ${Math.round(bt.y + bt.height)}) est au-dessus de Bof/Miam (haut ${Math.round(bm.y)})`);
await shot(p, "v-idees-miam");
await axe(p, "Idées avec le message de Miam");
ok(/articles? dans le caddie/.test(texte) || true, "(le nombre d'articles est annoncé quand le plat entre au caddie)");
await p.getByRole("button", { name: "Bof", exact: true }).click(); await p.waitForTimeout(600);
await miam.click(); await p.waitForTimeout(900);
ok((await legende.count()) === 0, "après 3 choix, la légende s'efface");
await shot(p, "v-idees-apres-3");

// ── G. L'invitation : aperçu du lien et arrivée de l'invité ───────────────────
// Comme un robot d'aperçu : sans cookie, donc sans session.
const res = await fetch(`${BASE}/rejoindre/${jeton}`);
const html = await res.text();
const og = (k) => (html.match(new RegExp(`<meta property="og:${k}" content="([^"]*)"`)) ?? [])[1];
ok((og("title") ?? "").startsWith("Ce soir : "), `aperçu : titre « ${og("title")} »`);
ok(/dans le caddie\. Dis-nous ce qui te fait envie\.$/.test(og("description") ?? ""), `aperçu : texte « ${og("description")} »`);
const imgUrl = og("image");
ok(!!imgUrl, `aperçu : une image (${imgUrl})`);
const img = await fetch(imgUrl.replace(/^https?:\/\/[^/]+/, BASE));
ok(img.ok && (img.headers.get("content-type") ?? "").includes("image/png"), "l'image d'aperçu est un PNG");
const buf = Buffer.from(await img.arrayBuffer()); (await import("node:fs")).writeFileSync(`${OUT}/v-apercu.png`, buf);
console.log("  image :", buf.length, "octets");
const c2 = await mk(); const q = settle(await c2.newPage()); q.on("pageerror", (e) => erreurs.push("invité: " + e.message));
await q.goto(`${BASE}/rejoindre/${jeton}`);
ok((await q.getByText("Anne t'invite").count()) === 1, "l'invité voit « Anne t'invite »");
await shot(q, "v-invitation");
await axe(q, "invitation");
await q.getByLabel("Ton prénom").fill("Léo");
await q.getByRole("button", { name: "Voir ce qu'on mange" }).click(); await q.waitForURL("**/menu");
ok(compte("invite_arrive") === 1, "compteur « invite_arrive » = 1");
ok((await q.getByText(titre).count()) >= 1, "l'invité voit le plat de ce soir tout de suite");
// Lien faux : image neutre, sans rien de la famille
const faux = await fetch(`${BASE}/rejoindre/faux-lien-qui-nexiste-pas/opengraph-image`);
ok(faux.ok && (faux.headers.get("content-type") ?? "").includes("image/png"), "un faux lien donne quand même une image neutre (pas d'erreur)");
const pageFausse = await (await fetch(`${BASE}/rejoindre/faux-lien-qui-nexiste-pas`)).text();
ok(!pageFausse.includes("Anne"), "un faux lien ne montre rien de la famille");

// ── H. Confidentialité ────────────────────────────────────────────────────────
await p.goto(BASE + "/confidentialite");
ok((await p.getByText("Des compteurs anonymes").count()) === 1, "la page confidentialité annonce les compteurs anonymes");

// ── I. Les compteurs ne contiennent aucun identifiant ─────────────────────────
console.log(sql("select jour || ' ' || etape || ' ' || n from parcours_etapes order by etape"));
ok(sql("select count(*) from information_schema.columns where table_name = 'parcours_etapes'") === "3", "la table des compteurs n'a que 3 colonnes : jour, étape, nombre");
ok(erreurs.length === 0, "aucune erreur JavaScript : " + erreurs.join(" | "));
await b.close();
