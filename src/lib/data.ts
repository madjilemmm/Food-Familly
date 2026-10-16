import "server-only";
import { cache } from "react";
import { db } from "@/lib/supabase/server";
import { nAimePas, recipeConflicts, type Conflicts, type MemberTastes, type TasteLevel } from "@/lib/domain/foods";
import { correspondAuxStyles, dureeMax, lireEnvies, styleDe, type Envies } from "@/lib/domain/envies";
import { calculerMatchs, estEnvie, ordonnerPaquet, type Avis, type Signaux } from "@/lib/domain/reco";
import { passagesDesIngredients, sansDouteALaMaison } from "@/lib/domain/maison";
import type { Style } from "@/lib/session";

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

/** Ce qu'on sait d'un membre face à une recette : son swipe, son questionnaire, ses envies. */
export function signauxDe(
  memberId: string,
  recipe: Recipe,
  conflits: Conflicts,
  envies: Envies,
  texts: string[],
  avis: Avis | undefined,
): Signaux {
  return {
    avis,
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
export async function getDeck(familyId: string, profileId: string): Promise<Recipe[]> {
  const [recipes, avis, envies, ctx, profiles] = await Promise.all([
    getRecipes(familyId),
    getFamilySwipes(familyId),
    getFamilyEnvies(familyId),
    getTasteContext(familyId),
    getProfiles(familyId),
  ]);
  const mesEnvies = lireEnvies(profiles.find((p) => p.id === profileId)?.envies);
  const conflicts = new Map(recipes.map((r) => [r.id, conflictsOf(ctx, r, profileId)]));
  const cartes = recipes.map((r) => {
    const c = conflicts.get(r.id)!;
    const texts = ctx.texts.get(r.id) ?? [r.title];
    const monAvis = avis.get(r.id)?.get(profileId);
    return {
      ...r,
      cache: c.verdict === "cache",
      fin: c.verdict === "fin",
      avis: monAvis,
      signaux: signauxDe(profileId, r, c, mesEnvies, texts, monAvis),
      enviesDesAutres: (envies.get(r.id) ?? []).filter((id) => id !== profileId).length,
      vuParLaFamille: (avis.get(r.id)?.size ?? 0) > 0,
      style: styleDe(texts),
    };
  });
  return ordonnerPaquet(cartes, Date.now()).map(({ cache: _c, fin, avis: _a, signaux: _s, enviesDesAutres: _e, vuParLaFamille: _v, style: _st, ...r }) => {
    const c = conflicts.get(r.id)!;
    return fin && c.pasFanDe.length ? { ...r, pastille: nAimePas(c.pasFanDe) } : r;
  });
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
         shopping_list_items(id, name, quantity, unit, aisle, source, for_recipes, checked, created_at)`,
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
