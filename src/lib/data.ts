import "server-only";
import { cache } from "react";
import { db } from "@/lib/supabase/server";
import { nAimePas, recipeConflicts, type Conflicts, type MemberTastes, type TasteLevel } from "@/lib/domain/foods";
import { correspondAuxStyles, dureeMax, lireEnvies, styleDe, type Envies } from "@/lib/domain/envies";
import { calculerMatchs, estEnvie, ordonnerPaquet, type Avis, type Moment, type Signaux } from "@/lib/domain/reco";
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

/** Une session non terminée plus vieille que ça est considérée comme oubliée. */
const TRIP_MAX_AGE_MS = 36 * 60 * 60 * 1000;

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
export async function getDeck(familyId: string, profileId: string, moment: Moment = null): Promise<(Recipe & { dejaVu?: boolean })[]> {
  const [recipes, avis, envies, ctx, profiles, etiquettes, profils, hist] = await Promise.all([
    getRecipes(familyId),
    getFamilySwipes(familyId),
    getFamilyEnvies(familyId),
    getTasteContext(familyId),
    getProfiles(familyId),
    getEtiquettes(familyId),
    getProfilsGouts(familyId),
    getHistorique(familyId),
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
  return ordonnerPaquet(cartes, now, moment).map(
    ({ cache: _c, fin, avis, signaux: _s, enviesDesAutres: _e, vuParLaFamille: _v, style: _st, minutes: _m, matchProbable: _mp, lassitude: _l, ...r }) => {
      const c = conflicts.get(r.id)!;
      const carte = { ...r, ...(avis ? { dejaVu: true } : {}) };
      return fin && c.pasFanDe.length ? { ...carte, pastille: nAimePas(c.pasFanDe) } : carte;
    },
  );
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
): Promise<{ tripId: string; plats: RepasAchete[] } | null> {
  const since = new Date(Date.now() - 10 * JOUR).toISOString();
  const { data: trip } = await db()
    .from("shopping_trips")
    .select("id, trip_recipes(*)")
    .eq("family_id", familyId)
    .eq("status", "done")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!trip) return null;
  const choisis = (trip.trip_recipes as { recipe_id: string; selected: boolean; eaters?: string[] | null }[]).filter((r) => r.selected);
  if (choisis.length === 0) return null;
  const [recipes, profiles, repas] = await Promise.all([
    getRecipes(familyId),
    getProfiles(familyId),
    // Base pas encore migrée : aucun repas noté, la liste reste utile.
    db().from("repas").select("recipe_id, fait_le").eq("trip_id", trip.id).then((r) => r.data ?? []),
  ]);
  const parId = new Map(recipes.map((r) => [r.id, r]));
  const noms = new Map(profiles.map((p) => [p.id, p.name]));
  const notes = new Map(repas.map((r) => [r.recipe_id as string, r]));
  const plats = choisis.flatMap((c) => {
    const r = parId.get(c.recipe_id);
    if (!r) return [];
    const note = notes.get(c.recipe_id);
    return [{ ...r, fait: Boolean(note?.fait_le), mangeurs: (c.eaters ?? []).flatMap((id) => noms.get(id) ?? []) }];
  });
  return { tripId: trip.id as string, plats };
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
