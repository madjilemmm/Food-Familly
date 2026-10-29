import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { CE_SOIR_COOKIE } from "@/lib/domain/ce-soir";
import { db } from "@/lib/supabase/server";
import { nAimePas, recipeConflicts, type Conflicts, type MemberTastes, type TasteLevel } from "@/lib/domain/foods";
import { correspondAuxStyles, dureeMax, lireEnvies, styleDe, type Envies } from "@/lib/domain/envies";
import { avancerLesVoixManquantes, calculerMatchs, estEnvie, ordonnerPaquet, REGLAGES, type Avis, type Moment, type Signaux } from "@/lib/domain/reco";
import { listeDeNoms } from "@/lib/domain/convives";
import { aRedemander } from "@/lib/domain/ce-soir";
import { jourAParis } from "@/lib/domain/heure";
import { classiquesDe, type RepasCuisine } from "@/lib/domain/classiques";
import { courseCouvreLeDiner, mangesDeduits, platsCoches, type CourseFaite } from "@/lib/domain/memoire";
import { bilanAnnee, type Annee } from "@/lib/domain/annee";
import { passagesDesIngredients, sansDouteALaMaison } from "@/lib/domain/maison";
import type { Style } from "@/lib/session";
import { isAisle } from "@/lib/domain/aisles";
import { cleProduit, type Appris } from "@/lib/domain/reconnaissance";
import type { CoursePassee, Reponse } from "@/lib/domain/habitudes";
import { etiquettesDe, prediction, profilDe, type ProfilGouts } from "@/lib/domain/profil-gouts";

/*
 * Les lectures appelées par plusieurs composants d'une même page (mise en page,
 * page, en-tête…) passent par cache() : une seule requête par affichage.
 * enviesPour n'en profite pas : il est relu juste après un swipe.
 */

// ─── Types ─────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  family_id: string;
  name: string;
  style: Style;
  emoji: string;
  /** Questionnaire de goûts vu (même passé avec « Plus tard ») / rempli. */
  tastes_seen_at: string | null;
  tastes_done_at: string | null;
  /** Écran « Tes envies » : styles, temps, piquant (voir domain/envies.ts). */
  envies: unknown;
  envies_done_at: string | null;
};

export type Family = { id: string; name: string; join_code: string; strict_dislikes: boolean };

export type IngredientRow = {
  id: string;
  position: number;
  name: string;
  quantity: number | null;
  unit: string;
  aisle: string;
};

export type Recipe = {
  /** Pastille posée par les goûts de la famille (« Madji n'aime pas »). */
  pastille?: string;
  id: string;
  title: string;
  emoji: string;
  photo_url: string | null;
  /** Page Marmiton d'origine pour les recettes importées automatiquement. */
  source_url: string | null;
  /** Nombre de personnes prévu par la recette, et durée totale (minutes). */
  servings: number | null;
  total_minutes: number | null;
  created_at: string;
};

export type RecipeWithIngredients = Recipe & { recipe_ingredients: IngredientRow[]; steps?: string[] | null };

/** Un match : au moins 2 personnes ont envie de ce plat (likers : leurs profils, avec : leurs prénoms). */
export type Match = Recipe & { matched_at: string; expires_at: string; like_count: number; likers: string[]; avec: string[] };

export type TripStatus = "open" | "validated" | "done";

export type Trip = {
  id: string;
  /** Pour combien de personnes (null = toute la famille). */
  people: number | null;
  created_by: string | null;
  departs_at: string;
  deadline_at: string;
  status: TripStatus;
  validated_at: string | null;
  created_at: string;
  /** Chargés avec la course, en une seule requête. */
  trip_requests: TripRequest[];
  /**
   * people : nombre de personnes (invités compris) ; eaters : qui le mange.
   * null = déduit (demandes, envies). Enregistrés quand la liste est faite ou corrigés à la main.
   */
  trip_recipes: { recipe_id: string; selected: boolean; people?: number | null; eaters?: string[] | null }[];
  shopping_list_items: ListItem[];
};

export type TripRequest = {
  id: string;
  profile_id: string;
  free_text: string | null;
  recipe_ids: string[];
  updated_at: string;
};

export type ListItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  aisle: string;
  /** « maison » : ingrédient de recette qu'on a déjà (retiré de la liste, pas remis à la mise à jour). */
  source: "recipe" | "manual" | "request" | "maison";
  for_recipes: string | null;
  checked: boolean;
  created_at: string;
  /** Proposé par Kaddie : achat habituel, ou pas pris la dernière fois. */
  origine?: "habituel" | "reporte" | null;
};

/** La liste reste ouverte jusqu'aux courses finies ; plus vieille que ça, elle est considérée comme oubliée. */
export const TRIP_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const RECIPE_FIELDS = "id, title, emoji, photo_url, source_url, servings, total_minutes, created_at";

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

const PROFILE_FIELDS = "id, family_id, name, style, emoji, tastes_seen_at, tastes_done_at, envies, envies_done_at";

// ─── Familles et profils ───────────────────────────────────────────────

export const getFamily = cache(async function getFamily(familyId: string): Promise<Family | null> {
  return check(await db().from("families").select("id, name, join_code, strict_dislikes").eq("id", familyId).maybeSingle());
});

/** Combien de plats cette personne a swipés : « Miam » s'explique pendant les premiers choix. */
export const getMesSwipes = cache(async function getMesSwipes(familyId: string, profileId: string): Promise<number> {
  return compterSwipes(await getFamilySwipes(familyId), profileId);
});

/** Le nombre de plats swipés par un membre, dans les avis de la famille. */
const compterSwipes = (avis: Map<string, Map<string, Avis>>, profileId: string) => [...avis.values()].filter((parMembre) => parMembre.has(profileId)).length;

