import "server-only";
import { cache } from "react";
import { db } from "@/lib/supabase/server";
import { buildDeck } from "@/lib/domain/swipe-deck";
import type { Style } from "@/lib/session";

/*
 * Les lectures appelées par plusieurs composants d'une même page (mise en page,
 * page, en-tête…) passent par cache() : une seule requête par affichage.
 * isMatch n'en profite pas : il est relu juste après une écriture.
 */

// ─── Types ─────────────────────────────────────────────────────────────

export type Profile = { id: string; family_id: string; name: string; style: Style; emoji: string };

export type Family = { id: string; name: string; join_code: string };

export type IngredientRow = {
  id: string;
  position: number;
  name: string;
  quantity: number | null;
  unit: string;
  aisle: string;
};

export type Recipe = {
  id: string;
  title: string;
  emoji: string;
  photo_url: string | null;
  /** Page Marmiton d'origine pour les recettes importées automatiquement. */
  source_url: string | null;
  created_at: string;
};

export type RecipeWithIngredients = Recipe & { recipe_ingredients: IngredientRow[] };

export type Match = Recipe & { matched_at: string; expires_at: string; like_count: number };

export type TripStatus = "open" | "validated" | "done";

export type Trip = {
  id: string;
  created_by: string | null;
  departs_at: string;
  deadline_at: string;
  status: TripStatus;
  validated_at: string | null;
  created_at: string;
  /** Chargés avec la course, en une seule requête. */
  trip_requests: TripRequest[];
  trip_recipes: { recipe_id: string; selected: boolean }[];
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
  source: "recipe" | "manual" | "request";
  for_recipes: string | null;
  checked: boolean;
  created_at: string;
};

/** Une session non terminée plus vieille que ça est considérée comme oubliée. */
const TRIP_MAX_AGE_MS = 36 * 60 * 60 * 1000;

const RECIPE_FIELDS = "id, title, emoji, photo_url, source_url, created_at";

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

const PROFILE_FIELDS = "id, family_id, name, style, emoji";

// ─── Familles et profils ───────────────────────────────────────────────

export const getFamily = cache(async function getFamily(familyId: string): Promise<Family | null> {
  return check(await db().from("families").select("id, name, join_code").eq("id", familyId).maybeSingle());
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
      .select(`${RECIPE_FIELDS}, recipe_ingredients(id, position, name, quantity, unit, aisle)`)
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

// ─── Swipes & matchs ───────────────────────────────────────────────────

export const getMatches = cache(async function getMatches(familyId: string): Promise<Match[]> {
  // Les recettes viennent de getRecipes (en parallèle, et partagé avec le reste de la page).
  const [rows, recipes] = await Promise.all([
    db()
      .from("active_matches")
      .select("recipe_id, matched_at, expires_at, like_count")
      .eq("family_id", familyId)
      .order("matched_at", { ascending: false })
      .then((r) => check(r) as { recipe_id: string; matched_at: string; expires_at: string; like_count: number }[]),
    getRecipes(familyId),
  ]);
  if (rows.length === 0) return [];
  const byId = new Map(recipes.map((r) => [r.id, r]));
  return rows.flatMap((m) => {
    const recipe = byId.get(m.recipe_id);
    return recipe ? [{ ...recipe, matched_at: m.matched_at, expires_at: m.expires_at, like_count: m.like_count }] : [];
  });
});

export async function getDeck(familyId: string, profileId: string): Promise<Recipe[]> {
  const [recipes, swipes] = await Promise.all([
    getRecipes(familyId),
    db().from("swipes").select("recipe_id, swiped_at").eq("profile_id", profileId).then(check),
  ]);
  return buildDeck(recipes, swipes as { recipe_id: string; swiped_at: string }[]);
}

/** Est-ce que la majorité de la famille a liké cette recette récemment ? */
export async function isMatch(familyId: string, recipeId: string): Promise<boolean> {
  const row = check(
    await db().from("active_matches").select("recipe_id").eq("family_id", familyId).eq("recipe_id", recipeId).maybeSingle(),
  );
  return row != null;
}

// ─── Courses ───────────────────────────────────────────────────────────

/** La session de courses en cours de la famille (ouverte ou validée, pas trop ancienne). */
export const getCurrentTrip = cache(async function getCurrentTrip(familyId: string): Promise<Trip | null> {
  const since = new Date(Date.now() - TRIP_MAX_AGE_MS).toISOString();
  return check(
    await db()
      .from("shopping_trips")
      .select(
        `id, created_by, departs_at, deadline_at, status, validated_at, created_at,
         trip_requests(id, profile_id, free_text, recipe_ids, updated_at),
         trip_recipes(recipe_id, selected),
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
});
