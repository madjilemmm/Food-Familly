// Une fausse source de recettes, pour les essais de bout en bout (reproductibles, sans réseau, avec pannes à la demande).
// Elle imite ce qui compte chez Marmiton : une recherche qui renvoie 21 fiches au plus, par popularité ; des fiches avec les données structurées
// d'une recette ; une vingtaine de recettes voisines sur chaque fiche ; beaucoup de quasi-doublons (« poulet curry coco maison / express ») ;
// des recettes qui ne passent pas les filtres (dessert, mal notées, sans photo).
// DIVERSE=1 : un grand fonds de plats VRAIMENT différents (30 bases × 40 façons : jusqu'à 1 200), voisins par base ou par façon de cuisiner.
// Lancer : POOL=300 PORT=3200 node tests/e2e/fake-marmiton.mjs     (puis lancer l'appli avec MARMITON_BASE=http://localhost:3200 KADDIE_TEST_SOURCES=1)
// Commandes : GET /__mode?m=ok|fail|slow|blocked  ·  GET /__pool?n=40 (ne montrer que les n premières recettes)  ·  GET /__stats  ·  GET /__reset
import http from "node:http";

const POOL = Number(process.env.POOL ?? 300);
const PORT = Number(process.env.PORT ?? 3200);
function hasard(graine) { let a = graine >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = hasard(Number(process.env.SEED ?? 7));

const PLATS = [
  ["poulet curry coco", "poulet", ["poulet", "lait de coco", "curry", "riz", "oignon"]], ["poulet roti aux herbes", "poulet", ["poulet", "thym", "ail", "pommes de terre"]],
  ["spaghetti bolognaise", "boeuf", ["spaghetti", "viande hachee", "tomates", "oignon"]], ["lasagnes de boeuf", "boeuf", ["lasagnes", "viande hachee", "bechamel", "tomates"]],
  ["gratin dauphinois", null, ["pommes de terre", "creme", "ail", "lait"]], ["hachis parmentier", "boeuf", ["viande hachee", "pommes de terre", "oignon"]],
  ["saumon a la creme", "poisson", ["saumon", "creme", "citron", "riz"]], ["cabillaud au four", "poisson", ["cabillaud", "citron", "tomates"]],
  ["chili con carne", "boeuf", ["viande hachee", "haricots rouges", "tomates", "piment"]], ["tacos de poulet", "poulet", ["tortillas", "poulet", "avocat", "oignon"]],
  ["risotto aux champignons", null, ["riz arborio", "champignons", "parmesan", "oignon"]], ["pizza maison", null, ["farine", "tomates", "mozzarella", "basilic"]],
  ["quiche lorraine", "porc", ["lardons", "oeufs", "creme", "pate brisee"]], ["tartiflette", "porc", ["pommes de terre", "reblochon", "lardons", "oignon"]],
  ["boeuf bourguignon", "boeuf", ["boeuf", "vin rouge", "carottes", "oignon"]], ["blanquette de veau", "veau", ["veau", "creme", "champignons", "carottes"]],
  ["curry de pois chiches", "vege", ["pois chiches", "lait de coco", "curry", "epinards"]], ["dahl de lentilles", "vege", ["lentilles", "curry", "tomates", "oignon"]],
  ["pad thai crevettes", "poisson", ["nouilles de riz", "crevettes", "cacahuetes", "citron vert"]], ["riz cantonais", "porc", ["riz", "jambon", "oeufs", "petits pois"]],
  ["burger maison", "boeuf", ["pain a burger", "steak hache", "cheddar", "salade"]], ["croque monsieur", "porc", ["pain de mie", "jambon", "gruyere", "bechamel"]],
  ["ratatouille", null, ["aubergines", "courgettes", "poivrons", "tomates"]], ["tajine de poulet", "poulet", ["poulet", "pruneaux", "carottes", "epices"]],
  ["couscous royal", "agneau", ["semoule", "agneau", "merguez", "legumes"]], ["fajitas de poulet", "poulet", ["poulet", "poivrons", "tortillas", "oignon"]],
  ["gnocchis gratines", null, ["gnocchis", "mozzarella", "tomates", "basilic"]], ["saute de porc au caramel", "porc", ["porc", "sauce soja", "sucre", "riz"]],
  ["moules marinieres", "poisson", ["moules", "vin blanc", "echalotes", "persil"]], ["omelette aux legumes", null, ["oeufs", "poivrons", "oignon", "fromage"]],
  ["pates carbonara", "porc", ["spaghetti", "lardons", "oeufs", "parmesan"]], ["poulet basquaise", "poulet", ["poulet", "poivrons", "tomates", "piment d espelette"]],
];
const VARIANTES = ["maison", "express", "facile", "au four", "gourmand", "de grand-mere", "a la poele", "traditionnel"];
const DESSERTS = ["tarte aux pommes", "mousse au chocolat", "far breton", "crepes sucrees"];
const slug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const BASES = ["poulet", "boeuf", "porc", "saumon", "cabillaud", "crevettes", "thon", "dinde", "agneau", "veau", "lentilles", "pois chiches", "haricots rouges", "tofu", "courgettes", "aubergines", "champignons", "poireaux", "patates douces", "potimarron", "brocolis", "epinards", "tomates", "poivrons", "pommes de terre", "riz", "pates", "semoule", "quinoa", "oeufs"];
const MANIERES = ["curry coco", "moutarde", "citron", "basquaise", "tikka", "teriyaki", "parmesan", "pesto", "chorizo", "miel", "gingembre", "paprika", "tomate basilic", "creme", "vin blanc", "soja", "harissa", "cacahuete", "barbecue", "provence", "ail persille", "chevre", "cumin", "olives", "moutarde ancienne", "curry vert", "sauce piquante", "lait de coco", "safran", "ratatouille", "au four", "a la poele", "gratine", "en cocotte", "wok", "tajine", "burger", "tacos", "lasagnes", "risotto"];
const recettes = [];
for (let i = 0; i < POOL; i++) {
  if (process.env.DIVERSE === "1") {
    const base = i % BASES.length, maniere = Math.floor(i / BASES.length) % MANIERES.length;
    const dessert = i % 17 === 5;
    recettes.push({
      id: 1000 + i, titre: `${BASES[base]} ${MANIERES[maniere]}`, famille: base, maniere, proteine: null, dessert,
      note: Math.round((3.4 + rnd() * 1.5) * 10) / 10, avis: Math.floor(rnd() * 320), photo: rnd() > 0.08,
      minutes: [15, 20, 25, 30, 40, 45, 60, 75, 90][Math.floor(rnd() * 9)], ingr: dessert ? ["farine", "sucre", "oeufs", "beurre"] : [BASES[base], ...MANIERES[maniere].split(" "), "oignon"],
    });
    continue;
  }
  const famille = i % PLATS.length;
  const [plat, proteine, ingr] = PLATS[famille];
  const variante = VARIANTES[Math.floor(i / PLATS.length) % VARIANTES.length];
  const dessert = i % 17 === 5;
  const titre = dessert ? `${DESSERTS[i % DESSERTS.length]} ${variante}` : `${plat} ${variante}`;
  recettes.push({
    id: 1000 + i, titre, famille, proteine: dessert ? null : proteine, dessert,
    note: Math.round((3.4 + rnd() * 1.5) * 10) / 10, avis: Math.floor(rnd() * 320), photo: rnd() > 0.08,
    minutes: [15, 20, 25, 30, 40, 45, 60, 75, 90][Math.floor(rnd() * 9)], ingr: dessert ? ["farine", "sucre", "oeufs", "beurre"] : ingr,
  });
}
const parId = new Map(recettes.map((r) => [r.id, r]));
let limite = POOL;
const visible = (r) => r.id - 1000 < limite;
const url = (r) => `/recettes/recette_${slug(r.titre)}_${r.id}.aspx`;
const voisines = (r) => { const dispo = recettes.filter(visible); if (process.env.DIVERSE === "1") { const g = hasard(r.id); const memeBase = dispo.filter((x) => x.famille === r.famille && x.id !== r.id); const memeFacon = dispo.filter((x) => x.maniere === r.maniere && x.id !== r.id); const pick = (xs, n) => { const o = []; for (let k = 0; k < Math.min(n, xs.length); k++) { const x = xs[Math.floor(g() * xs.length)]; if (!o.includes(x)) o.push(x); } return o; }; return [...new Set([...pick(memeBase, 6), ...pick(memeFacon, 6), ...pick(dispo, 6)])].filter((x) => x.id !== r.id); } const memeFamille = dispo.filter((x) => x.famille === r.famille && x.id !== r.id).slice(0, 6); const autres = []; const g = hasard(r.id); while (autres.length < Math.min(12, dispo.length - 1 - memeFamille.length)) { const x = dispo[Math.floor(g() * dispo.length)]; if (x.id !== r.id && !memeFamille.includes(x) && !autres.includes(x)) autres.push(x); } return [...memeFamille, ...autres]; };

let mode = "ok";
const stats = { recherches: 0, fiches: 0, refusees: 0 };
const fichesVues = new Set();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  if (u.pathname === "/__mode") { mode = u.searchParams.get("m") ?? "ok"; res.end(mode); return; }
  if (u.pathname === "/__stats") { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ ...stats, fichesUniques: fichesVues.size, mode, pool: POOL })); return; }
  if (u.pathname === "/__pool") { limite = Number(u.searchParams.get("n") ?? POOL); res.end(String(limite)); return; }
  if (u.pathname === "/__reset") { stats.recherches = stats.fiches = stats.refusees = 0; fichesVues.clear(); mode = "ok"; limite = POOL; res.end("ok"); return; }
  if (mode === "fail") { stats.refusees++; res.statusCode = 500; res.end("panne"); return; }
  if (mode === "blocked") { stats.refusees++; res.statusCode = 403; res.end("bloque"); return; }
  if (mode === "slow") await pause(15_000);
  res.setHeader("content-type", "text/html; charset=utf-8");
  if (u.pathname === "/recettes/recherche.aspx") {
    stats.recherches++;
    const mots = slug(u.searchParams.get("aqt") ?? "").split("-").filter((m) => m.length > 2);
    const note = (r) => mots.filter((m) => slug(r.titre).includes(m)).length;
    const liste = recettes.filter((r) => visible(r) && note(r) > 0).sort((a, b) => note(b) - note(a) || b.avis - a.avis).slice(0, 21);
    res.end(`<html><body>${liste.map((r) => `<a href="https://www.marmiton.org${url(r)}">${r.titre}</a>`).join("\n")}</body></html>`);
    return;
  }
  const m = u.pathname.match(/_(\d+)\.aspx$/);
  const r = m && parId.get(Number(m[1]));
  if (!r || !visible(r)) { res.statusCode = 404; res.end("introuvable"); return; }
  stats.fiches++; fichesVues.add(r.id);
  const ld = {
    "@context": "https://schema.org", "@type": "Recipe", name: r.titre, recipeCategory: r.dessert ? "Dessert" : "Plat principal",
    ...(r.photo ? { image: [`https://img.example.test/${r.id}.jpg`] } : {}), aggregateRating: { "@type": "AggregateRating", ratingValue: r.note, ratingCount: r.avis },
    totalTime: `PT${r.minutes}M`, recipeYield: "4 personnes",
    recipeIngredient: r.ingr.map((x, i) => `${100 + 50 * i} g de ${x}`),
    recipeInstructions: [{ "@type": "HowToStep", text: "Préparer tous les ingrédients et les couper." }, { "@type": "HowToStep", text: "Cuire doucement jusqu'à ce que ce soit prêt." }, { "@type": "HowToStep", text: "Servir chaud." }],
  };
  res.end(`<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body><h1>${r.titre}</h1>${voisines(r).map((v) => `<a href="${url(v)}">${v.titre}</a>`).join("\n")}</body></html>`);
}).listen(PORT, () => console.log(`fausse source sur :${PORT}, ${POOL} recettes`));