/** Le nombre de personnes à table d'habitude ; null s'il n'a pas été dit (ou base pas encore migrée). */
export const getFoyer = cache(async function getFoyer(familyId: string): Promise<number | null> {
  const { data, error } = await db().from("families").select("foyer").eq("id", familyId).maybeSingle();
  const n = error ? null : (data?.foyer as number | null | undefined);
  return typeof n === "number" && n > 0 ? n : null;
});

export const getProfiles = cache(async function getProfiles(familyId: string): Promise<Profile[]> {
  return check(
    await db().from("profiles").select(PROFILE_FIELDS).eq("family_id", familyId).order("sort_order").order("created_at"),
  );
});

export const getProfile = cache(async function getProfile(familyId: string, id: string): Promise<Profile | null> {
  return check(await db().from("profiles").select(PROFILE_FIELDS).eq("family_id", familyId).eq("id", id).maybeSingle());
});

// ─── Recettes ──────────────────────────────────────────────────────────

export const getRecipes = cache(async function getRecipes(familyId: string): Promise<Recipe[]> {
  return check(await db().from("recipes").select(RECIPE_FIELDS).eq("family_id", familyId).order("title"));
});

export async function getRecipe(familyId: string, id: string): Promise<RecipeWithIngredients | null> {
  return check(
    await db()
      .from("recipes")
      .select(`${RECIPE_FIELDS}, steps, recipe_ingredients(id, position, name, quantity, unit, aisle)`)
      .eq("family_id", familyId)
      .eq("id", id)
      .order("position", { referencedTable: "recipe_ingredients" })
      .maybeSingle(),
  );
}

export async function getRecipesWithIngredients(familyId: string, ids: string[]): Promise<RecipeWithIngredients[]> {
  if (ids.length === 0) return [];
  return check(
    await db()
      .from("recipes")
      .select(`${RECIPE_FIELDS}, recipe_ingredients(id, position, name, quantity, unit, aisle)`)
      .eq("family_id", familyId)
      .in("id", ids)
      .order("title")
      .order("position", { referencedTable: "recipe_ingredients" }),
  );
}

// ─── Goûts de la famille ───────────────────────────────────────────────

export type TasteContext = { strict: boolean; members: MemberTastes[]; texts: Map<string, string[]> };

/** Les goûts de chaque membre et le mode strict. */
export const getFamilyTastes = cache(async function getFamilyTastes(
  familyId: string,
): Promise<{ strict: boolean; members: MemberTastes[] }> {
  const [family, rows] = await Promise.all([
    getFamily(familyId),
    db()
      .from("profiles")
      .select("id, name, profile_tastes(food, level)")
      .eq("family_id", familyId)
      .then((r) => check(r) as { id: string; name: string; profile_tastes: { food: string; level: TasteLevel }[] }[]),
  ]);
  return {
    strict: family?.strict_dislikes ?? true,
    members: rows.map((m) => ({
      id: m.id,
      name: m.name,
      tastes: Object.fromEntries(m.profile_tastes.map((t) => [t.food, t.level])),
    })),
  };
});

/** Titre + noms d'ingrédients de chaque recette : de quoi y repérer les aliments. */
export const getRecipeTexts = cache(async function getRecipeTexts(familyId: string): Promise<Map<string, string[]>> {
  const rows = check(
    await db().from("recipes").select("id, title, recipe_ingredients(name)").eq("family_id", familyId),
  ) as { id: string; title: string; recipe_ingredients: { name: string }[] }[];
  return new Map(rows.map((r) => [r.id, [r.title, ...r.recipe_ingredients.map((i) => i.name)]]));
});

export const getTasteContext = cache(async function getTasteContext(familyId: string): Promise<TasteContext> {
  const [tastes, texts] = await Promise.all([getFamilyTastes(familyId), getRecipeTexts(familyId)]);
  return { ...tastes, texts };
});

export function conflictsOf(ctx: TasteContext, recipe: { id: string; title: string }, meId?: string): Conflicts {
  return recipeConflicts(ctx.texts.get(recipe.id) ?? [recipe.title], ctx.members, ctx.strict, meId);
}

/** Retire ce que la famille ne doit pas voir (interdits, et « j'aime pas » en mode strict). */
export async function forFamily<R extends { id: string; title: string }>(familyId: string, recipes: R[]): Promise<R[]> {
  if (recipes.length === 0) return recipes;
  const ctx = await getTasteContext(familyId);
  return recipes.filter((r) => !conflictsOf(ctx, r).familleCache);
}

// ─── Swipes, goûts, envies, matchs (règles : lib/domain/reco.ts) ───────

const JOUR = 86_400_000;

/** Le dernier swipe de chaque membre sur chaque recette : la base des goûts et des envies. */
export const getFamilySwipes = cache(async function getFamilySwipes(familyId: string): Promise<Map<string, Map<string, Avis>>> {
  const ids = (await getProfiles(familyId)).map((p) => p.id);
  if (ids.length === 0) return new Map();
  // « * » : liked_at peut manquer tant que la migration des envies n'est pas passée.
  const rows = check(await db().from("swipes").select("*").in("profile_id", ids)) as {
    profile_id: string;
    recipe_id: string;
    liked: boolean;
    swiped_at: string;
    liked_at?: string | null;
  }[];
  const parRecette = new Map<string, Map<string, Avis>>();
  for (const r of rows) {
    const avis: Avis = {
      liked: r.liked,
      swipedAt: Date.parse(r.swiped_at),
      likedAt: r.liked_at ? Date.parse(r.liked_at) : r.liked ? Date.parse(r.swiped_at) : null,
    };
    if (!parRecette.has(r.recipe_id)) parRecette.set(r.recipe_id, new Map());
    parRecette.get(r.recipe_id)!.set(r.profile_id, avis);
  }
  return parRecette;
});

