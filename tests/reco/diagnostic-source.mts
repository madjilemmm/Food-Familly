// DIAGNOSTIC MANUEL (interroge marmiton.org : une quinzaine de pages) : pourquoi l'import n'ajoute rien ? Pour chaque recette candidate, quel filtre la refuse.
// Lancer : NODE_USE_ENV_PROXY=1 npx tsx tests/reco/diagnostic-source.mts "burrito express" "poulet roti" ...
import { extractRecipe } from "../../src/lib/domain/recipe-import";
import { pourJeunes } from "../../src/lib/domain/envies";
const termes = process.argv.slice(2);
const get = async (u: string) => { const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (compatible; KaddieBot/1.0)", accept: "text/html" } }); return r.ok ? await r.text() : null; };
const liens = (h: string) => [...new Set([...h.matchAll(/href="(?:https?:\/\/[^"\/]+)?(\/recettes\/recette_[^"#?]+\.aspx)"/g)].map((m) => `https://www.marmiton.org${m[1]}`))];
const motifs: Record<string, number> = {}; let total = 0; const exemples: Record<string, string[]> = {};
const noter = (m: string, t: string) => { motifs[m] = (motifs[m] ?? 0) + 1; (exemples[m] ??= []).length < 3 && exemples[m].push(t); };
for (const t of termes) {
  const h = await get(`https://www.marmiton.org/recettes/recherche.aspx?aqt=${encodeURIComponent(t)}`);
  if (!h) { console.log(`recherche « ${t} » : pas de réponse`); continue; }
  const l = liens(h).slice(0, 12); console.log(`recherche « ${t} » : ${liens(h).length} liens, 12 examinés`);
  const pages = await Promise.all(l.map(async (u) => [u, await get(u)] as const));
  for (const [u, page] of pages) {
    total++; const titreUrl = u.match(/recette_(.+?)_\d+/)?.[1] ?? u;
    if (!page) { noter("fiche non récupérée", titreUrl); continue; }
    const r = extractRecipe(page);
    if (!r) { noter("pas de données de recette lisibles", titreUrl); continue; }
    if (!/plat principal/i.test(r.category ?? "")) { noter(`catégorie « ${r.category ?? "aucune"} » ≠ plat principal`, r.title); continue; }
    if ((r.rating ?? 0) < 4) { noter("note < 4", `${r.title} (${r.rating})`); continue; }
    if ((r.ratingCount ?? 0) < 15) { noter("moins de 15 avis", `${r.title} (${r.ratingCount})`); continue; }
    if (!r.imageUrl) { noter("sans photo", r.title); continue; }
    if (r.ingredients.length < 3) { noter("moins de 3 ingrédients", r.title); continue; }
    if (!pourJeunes(r.title)) { noter("titre « pas pour les jeunes »", r.title); continue; }
    noter("ACCEPTÉE par la qualité", r.title);
  }
}
console.log(`\n${total} fiches examinées :`);
for (const [m, n] of Object.entries(motifs).sort((a, b) => b[1] - a[1])) console.log(`  ${n} × ${m}   ex. ${exemples[m].join(" | ")}`);
