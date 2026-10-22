import "server-only";
import { broadcastRefresh, db } from "@/lib/supabase/server";
import { extractRecipe, type ImportedRecipe } from "@/lib/domain/recipe-import";
import { safeFetch } from "@/lib/safe-fetch";
import { recipeConflicts } from "@/lib/domain/foods";
import { getFamilyTastes, getProfiles } from "@/lib/data";
import { dureeMax, lireEnvies, pourJeunes, recherchesPour } from "@/lib/domain/envies";

/*
 * Recettes importées toutes seules depuis Marmiton, pour que le swipe ne
 * s'arrête jamais : quand une famille n'a presque plus de plats à découvrir,
 * on cherche sur Marmiton des plats que les jeunes aiment (selon les envies de
 * la famille : burgers, pâtes, mexicain…) et on garde les plats principaux
 * populaires, sans régime ni abats. Les pages de recherche (1re page) et de
 * recettes sont autorisées par le robots.txt de Marmiton ; on reste discret.
 */

const PAR_IMPORT = 10;
const RECHERCHES_PAR_IMPORT = 4;
const ESSAIS_MAX = 60;
const OUBLI_JOURS = 28;

/** Familles dont l'import tourne déjà sur ce serveur (les onglets préchargés relancent la page). */
const enCours = new Set<string>();

/** Assez de plats à découvrir ? Sinon on en ajoute (appelé après l'affichage du swipe). */
export async function remplirSiBesoin(familyId: string, nouveautes: number) {
  if (nouveautes >= 8 || enCours.has(familyId)) return;
  enCours.add(familyId);
  try {
    await remplir(familyId);
  } finally {
    enCours.delete(familyId);
  }
}

async function remplir(familyId: string) {
  // Un import vient d'avoir lieu (autre téléphone, onglet ouvert deux fois) : on ne recommence pas.
  const { data: recent } = await db()
    .from("recipes")
    .select("id")
    .eq("family_id", familyId)
    .not("source_url", "is", null)
    .gte("created_at", new Date(Date.now() - 2 * 60 * 1000).toISOString())
    .limit(1);
  if (recent?.length) return;

  await oublierLesRecettesBoudees(familyId);
  const ajoutees = await importer(familyId, PAR_IMPORT).catch((err) => {
    console.warn("Import Marmiton impossible :", err);
    return 0;
  });
  // Les téléphones ouverts sur le swipe reçoivent les nouvelles cartes.
  if (ajoutees > 0) await broadcastRefresh(familyId);
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

/** Les liens de recettes de la 1re page de résultats d'une recherche Marmiton. */
async function chercher(terme: string): Promise<string[]> {
  try {
    const page = await safeFetch(`https://www.marmiton.org/recettes/recherche.aspx?aqt=${encodeURIComponent(terme)}`, {
      maxBytes: 3 * 1024 * 1024,
      accept: "text/html",
    });
    const liens = page.body.toString("utf8").matchAll(/href="(?:https:\/\/www\.marmiton\.org)?(\/recettes\/recette_[^"#?]+\.aspx)"/g);
    return [...new Set([...liens].map((m) => `https://www.marmiton.org${m[1]}`))];
  } catch {
    return [];
  }
}

async function importer(familyId: string, combien: number): Promise<number> {
  const [{ members, strict }, profiles, dejaLa] = await Promise.all([
    getFamilyTastes(familyId),
    getProfiles(familyId),
    db().from("recipes").select("source_url").eq("family_id", familyId).not("source_url", "is", null),
  ]);
  const envies = profiles.map((p) => lireEnvies(p.envies));
  const maxi = dureeMax(envies);
  const connus = new Set((dejaLa.data ?? []).map((r) => r.source_url as string));

  // Quelques recherches, en privilégiant les styles de la famille.
  const termes = melange(recherchesPour(envies).slice(0, 30)).slice(0, RECHERCHES_PAR_IMPORT);
  // Les résultats des recherches en alternance : pas dix gratins de pâtes d'affilée.
  const parTerme = (await Promise.all(termes.map(chercher))).map((liens) => melange(liens.filter((l) => !connus.has(l))));
  const aEssayer = [...new Set(alterner(parTerme))].slice(0, ESSAIS_MAX);

  // Rien que la famille ne peut pas manger (ni, en mode strict, ce que quelqu'un n'aime pas), rien de trop long.
  const convient = (r: ImportedRecipe) =>
    !recipeConflicts([r.title, ...r.ingredients.map((i) => i.name)], members, strict).familleCache &&
    (r.totalMinutes ?? 0) <= maxi;

  let ajoutees = 0;
  // 6 pages à la fois, jusqu'à avoir assez de plats.
  for (let i = 0; i < aEssayer.length && ajoutees < combien; i += 6) {
    const lot = await Promise.all(aEssayer.slice(i, i + 6).map(lireRecette));
    for (const [url, recette] of lot) {
      if (ajoutees >= combien || !recette || !estUnBonPlat(recette) || !convient(recette)) continue;
      if (await enregistrer(familyId, url, recette)) ajoutees++;
    }
  }
  // Une trace dans les journaux : sans elle, un import bloqué passe inaperçu (paquet vide).
  console.info(`Import Marmiton : ${termes.length} recherches, ${aEssayer.length} recettes trouvées, ${ajoutees} ajoutées`);
  return ajoutees;
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
 * Les recettes importées que personne n'a aimées laissent la place aux nouvelles :
 * au bout de 4 semaines, ou tout de suite si ce n'est pas un plat pour des jeunes
 * (importées avant le filtre : « chou-fleur gratiné léger », « joue de porc »…).
 */
async function oublierLesRecettesBoudees(familyId: string) {
  const avant = new Date(Date.now() - OUBLI_JOURS * 24 * 60 * 60 * 1000).toISOString();
  const { data: importees } = await db()
    .from("recipes")
    .select("id, title, created_at, swipes(liked), trip_recipes(recipe_id)")
    .eq("family_id", familyId)
    .not("source_url", "is", null)
    .limit(500);
  const aOublier = (importees ?? [])
    .filter(
      (r) =>
        (r.created_at < avant || !pourJeunes(r.title as string)) &&
        !(r.swipes as { liked: boolean }[]).some((s) => s.liked) &&
        (r.trip_recipes as unknown[]).length === 0,
    )
    .map((r) => r.id as string);
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