/**
 * Ce que la famille a retenu aux dernières courses (90 jours, course en cours exclue) :
 * - achats : dernier achat de chaque plat (course terminée) — éteint les envies ;
 * - retenus : dernière fois que chaque plat a été retenu — évite la répétition ;
 * - ecartes : plats retirés à la dernière course ;
 * - courses : qui a mangé quoi, des plus récentes aux plus anciennes — pour l'équité ;
 * - aLaMaison : ingrédients sans doute toujours à la maison (voir domain/maison.ts).
 */
export type Historique = {
  achats: Map<string, number>;
  retenus: Map<string, number>;
  ecartes: Set<string>;
  courses: { eaters: Set<string> | null }[];
  aLaMaison: Set<string>;
};

export const getHistorique = cache(async function getHistorique(familyId: string): Promise<Historique> {
  const since = new Date(Date.now() - 90 * JOUR).toISOString();
  const [rows, enCours] = await Promise.all([
    db()
      .from("shopping_trips")
      .select("id, status, validated_at, trip_recipes(*), shopping_list_items(name, source, checked)")
      .eq("family_id", familyId)
      .not("validated_at", "is", null)
      .gte("validated_at", since)
      .order("validated_at", { ascending: false })
      .limit(30)
      .then(
        (r) =>
          check(r) as {
            id: string;
            status: TripStatus;
            validated_at: string;
            trip_recipes: { recipe_id: string; selected: boolean; eaters?: string[] | null }[];
            shopping_list_items: { name: string; source: string; checked: boolean }[];
          }[],
      ),
    getCurrentTrip(familyId),
  ]);
  const h: Historique = { achats: new Map(), retenus: new Map(), ecartes: new Set(), courses: [], aLaMaison: new Set() };
  for (const t of rows) {
    if (t.id === enCours?.id) continue;
    const at = Date.parse(t.validated_at);
    const gardes = t.trip_recipes.filter((r) => r.selected);
    for (const r of gardes) {
      h.retenus.set(r.recipe_id, Math.max(at, h.retenus.get(r.recipe_id) ?? 0));
      if (t.status === "done") h.achats.set(r.recipe_id, Math.max(at, h.achats.get(r.recipe_id) ?? 0));
    }
    if (h.courses.length === 0) for (const r of t.trip_recipes) if (!r.selected) h.ecartes.add(r.recipe_id);
    // Qui a mangé : inconnu si un plat n'a pas l'information (courses d'avant le suivi).
    h.courses.push({ eaters: gardes.every((r) => r.eaters) ? new Set(gardes.flatMap((r) => r.eaters!)) : null });
  }
  // Ce qui a été retiré ou acheté aux courses terminées (les plus récentes d'abord).
  h.aLaMaison = sansDouteALaMaison(
    passagesDesIngredients(rows.filter((t) => t.id !== enCours?.id && t.status === "done").map((t) => ({ items: t.shopping_list_items }))),
  );
  return h;
});

/** Les étiquettes de chaque recette (style, aliments, temps) : la base des goûts par caractéristiques. */
export const getEtiquettes = cache(async function getEtiquettes(familyId: string): Promise<Map<string, string[]>> {
  const [recipes, texts] = await Promise.all([getRecipes(familyId), getRecipeTexts(familyId)]);
  return new Map(recipes.map((r) => [r.id, etiquettesDe(texts.get(r.id) ?? [r.title], r.total_minutes)]));
});

/** Le profil de goûts de chaque membre (étiquette → −1 à 1), appris de ses swipes. */
export const getProfilsGouts = cache(async function getProfilsGouts(familyId: string): Promise<Map<string, ProfilGouts>> {
  const [profiles, avis, etiquettes] = await Promise.all([getProfiles(familyId), getFamilySwipes(familyId), getEtiquettes(familyId)]);
  const now = Date.now();
  return new Map(
    profiles.map((p) => [p.id, profilDe([...avis].flatMap(([recipeId, parMembre]) => (parMembre.has(p.id) ? [[recipeId, parMembre.get(p.id)!] as [string, Avis]] : [])), etiquettes, now)]),
  );
});

/** Ce qu'on sait d'un membre face à une recette : son swipe, son questionnaire, ses envies. */
export function signauxDe(
  memberId: string,
  recipe: Recipe,
  conflits: Conflicts,
  envies: Envies,
  texts: string[],
  avis: Avis | undefined,
  /** Note prédite par ses goûts sur les caractéristiques (seulement pour un plat qu'il n'a pas swipé). */
  predite: number | null = null,
): Signaux {
  return {
    avis,
    prediction: avis ? null : predite,
    adore: conflits.adoreIds.includes(memberId),
    pasFan: conflits.pasFanIds.includes(memberId),
    style: envies.styles.length > 0 && correspondAuxStyles(texts, envies.styles),
    tropLong: Boolean(recipe.total_minutes && recipe.total_minutes > dureeMax([envies])),
  };
}

/** Les matchs : au moins 2 personnes ont envie du même plat (voir calculerMatchs). */
export const getMatches = cache(async function getMatches(familyId: string): Promise<Match[]> {
  const [avis, hist, recipes, profiles, ctx] = await Promise.all([
    getFamilySwipes(familyId),
    getHistorique(familyId),
    getRecipes(familyId),
    getProfiles(familyId),
    getTasteContext(familyId),
  ]);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const noms = new Map(profiles.map((p) => [p.id, p.name]));
  const matchs = calculerMatchs(
    avis,
    (id) => hist.achats.get(id) ?? null,
    Date.now(),
    (id) => {
      const r = byId.get(id);
      return !r || conflictsOf(ctx, r).familleCache;
    },
  );
  return matchs.map((m) => ({
    ...byId.get(m.recipeId)!,
    matched_at: new Date(m.matchedAt).toISOString(),
    expires_at: new Date(m.expiresAt).toISOString(),
    like_count: m.likers.length,
    likers: m.likers,
    avec: m.likers.flatMap((id) => noms.get(id) ?? []),
  }));
});

