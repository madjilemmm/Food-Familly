import "server-only";
import { broadcastRefresh, db } from "@/lib/supabase/server";
import { extractRecipe, type ImportedRecipe } from "@/lib/domain/recipe-import";
import { safeFetch } from "@/lib/safe-fetch";
import { recipeConflicts } from "@/lib/domain/foods";
import { getFamilyEnvies, getFamilySwipes, getFamilyTastes, getProfiles, getProfilsGouts, getRecipes } from "@/lib/data";
import { dureeMax, lireEnvies, pourJeunes } from "@/lib/domain/envies";
import { etiquettesPreferees } from "@/lib/domain/profil-gouts";
import { choisirTermes, recettesAOublier, tropProche } from "@/lib/domain/recherche";
import { piocherDansLeCatalogue } from "@/lib/catalogue";
import { prendreLeVerrou, terminerImport, lireEtatImport } from "@/lib/import-etat";

/*
 * Recettes importées toutes seules depuis Marmiton, pour que le swipe ne
 * s'arrête jamais : quand une famille n'a presque plus de plats à découvrir,
 * on cherche sur Marmiton des plats que les jeunes aiment (selon les envies de
 * la famille : burgers, pâtes, mexicain…) et on garde les plats principaux
 * populaires, sans régime ni abats. Les pages de recherche (1re page) et de
 * recettes sont autorisées par le robots.txt de Marmiton ; on reste discret.
 *
 * Un import est CADRÉ : un seul à la fois par famille (verrou partagé en base), un délai qui s'allonge quand il ne trouve rien, un budget
 * de temps et de pages, la mémoire des recherches qui n'ont rien donné. Voir import-etat.ts.
 */

/** Pour les essais de bout en bout : une fausse source locale à la place de marmiton.org (jamais renseignée en production). */
const BASE = process.env.MARMITON_BASE ?? "https://www.marmiton.org";
const PAR_IMPORT = 12;
/** On prépare la suite avant d'être à court : sous ce nombre de plats jamais vus, un import est tenté. */
const RESERVE = 24;
const RECHERCHES_PAR_IMPORT = 4;
const NB_GRAINES = 2;
const ESSAIS_MAX = 40;
const OUBLI_JOURS = 28;
/** Un import ne dépasse pas ce temps (la fonction serveur est coupée à 60 s) ; le verrou expire un peu après. */
const BUDGET_MS = 25_000;
const VERROU_MS = 45_000;
const DELAI_PAGE_MS = 6_000;

/** Assez de plats à découvrir ? Sinon on en ajoute (appelé après l'affichage du swipe). */
export async function remplirSiBesoin(familyId: string, nouveautes: number) {
  if (nouveautes >= RESERVE) return;
  // Un seul import à la fois, pour toute la famille, sur tous les serveurs ; et pas avant le délai prévu après un essai vide ou en panne.
  if ((await prendreLeVerrou(familyId, VERROU_MS)) === "refuse") return;
  let ajoutees = 0;
  let termesVides: string[] = [];
  let resultat: "ajoutees" | "rien" | "erreur" = "erreur";
  try {
    ({ ajoutees, termesVides, resultat } = await remplir(familyId));
  } catch (err) {
    console.warn("Import impossible :", err);
  } finally {
    await terminerImport(familyId, resultat, ajoutees, termesVides).catch(() => {});
  }
  // Les téléphones ouverts sur le swipe reçoivent les nouvelles cartes.
  if (ajoutees > 0) await broadcastRefresh(familyId);
}

export { lireEtatImport };

async function remplir(familyId: string): Promise<{ ajoutees: number; termesVides: string[]; resultat: "ajoutees" | "rien" | "erreur" }> {
  await oublierLesRecettesBoudees(familyId);
  // La source principale : le catalogue commun (recettes complètes, avec photo, de sources autorisées), sans appel au réseau.
  const duCatalogue = await piocherDansLeCatalogue(familyId, PAR_IMPORT).catch((err) => {
    console.warn("Catalogue commun impossible :", err);
    return 0;
  });
  // Marmiton n'est plus qu'un complément. IMPORT_MARMITON=0 le coupe (conditions d'utilisation de Marmiton : pas d'extraction de sa base hors usage privé).
  let deMarmiton = { ajoutees: 0, termesVides: [] as string[], joignable: true };
  if (duCatalogue < PAR_IMPORT && process.env.IMPORT_MARMITON !== "0") {
    deMarmiton = await importer(familyId, PAR_IMPORT - duCatalogue).catch((err) => {
      console.warn("Import Marmiton impossible :", err);
      return { ajoutees: 0, termesVides: [], joignable: false };
    });
  }
  const ajoutees = duCatalogue + deMarmiton.ajoutees;
  return { ajoutees, termesVides: deMarmiton.termesVides, resultat: ajoutees > 0 ? "ajoutees" : deMarmiton.joignable ? "rien" : "erreur" };
}