/** Qui a envie de chaque plat en ce moment (les premiers à l'avoir dit d'abord). */
export const getFamilyEnvies = cache(async function getFamilyEnvies(familyId: string): Promise<Map<string, string[]>> {
  const [avis, hist] = await Promise.all([getFamilySwipes(familyId), getHistorique(familyId)]);
  const now = Date.now();
  const envies = new Map<string, string[]>();
  for (const [recipeId, parMembre] of avis) {
    const achat = hist.achats.get(recipeId) ?? null;
    const qui = [...parMembre]
      .filter(([, a]) => estEnvie(a, achat, now))
      .sort(([, a], [, b]) => a.swipedAt - b.swipedAt)
      .map(([id]) => id);
    if (qui.length) envies.set(recipeId, qui);
  }
  return envies;
});

/** Mes envies du moment, les plus récentes d'abord. */
export const getMyLikes = cache(async function getMyLikes(familyId: string, profileId: string): Promise<Recipe[]> {
  const [avis, envies, recipes] = await Promise.all([getFamilySwipes(familyId), getFamilyEnvies(familyId), getRecipes(familyId)]);
  const date = (id: string) => avis.get(id)?.get(profileId)?.swipedAt ?? 0;
  return recipes.filter((r) => envies.get(r.id)?.includes(profileId)).sort((a, b) => date(b.id) - date(a.id));
});

/** Mes plats aimés (goût durable) qui ne sont pas une envie en ce moment, les plus récents d'abord. */
export const getPlatsAimes = cache(async function getPlatsAimes(familyId: string, profileId: string): Promise<Recipe[]> {
  const [avis, envies, recipes] = await Promise.all([getFamilySwipes(familyId), getFamilyEnvies(familyId), getRecipes(familyId)]);
  const aime = (id: string) => avis.get(id)?.get(profileId)?.likedAt ?? null;
  return recipes
    .filter((r) => aime(r.id) != null && !envies.get(r.id)?.includes(profileId))
    .sort((a, b) => aime(b.id)! - aime(a.id)!);
});

/** Juste après un swipe (sans cache) : qui a envie de ce plat, s'il y a match ; null sinon. */
export async function enviesPour(familyId: string, recipeId: string): Promise<string[] | null> {
  const ids = (await getProfiles(familyId)).map((p) => p.id);
  const [rows, hist] = await Promise.all([
    db().from("swipes").select("*").eq("recipe_id", recipeId).in("profile_id", ids).then(check),
    getHistorique(familyId),
  ]);
  const avis = new Map(
    (rows as { profile_id: string; liked: boolean; swiped_at: string; liked_at?: string | null }[]).map((r) => [
      r.profile_id,
      { liked: r.liked, swipedAt: Date.parse(r.swiped_at), likedAt: r.liked_at ? Date.parse(r.liked_at) : null },
    ]),
  );
  const [m] = calculerMatchs(new Map([[recipeId, avis]]), () => hist.achats.get(recipeId) ?? null, Date.now());
  return m?.likers ?? null;
}

/**
 * Mon paquet (règles : ordonnerPaquet) : interdits et « j'aime pas » retirés ;
 * mes goûts, ce dont les autres ont envie et la découverte devant ; mes favoris
 * qui reviennent de temps en temps ; ce qu'un autre n'aime pas, à la fin.
 */
/** Les plats cuisinés ces deux derniers jours (« C'est fait »), et pour qui (null : tout le monde). */
async function getCuisinesRecemment(familyId: string): Promise<{ recipeId: string; faitLe: number; mangeurs: string[] | null }[]> {
  const { data: trips } = await db()
    .from("shopping_trips")
    .select("id, trip_recipes(recipe_id, eaters)")
    .eq("family_id", familyId)
    .eq("status", "done")
    .gte("finished_at", new Date(Date.now() - 14 * JOUR).toISOString());
  const explicites: { recipeId: string; faitLe: number; mangeurs: string[] | null }[] = [];
  if (trips?.length) {
    // Base pas encore migrée : pas de repas notés.
    const { data: repas } = await db()
      .from("repas")
      .select("trip_id, recipe_id, fait_le")
      .in("trip_id", trips.map((t) => t.id))
      .gte("fait_le", new Date(Date.now() - 2 * JOUR).toISOString());
    const mangeurs = new Map(
      trips.flatMap((t) => (t.trip_recipes as { recipe_id: string; eaters?: string[] | null }[]).map((r) => [`${t.id}:${r.recipe_id}`, r.eaters?.length ? r.eaters : null])),
    );
    for (const r of repas ?? []) explicites.push({ recipeId: r.recipe_id as string, faitLe: Date.parse(r.fait_le as string), mangeurs: mangeurs.get(`${r.trip_id}:${r.recipe_id}`) ?? null });
  }
  // Un dîner décidé dont les courses sont faites est mangé, sans « C'est fait » : la carte « C'était bon ? » vient toute seule (pour tout le monde).
  const deduits = (await getRepasManges(familyId))
    .filter((r) => r.deduit && r.faitLe >= Date.now() - 2 * JOUR)
    .map((r) => ({ recipeId: r.recipeId, faitLe: r.faitLe, mangeurs: null }));
  return [...explicites, ...deduits];
}

export async function getDeck(
  familyId: string,
  profileId: string,
  moment: Moment = null,
): Promise<(Recipe & { dejaVu?: boolean; hier?: boolean; voix?: string; voixNb?: number })[]> {
  const [recipes, avis, envies, ctx, profiles, etiquettes, profils, hist, cuisines] = await Promise.all([
    getRecipes(familyId),
    getFamilySwipes(familyId),
    getFamilyEnvies(familyId),
    getTasteContext(familyId),
    getProfiles(familyId),
    getEtiquettes(familyId),
    getProfilsGouts(familyId),
    getHistorique(familyId),
    getCuisinesRecemment(familyId),
  ]);
  const now = Date.now();
  const mesEnvies = lireEnvies(profiles.find((p) => p.id === profileId)?.envies);
  const conflicts = new Map(recipes.map((r) => [r.id, conflictsOf(ctx, r, profileId)]));
  const monProfil = profils.get(profileId) ?? new Map();
  const autres = profiles.filter((p) => p.id !== profileId).map((p) => p.id);
  // Lassitude : les styles des plats retenus ces 7 derniers jours.
  const stylesRecents = new Map<string, number>();
  for (const [recipeId, quand] of hist.retenus) {
    if (now - quand > 7 * JOUR) continue;
    const st = styleDe(ctx.texts.get(recipeId) ?? []);
    if (st) stylesRecents.set(st, (stylesRecents.get(st) ?? 0) + 1);
  }
  const cartes = recipes.map((r) => {
    const c = conflicts.get(r.id)!;
    const texts = ctx.texts.get(r.id) ?? [r.title];
    const tags = etiquettes.get(r.id) ?? [];
    const monAvis = avis.get(r.id)?.get(profileId);
    const style = styleDe(texts);
    // Viser les matchs : la meilleure note prédite chez les autres qui ne l'ont pas encore swipé.
    const matchProbable = Math.max(
      0,
      ...autres.filter((id) => !avis.get(r.id)?.has(id)).map((id) => prediction(profils.get(id) ?? new Map(), tags) ?? 0),
    );
    return {
      ...r,
      cache: c.verdict === "cache",
      fin: c.verdict === "fin",
      avis: monAvis,
      signaux: signauxDe(profileId, r, c, mesEnvies, texts, monAvis, prediction(monProfil, tags)),
      enviesDesAutres: (envies.get(r.id) ?? []).filter((id) => id !== profileId).length,
      vuParLaFamille: (avis.get(r.id)?.size ?? 0) > 0,
      style,
      minutes: r.total_minutes,
      matchProbable,
      lassitude: style ? (stylesRecents.get(style) ?? 0) : 0,
    };
  });
  const ordonne = ordonnerPaquet(cartes, now, moment).map(
    ({ cache: _c, fin, avis, signaux: _s, enviesDesAutres: _e, vuParLaFamille: _v, style: _st, minutes: _m, matchProbable: _mp, lassitude: _l, ...r }) => {
      const c = conflicts.get(r.id)!;
      const carte = { ...r, ...(avis ? { dejaVu: true } : {}) };
      return fin && c.pasFanDe.length ? { ...carte, pastille: nAimePas(c.pasFanDe) } : carte;
    },
  );
  // « Ta voix fait le match » : ce dont une seule autre personne a envie passe devant
  // (jamais un plat qu'un autre membre n'aime pas).
  const noms = new Map(profiles.map((p) => [p.id, p.name]));
  // Un nouveau membre voit d'abord ce dont la famille a déjà envie : son premier « Miam » fait un match.
  const mesSwipes = compterSwipes(avis, profileId);
  const nouveau = autres.length > 0 && mesSwipes < REGLAGES.NOUVEAU_SWIPES;
  const { paquet: avance, voix } = avancerLesVoixManquantes(ordonne, envies, profileId, (id) => conflicts.get(id)?.verdict === "fin", { nouveau });
  const paquet = avance.map((r) => {
    const qui = voix.get(r.id);
    return qui ? { ...r, voix: listeDeNoms(qui.map((id) => noms.get(id) ?? "Quelqu'un")), voixNb: qui.length } : r;
  });
  // Le plat d'hier passe devant, même s'il ne serait pas revenu de sitôt.
  const idHier = aRedemander(cuisines, profileId, (id) => avis.get(id)?.get(profileId));
  const hier = idHier && conflicts.get(idHier)?.verdict !== "cache" ? recipes.find((r) => r.id === idHier) : undefined;
  return hier ? [{ ...hier, hier: true, dejaVu: true }, ...paquet.filter((r) => r.id !== hier.id)] : paquet;
}

// ─── Courses ───────────────────────────────────────────────────────────

/** La session de courses en cours de la famille (ouverte ou validée, pas trop ancienne). */
export const getCurrentTrip = cache(loadCurrentTrip);

/** Sans cache : relu juste après une écriture. */
export async function loadCurrentTrip(familyId: string): Promise<Trip | null> {
  const since = new Date(Date.now() - TRIP_MAX_AGE_MS).toISOString();
  return check(
    await db()
      .from("shopping_trips")
      .select(
        `id, created_by, departs_at, deadline_at, status, validated_at, created_at, people,
         trip_requests(id, profile_id, free_text, recipe_ids, updated_at),
         trip_recipes(*),
         shopping_list_items(*)`,
      )
      .eq("family_id", familyId)
      .neq("status", "done")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .order("updated_at", { referencedTable: "trip_requests" })
      .order("created_at", { referencedTable: "shopping_list_items" })
      .order("name", { referencedTable: "shopping_list_items" })
      .limit(1)
      .maybeSingle(),
  );
}

// ─── Ce que la famille a appris à Kaddie sur ses articles ──────────────

export const getAppris = cache(async function getAppris(familyId: string): Promise<Appris> {
  const { data, error } = await db().from("produits_appris").select("saisie, nom, rayon, produit, tel_quel").eq("family_id", familyId);
  // Base pas encore migrée : le catalogue seul.
  if (error || !data) return {};
  return Object.fromEntries(
    data.map((r) => [
      r.saisie as string,
      r.tel_quel || !r.nom || !isAisle(r.rayon)
        ? ("tel-quel" as const)
        : { nom: r.nom as string, rayon: r.rayon, ...(r.produit ? { produit: r.produit as string } : {}) },
    ]),
  );
});

// ─── Courses passées : achats habituels et articles pas pris ────────────

/**
 * Les courses closes des 12 derniers mois (les plus récentes d'abord) avec leurs articles,
 * et les réponses aux propositions (« pas besoin », sans réponse). La clé de chaque article
 * est celle enregistrée, sinon relue avec le catalogue (anciens articles).
 */