/** Un bon plat pour le swipe : un plat principal populaire, pour des jeunes, avec photo et ingrédients. */
export function estUnBonPlat(r: ImportedRecipe): boolean {
  return (
    /plat principal/i.test(r.category ?? "") &&
    (r.rating ?? 0) >= 4 &&
    (r.ratingCount ?? 0) >= 15 &&
    Boolean(r.imageUrl) &&
    r.ingredients.length >= 3 &&
    pourJeunes(r.title)
  );
}

/** Le titre d'une recette lu dans son adresse (« …/recette_gratin-dauphinois_12345.aspx » → « gratin dauphinois »). */
function titreDepuisLien(lien: string): string {
  return (lien.match(/recette_(.+?)_\d+\.aspx/)?.[1] ?? "").replace(/-/g, " ");
}

/** Les liens de recettes d'une page (résultats de recherche, ou fiche de recette), absolus. */
function liensDeRecettes(html: string): string[] {
  const liens = html.matchAll(/href="(?:https?:\/\/[^"\/]+)?(\/recettes\/recette_[^"#?]+\.aspx)"/g);
  return [...new Set([...liens].map((m) => `${BASE}${m[1]}`))];
}

/** Les liens de recettes de la 1re page de résultats d'une recherche. `null` : la source n'a pas répondu (à distinguer d'une recherche sans résultat). */
async function chercher(terme: string): Promise<string[] | null> {
  try {
    const page = await safeFetch(`${BASE}/recettes/recherche.aspx?aqt=${encodeURIComponent(terme)}`, { maxBytes: 3 * 1024 * 1024, accept: "text/html", timeoutMs: DELAI_PAGE_MS });
    return liensDeRecettes(page.body.toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Les recettes voisines d'une recette : sa page en propose une vingtaine d'autres. Les fiches de recettes sont autorisées par le robots.txt
 * (comme la 1re page de recherche) ; chaque recette trouvée ouvre une vingtaine de voisines, à explorer à partir de ce que la famille aime déjà.
 */
async function voisines(url: string): Promise<string[] | null> {
  try {
    const page = await safeFetch(url, { maxBytes: 3 * 1024 * 1024, accept: "text/html", timeoutMs: DELAI_PAGE_MS });
    return liensDeRecettes(page.body.toString("utf8")).filter((l) => l !== url);
  } catch {
    return null;
  }
}

async function importer(familyId: string, combien: number): Promise<{ ajoutees: number; termesVides: string[]; joignable: boolean }> {
  const debut = Date.now();
  const [{ members, strict }, profiles, dejaLa, recipes, profils, enviesDuMoment, avis, etat] = await Promise.all([
    getFamilyTastes(familyId),
    getProfiles(familyId),
    db().from("recipes").select("source_url").eq("family_id", familyId).not("source_url", "is", null),
    getRecipes(familyId),
    getProfilsGouts(familyId),
    getFamilyEnvies(familyId),
    getFamilySwipes(familyId),
    lireEtatImport(familyId),
  ]);
  const envies = profiles.map((p) => lireEnvies(p.envies));
  const maxi = dureeMax(envies);
  const connus = new Set((dejaLa.data ?? []).map((r) => r.source_url as string));
  const titres = recipes.map((r) => r.title);

  // Quelques recherches ciblées (domain/recherche.ts) : plats voisins des envies du moment, styles que la famille aime vraiment, saison ;
  // on ne refait pas une recherche qui n'a rien donné ces derniers jours.
  const titresEnvies = recipes.filter((r) => enviesDuMoment.has(r.id)).map((r) => r.title);
  const termes = choisirTermes(
    { envies, stylesAimes: etiquettesPreferees([...profils.values()], "style:", 3), matchs: titresEnvies, mois: new Date().getMonth() },
    RECHERCHES_PAR_IMPORT,
    Math.random,
    etat.termesAEviter,
  );
  // Les voisines de deux recettes de la famille : d'abord celles que quelqu'un a aimées, sinon des recettes importées au hasard.
  const importees = recipes.filter((r) => r.source_url);
  const aimees = importees.filter((r) => [...(avis.get(r.id)?.values() ?? [])].some((a) => a.likedAt != null));
  const graines = melange(aimees.length >= NB_GRAINES ? aimees : [...aimees, ...importees.filter((r) => !aimees.includes(r))]).slice(0, NB_GRAINES);
  const [resultats, voisins] = await Promise.all([Promise.all(termes.map(chercher)), Promise.all(graines.map((r) => voisines(r.source_url!)))]);
  const reponses = [...resultats, ...voisins];
  // Aucune réponse : la source est en panne ou nous bloque, ce n'est pas « rien de nouveau ».
  const joignable = reponses.some((r) => r !== null) || reponses.length === 0;
  // Inutile de télécharger une fiche dont le titre (lu dans l'adresse) ressemble déjà à un plat de la famille : elle serait écartée après coup.
  const parSource = reponses.map((liens) => melange((liens ?? []).filter((l) => !connus.has(l) && !tropProche(titreDepuisLien(l), titres))));
  const origine = new Map<string, string>(); // lien → recherche qui l'a trouvé
  parSource.forEach((liens, i) => liens.forEach((l) => origine.set(l, i < termes.length ? termes[i] : "")));
  const aEssayer = [...new Set(alterner(parSource))].slice(0, ESSAIS_MAX);

  // Rien que la famille ne peut pas manger (ni, en mode strict, ce que quelqu'un n'aime pas), rien de trop long.
  const convient = (r: ImportedRecipe) =>
    !recipeConflicts([r.title, ...r.ingredients.map((i) => i.name)], members, strict).familleCache &&
    (r.totalMinutes ?? 0) <= maxi;

  let ajoutees = 0;
  const donnees = new Set<string>();
  // 6 pages à la fois, jusqu'à avoir assez de plats, ou jusqu'à la fin du temps imparti.
  for (let i = 0; i < aEssayer.length && ajoutees < combien && Date.now() - debut < BUDGET_MS; i += 6) {
    const lot = await Promise.all(aEssayer.slice(i, i + 6).map(lireRecette));
    for (const [url, recette] of lot) {
      if (ajoutees >= combien || !recette || !estUnBonPlat(recette) || !convient(recette)) continue;
      // Pas un énième « gratin dauphinois facile » quand le gratin dauphinois est déjà là.
      if (tropProche(recette.title, titres)) continue;
      if (await enregistrer(familyId, url, recette)) (ajoutees++, titres.push(recette.title), donnees.add(origine.get(url) ?? ""));
    }
  }
  // Les recherches qui n'ont rien donné ne sont pas refaites tout de suite.
  const termesVides = termes.filter((t) => !donnees.has(t));
  // Une trace dans les journaux : sans elle, un import bloqué passe inaperçu (paquet vide).
  console.info(`Import Marmiton : ${termes.join(" / ")} + voisines de ${graines.length} recettes → ${aEssayer.length} recettes à essayer, ${ajoutees} ajoutées en ${Date.now() - debut} ms${joignable ? "" : " (source injoignable)"}`);
  return { ajoutees, termesVides, joignable };
}

async function lireRecette(url: string): Promise<[string, ImportedRecipe | null]> {
  try {
    const page = await safeFetch(url, { maxBytes: 3 * 1024 * 1024, accept: "text/html" });
    return [url, extractRecipe(page.body.toString("utf8"))];
  } catch {
    return [url, null];
  }
}

async function enregistrer(familyId: string, url: string, r: ImportedRecipe): Promise<boolean> {
  const { data, error } = await db()
    .from("recipes")
    .insert({
      family_id: familyId,
      title: r.title,
      emoji: "🍽️",
      photo_url: r.imageUrl,
      source_url: url,
      servings: r.servingsCount ?? null,
      total_minutes: r.totalMinutes ?? null,
      steps: r.steps?.length ? r.steps : null,
    })
    .select("id")
    .single();
  if (error) return false; // déjà importée entre-temps (index unique)
  await db()
    .from("recipe_ingredients")
    .insert(r.ingredients.slice(0, 60).map((ing, position) => ({ ...ing, position, recipe_id: data.id })));
  return true;
}

/**
 * Les recettes importées que personne n'a jamais swipées laissent la place aux nouvelles, au bout de 4 semaines, ou tout de suite
 * si ce n'est pas un plat pour des jeunes (importées avant le filtre : « chou-fleur gratiné léger », « joue de porc »…).
 * Une recette qui a reçu un avis, même un « Bof », reste : voir recettesAOublier (domain/recherche.ts).
 */
async function oublierLesRecettesBoudees(familyId: string) {
  const { data: importees } = await db()
    .from("recipes")
    .select("id, title, created_at")
    .eq("family_id", familyId)
    .not("source_url", "is", null)
    .order("created_at")
    .limit(500);
  const lignes = importees ?? [];
  if (lignes.length === 0) return;
  const ids = lignes.map((r) => r.id as string);
  const [{ data: avis }, { data: courses }] = await Promise.all([
    db().from("swipes").select("recipe_id").in("recipe_id", ids),
    db().from("trip_recipes").select("recipe_id").in("recipe_id", ids),
  ]);
  const avecAvis = new Set((avis ?? []).map((a) => a.recipe_id as string));
  const dansUneCourse = new Set((courses ?? []).map((c) => c.recipe_id as string));
  const maintenant = Date.now();
  const vieilles = recettesAOublier(
    lignes.map((r) => ({ id: r.id as string, creeLe: Date.parse(r.created_at as string) })),
    avecAvis,
    dansUneCourse,
    maintenant,
    OUBLI_JOURS,
  );
  // Pas pour des jeunes et jamais swipée : on la retire sans attendre (même règle : aucun avis, aucune course).
  const pasPourJeunes = lignes
    .filter((r) => !pourJeunes(r.title as string) && !avecAvis.has(r.id as string) && !dansUneCourse.has(r.id as string))
    .map((r) => r.id as string);
  const aOublier = [...new Set([...vieilles, ...pasPourJeunes])];
  if (aOublier.length) await db().from("recipes").delete().in("id", aOublier);
}

function alterner<T>(listes: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; listes.some((l) => i < l.length); i++) for (const l of listes) if (i < l.length) out.push(l[i]);
  return out;
}

function melange<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