export const getCoursesPassees = cache(async function getCoursesPassees(
  familyId: string,
): Promise<{ courses: CoursePassee[]; reponses: Reponse[]; repondusIci: Set<string>; enCours: string | null }> {
  const since = new Date(Date.now() - 365 * JOUR).toISOString();
  const [rows, enCours, appris] = await Promise.all([
    // « * » : finished_at, cle et origine peuvent manquer tant que la migration n'est pas passée.
    db()
      .from("shopping_trips")
      .select("*, shopping_list_items(*)")
      .eq("family_id", familyId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(120)
      .then((r) => check(r) as Record<string, unknown>[]),
    getCurrentTrip(familyId),
    getAppris(familyId),
  ]);
  const ids = rows.map((t) => t.id as string);
  const { data: lues } = ids.length
    ? await db().from("suggestions_reponses").select("trip_id, cle, reponse, created_at").in("trip_id", ids)
    : { data: [] };
  const reponses = (lues ?? []).map((r) => ({ trip: r.trip_id as string, cle: r.cle as string, reponse: r.reponse as Reponse["reponse"], le: Date.parse(r.created_at as string) }));
  const courses: CoursePassee[] = rows
    .filter((t) => t.id !== enCours?.id)
    .map((t) => {
      const items = (t.shopping_list_items as Record<string, unknown>[]).map((i) => ({
        name: i.name as string,
        cle: (i.source !== "recipe" && (i.cle as string | null)) || cleProduit(i.name as string, appris),
        source: i.source as string,
        checked: Boolean(i.checked),
        quantity: (i.quantity as number | null) ?? null,
        unit: (i.unit as string) ?? "",
        aisle: (i.aisle as string) ?? "autre",
      }));
      const fin = (t.finished_at ?? t.validated_at ?? t.created_at) as string;
      return { id: t.id as string, le: Date.parse(fin), finie: Boolean(t.finished_at), close: t.status === "done", items };
    });
  return {
    courses,
    reponses: reponses.filter((r) => r.trip !== enCours?.id),
    repondusIci: new Set(reponses.filter((r) => r.trip === enCours?.id).map((r) => r.cle)),
    enCours: enCours?.id ?? null,
  };
});

// ─── Après les courses : les repas achetés ─────────────────────────────

export type RepasAchete = Recipe & {
  /** Déjà cuisiné (« C'est fait »). */
  fait: boolean;
  /** Qui le mange (prénoms). */
  mangeurs: string[];
};

/**
 * Les plats achetés à la dernière course terminée (moins de 10 jours) : de quoi répondre
 * à « ce soir, on mange quoi ? » sans réfléchir. Vide s'il n'y a rien de récent.
 */
export const getRepasAchetes = cache(async function getRepasAchetes(
  familyId: string,
): Promise<{ tripId: string; le: number; plats: RepasAchete[] } | null> {
  const since = new Date(Date.now() - 10 * JOUR).toISOString();
  const { data: trip } = await db()
    .from("shopping_trips")
    .select("*, trip_recipes(*)")
    .eq("family_id", familyId)
    .eq("status", "done")
    .gte("finished_at", since)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!trip) return null;
  const choisis = (trip.trip_recipes as { recipe_id: string; selected: boolean; eaters?: string[] | null }[]).filter((r) => r.selected);
  if (choisis.length === 0) return null;
  const [recipes, profiles, repas, manges] = await Promise.all([
    getRecipes(familyId),
    getProfiles(familyId),
    // Base pas encore migrée : aucun repas noté, la liste reste utile.
    db().from("repas").select("recipe_id, fait_le").eq("trip_id", trip.id).then((r) => r.data ?? []),
    getRepasManges(familyId),
  ]);
  const parId = new Map(recipes.map((r) => [r.id, r]));
  const noms = new Map(profiles.map((p) => [p.id, p.name]));
  const notes = new Map(repas.map((r) => [r.recipe_id as string, r]));
  const le = Date.parse((trip.finished_at ?? trip.validated_at ?? trip.created_at) as string);
  // Un dîner passé, décidé pour ces courses, est déjà mangé : le plat n'est plus « à cuisiner ».
  const mangeDepuis = (id: string) => manges.some((m) => m.deduit && !m.provisoire && m.recipeId === id && courseCouvreLeDiner(jourAParis(new Date(m.faitLe)), le));
  const plats = choisis.flatMap((c) => {
    const r = parId.get(c.recipe_id);
    if (!r) return [];
    const note = notes.get(c.recipe_id);
    return [{ ...r, fait: Boolean(note?.fait_le) || mangeDepuis(c.recipe_id), mangeurs: (c.eaters ?? []).flatMap((id) => noms.get(id) ?? []) }];
  });
  return { tripId: trip.id as string, le, plats };
});

// ─── Les dernières courses : le bilan et les mercis ────────────────────

export type DerniereCourse = {
  id: string;
  shopper: { id: string; name: string } | null;
  /** Articles mis dans le caddie. */
  pris: number;
  /** Pour qui (les mangeurs des plats et ceux dont la demande a été prise), sans la personne qui a fait les courses. */
  pourQui: string[];
  /** Qui a dit merci (prénoms et profils). */
  mercis: { id: string; name: string }[];
};

/** La dernière course terminée il y a moins de 2 jours, pour son bilan et les mercis. */
export const getDerniereCourse = cache(async function getDerniereCourse(familyId: string): Promise<DerniereCourse | null> {
  const since = new Date(Date.now() - 2 * JOUR).toISOString();
  const { data: t } = await db()
    .from("shopping_trips")
    .select("*, trip_recipes(*), trip_requests(profile_id, free_text), shopping_list_items(checked, source)")
    .eq("family_id", familyId)
    .eq("status", "done")
    .gte("finished_at", since)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!t) return null;
  const [profiles, mercis] = await Promise.all([
    getProfiles(familyId),
    db().from("mercis").select("profile_id").eq("trip_id", t.id).then((r) => r.data ?? []),
  ]);
  const noms = new Map(profiles.map((p) => [p.id, p.name]));
  const items = t.shopping_list_items as { checked: boolean; source: string }[];
  const qui = new Set<string>([
    ...(t.trip_recipes as { selected: boolean; eaters?: string[] | null }[]).filter((r) => r.selected).flatMap((r) => r.eaters ?? []),
    ...(t.trip_requests as { profile_id: string }[]).map((r) => r.profile_id),
  ]);
  qui.delete(t.created_by as string);
  return {
    id: t.id as string,
    shopper: t.created_by && noms.has(t.created_by) ? { id: t.created_by as string, name: noms.get(t.created_by)! } : null,
    pris: items.filter((i) => i.checked && i.source !== "maison").length,
    pourQui: [...qui].flatMap((id) => noms.get(id) ?? []),
    mercis: mercis.flatMap((m) => (noms.has(m.profile_id) ? [{ id: m.profile_id as string, name: noms.get(m.profile_id)! }] : [])),
  };
});

/** Les plats choisis ensemble cette semaine (listes faites ces 7 derniers jours), pour le récap à partager. */
export async function getRecapSemaine(familyId: string): Promise<{ famille: string; plats: string[] } | null> {
  const since = new Date(Date.now() - 7 * JOUR).toISOString();
  const [famille, recipes, { data }] = await Promise.all([
    getFamily(familyId),
    getRecipes(familyId),
    db()
      .from("shopping_trips")
      .select("trip_recipes(recipe_id, selected)")
      .eq("family_id", familyId)
      .gte("validated_at", since)
      .order("validated_at", { ascending: false }),
  ]);
  const titres = new Map(recipes.map((r) => [r.id, r.title]));
  const plats = [
    ...new Set(
      (data ?? []).flatMap((t) => (t.trip_recipes as { recipe_id: string; selected: boolean }[]).filter((r) => r.selected).flatMap((r) => titres.get(r.recipe_id) ?? [])),
    ),
  ];
  return famille && plats.length ? { famille: famille.name, plats: plats.slice(0, 6) } : null;
}

// ─── Notre année à table ───────────────────────────────────────────────

/** Le 1er janvier de l'année en cours, à Paris. */
export function debutDeLAnnee(now = new Date()): number {
  const an = Number(new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone: "Europe/Paris" }).format(now));
  return Date.parse(`${an}-01-01T00:00:00+01:00`);
}

/** Le bilan de l'année (règles : domain/annee.ts), avec les noms. */
export async function getAnnee(familyId: string): Promise<
  | (Annee & { an: number; famille: string; cuisines: number; mercis: number; noms: Map<string, string>; titres: Map<string, string> })
  | null
> {
  const debut = debutDeLAnnee();
  const [famille, recipes, profiles, avis, { data: trips }] = await Promise.all([
    getFamily(familyId),
    getRecipes(familyId),
    getProfiles(familyId),
    getFamilySwipes(familyId),
    db()
      .from("shopping_trips")
      .select("id, created_by, trip_recipes(recipe_id, selected)")
      .eq("family_id", familyId)
      .not("validated_at", "is", null)
      .gte("created_at", new Date(debut).toISOString()),
  ]);
  if (!famille) return null;
  const ids = (trips ?? []).map((t) => t.id as string);
  // Base pas encore migrée : ni repas ni mercis, le reste du bilan tient.
  const [cuisines, mercis] = ids.length
    ? await Promise.all([
        db().from("repas").select("recipe_id", { count: "exact", head: true }).in("trip_id", ids).not("fait_le", "is", null).then((r) => r.count ?? 0),
        db().from("mercis").select("profile_id", { count: "exact", head: true }).in("trip_id", ids).then((r) => r.count ?? 0),
      ])
    : [0, 0];
  const bilan = bilanAnnee(
    (trips ?? []).map((t) => ({
      shopper: (t.created_by as string | null) ?? null,
      plats: (t.trip_recipes as { recipe_id: string; selected: boolean }[]).filter((r) => r.selected).map((r) => r.recipe_id),
    })),
    avis,
    debut,
  );
  return {
    ...bilan,
    an: new Date(debut + 7 * JOUR).getFullYear(),
    famille: famille.name,
    cuisines,
    mercis,
    noms: new Map(profiles.map((p) => [p.id, p.name])),
    titres: new Map(recipes.map((r) => [r.id, r.title])),
  };
}

// ─── Les classiques du foyer ───────────────────────────────────────────

/** Un dîner mangé : `deduit` quand personne n'a dit « C'est fait » (voir getRepasManges), `provisoire` quand ce n'est pas encore sûr. */
export type RepasMange = RepasCuisine & { deduit?: boolean; provisoire?: boolean };

/**
 * Les dîners mangés par la famille, les plus récents d'abord : ceux marqués « C'est fait », et ceux décidés (« Ce sera ça ») dont les
 * courses sont faites, sans que personne ait à le dire (règles : domain/memoire.ts). `provisoire` : la liste est cochée mais « J'ai
 * fini les courses » n'a pas été touché ; compté pour « C'était bon ? », pas pour les classiques. Base pas encore migrée : rien de déduit.
 */
export const getRepasManges = cache(async function getRepasManges(familyId: string): Promise<RepasMange[]> {
  const { data: trips } = await db()
    .from("shopping_trips")
    .select("id, finished_at, trip_recipes(recipe_id, selected)")
    .eq("family_id", familyId)
    .eq("status", "done");
  const finies = trips ?? [];
  // Base pas encore migrée : aucun repas noté.
  const { data: repas } = finies.length
    ? await db().from("repas").select("recipe_id, fait_le").in("trip_id", finies.map((t) => t.id)).not("fait_le", "is", null)
    : { data: [] };
  const explicites: RepasMange[] = (repas ?? []).map((r) => ({ recipeId: r.recipe_id as string, faitLe: Date.parse(r.fait_le as string) }));

  // Les dîners décidés (un par jour), et les courses qui les couvrent. Base pas encore migrée : aucune décision gardée.
  const { data: choix } = await db()
    .from("ce_soir_choix")
    .select("jour, recipe_id")
    .eq("family_id", familyId)
    .gte("jour", jourAParis(new Date(Date.now() - 400 * JOUR)));
  const decisions = (choix ?? []).map((c) => ({ recipeId: c.recipe_id as string, jour: c.jour as string }));
  if (decisions.length === 0) return explicites.sort((a, b) => b.faitLe - a.faitLe);
  const aujourdhui = jourAParis();
  const courses: CourseFaite[] = finies.flatMap((t) =>
    t.finished_at
      ? [{ le: Date.parse(t.finished_at as string), recettes: (t.trip_recipes as { recipe_id: string; selected: boolean }[]).filter((r) => r.selected).map((r) => r.recipe_id) }]
      : [],
  );
  const stables = mangesDeduits(decisions, courses, explicites, aujourdhui).map((r) => ({ ...r, deduit: true }));

  // La liste en cours toute cochée : les courses sont faites même si « J'ai fini » n'a pas été touché.
  const [trip, recipes] = await Promise.all([getCurrentTrip(familyId), getRecipes(familyId)]);
  const titres = new Map(recipes.map((r) => [r.id, r.title]));
  const menu = (trip?.trip_recipes ?? []).filter((r) => r.selected).flatMap((r) => (titres.has(r.recipe_id) ? [{ id: r.recipe_id, titre: titres.get(r.recipe_id)! }] : []));
  const cochees = platsCoches(menu, trip?.shopping_list_items ?? []);
  const provisoires = cochees.length
    ? mangesDeduits(decisions, [{ le: Date.now(), recettes: cochees }], [...explicites, ...stables], aujourdhui).map((r) => ({ ...r, deduit: true, provisoire: true }))
    : [];
  return [...explicites, ...stables, ...provisoires].sort((a, b) => b.faitLe - a.faitLe);
});

/** Les plats cuisinés au moins 3 fois par la famille (« C'est fait », ou décidés et dont les courses sont faites), avec le nombre de fois. */
export const getClassiques = cache(async function getClassiques(familyId: string): Promise<{ recipeId: string; fois: number }[]> {
  return classiquesDe((await getRepasManges(familyId)).filter((r) => !r.provisoire));
});

// ─── « Autre idée » ───────────────────────────────────────────────────

/** Les plats écartés de « Ce soir » par la famille, pas encore revenus, avec la fin de leur écart (base pas migrée : aucun). */
export const getPasCeSoir = cache(async function getPasCeSoir(familyId: string): Promise<Map<string, number>> {
  const { data } = await db().from("pas_ce_soir").select("recipe_id, jusqu_a").eq("family_id", familyId).gt("jusqu_a", new Date().toISOString());
  // recette → fin de l'écart : plus elle est lointaine, plus l'écart est récent.
  return new Map((data ?? []).map((r) => [r.recipe_id as string, Date.parse(r.jusqu_a as string)]));
});

/** Le plat que la famille a retenu pour ce soir (« Ce sera ça »), s'il y en a un aujourd'hui. Base pas migrée : aucun. */
export const getCeSoirChoisi = cache(async function getCeSoirChoisi(familyId: string): Promise<{ recipeId: string; choisiPar: string | null } | null> {
  const { data, error } = await db().from("ce_soir_choix").select("recipe_id, choisi_par").eq("family_id", familyId).eq("jour", jourAParis()).maybeSingle();
  if (error) {
    // Base pas encore migrée : le choix reste sur le téléphone de celui qui l'a fait (cookie du jour), faute de table.
    const [jour, id, par] = ((await cookies()).get(CE_SOIR_COOKIE)?.value ?? "").split(":");
    return jour === jourAParis() && id ? { recipeId: id, choisiPar: par || null } : null;
  }
  return data ? { recipeId: data.recipe_id as string, choisiPar: (data.choisi_par as string | null) ?? null } : null;
});

// ─── « À table ! » ─────────────────────────────────────────────────────

export type ATable = {
  id: string;
  cuisinier: { id: string; name: string } | null;
  titre: string | null;
  /** L'heure du repas (ms). */
  a: number;
  reponses: { id: string; name: string; reponse: "arrive" | "retard" }[];
};

/** Un appel reste affiché 20 minutes après l'heure du repas. */
export const A_TABLE_DUREE_MS = 20 * 60_000;

/** L'appel « À table ! » en cours dans la famille, s'il y en a un. */
export const getATable = cache(async function getATable(familyId: string): Promise<ATable | null> {
  const { data } = await db()
    .from("a_table")
    .select("*, a_table_reponses(*)")
    .eq("family_id", familyId)
    .gte("a", new Date(Date.now() - A_TABLE_DUREE_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Base pas encore migrée : pas d'appel, rien ne casse.
  if (!data) return null;
  const noms = new Map((await getProfiles(familyId)).map((p) => [p.id, p.name]));
  const reponses = (data.a_table_reponses as { profile_id: string; reponse: "arrive" | "retard" }[]).flatMap((r) =>
    noms.has(r.profile_id) ? [{ id: r.profile_id, name: noms.get(r.profile_id)!, reponse: r.reponse }] : [],
  );
  const cuisinier = data.cuisinier && noms.has(data.cuisinier) ? { id: data.cuisinier as string, name: noms.get(data.cuisinier)! } : null;
  return { id: data.id as string, cuisinier, titre: (data.titre as string | null) ?? null, a: Date.parse(data.a as string), reponses };
});
