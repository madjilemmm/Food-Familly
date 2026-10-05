import "server-only";
import { db } from "@/lib/supabase/server";
import { buildDeck } from "@/lib/domain/swipe-deck";
import type { Role } from "@/lib/session";

// ─── Types ─────────────────────────────────────────────────────────────

export type Profile = { id: string; name: string; role: Role; emoji: string };

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
  created_at: string;
};

export type RecipeWithIngredients = Recipe & { recipe_ingredients: IngredientRow[] };

export type Match = Recipe & { matched_at: string; expires_at: string };

export type TripStatus = "open" | "validated" | "done";

export type Trip = {
  id: string;
  departs_at: string;
  deadline_at: string;
  status: TripStatus;
  validated_at: string | null;
  created_at: string;
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

const RECIPE_FIELDS = "id, title, emoji, photo_url, created_at";

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// ─── Profils ───────────────────────────────────────────────────────────

export async function getProfiles(): Promise<Profile[]> {
  return check(await db().from("profiles").select("id, name, role, emoji").order("sort_order"));
}

export async function getProfile(id: string): Promise<Profile | null> {
  return check(await db().from("profiles").select("id, name, role, emoji").eq("id", id).maybeSingle());
}

// ─── Recettes ──────────────────────────────────────────────────────────

export async function getRecipes(): Promise<Recipe[]> {
  return check(await db().from("recipes").select(RECIPE_FIELDS).order("title"));
}

export async function getRecipe(id: string): Promise<RecipeWithIngredients | null> {
  return check(
    await db()
      .from("recipes")
      .select(`${RECIPE_FIELDS}, recipe_ingredients(id, position, name, quantity, unit, aisle)`)
      .eq("id", id)
      .order("position", { referencedTable: "recipe_ingredients" })
      .maybeSingle(),
  );
}

export async function getRecipesWithIngredients(ids: string[]): Promise<RecipeWithIngredients[]> {
  if (ids.length === 0) return [];
  return check(
    await db()
      .from("recipes")
      .select(`${RECIPE_FIELDS}, recipe_ingredients(id, position, name, quantity, unit, aisle)`)
      .in("id", ids)
      .order("title")
      .order("position", { referencedTable: "recipe_ingredients" }),
  );
}

// ─── Swipes & matchs ───────────────────────────────────────────────────

export async function getMatches(): Promise<Match[]> {
  const rows = check(
    await db().from("active_matches").select("recipe_id, matched_at, expires_at").order("matched_at", { ascending: false }),
  ) as { recipe_id: string; matched_at: string; expires_at: string }[];
  if (rows.length === 0) return [];
  const recipes = check(await db().from("recipes").select(RECIPE_FIELDS).in("id", rows.map((r) => r.recipe_id))) as Recipe[];
  const byId = new Map(recipes.map((r) => [r.id, r]));
  return rows.flatMap((m) => {
    const recipe = byId.get(m.recipe_id);
    return recipe ? [{ ...recipe, matched_at: m.matched_at, expires_at: m.expires_at }] : [];
  });
}

export async function getDeck(profileId: string): Promise<Recipe[]> {
  const [recipes, swipes] = await Promise.all([
    getRecipes(),
    db().from("swipes").select("recipe_id, swiped_at").eq("profile_id", profileId).then(check),
  ]);
  return buildDeck(recipes, swipes as { recipe_id: string; swiped_at: string }[]);
}

/** Est-ce que tous les enfants ont liké cette recette récemment ? */
export async function isMatch(recipeId: string): Promise<boolean> {
  const row = check(await db().from("active_matches").select("recipe_id").eq("recipe_id", recipeId).maybeSingle());
  return row != null;
}

// ─── Courses ───────────────────────────────────────────────────────────

/** La session de courses en cours (ouverte ou validée, pas trop ancienne). */
export async function getCurrentTrip(): Promise<Trip | null> {
  const since = new Date(Date.now() - TRIP_MAX_AGE_MS).toISOString();
  return check(
    await db()
      .from("shopping_trips")
      .select("id, departs_at, deadline_at, status, validated_at, created_at")
      .neq("status", "done")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
}

export async function getTripRequests(tripId: string): Promise<TripRequest[]> {
  return check(
    await db()
      .from("trip_requests")
      .select("id, profile_id, free_text, recipe_ids, updated_at")
      .eq("trip_id", tripId)
      .order("updated_at"),
  );
}

export async function getTripSelection(tripId: string): Promise<Map<string, boolean>> {
  const rows = check(
    await db().from("trip_recipes").select("recipe_id, selected").eq("trip_id", tripId),
  ) as { recipe_id: string; selected: boolean }[];
  return new Map(rows.map((r) => [r.recipe_id, r.selected]));
}

export async function getListItems(tripId: string): Promise<ListItem[]> {
  return check(
    await db()
      .from("shopping_list_items")
      .select("id, name, quantity, unit, aisle, source, for_recipes, checked, created_at")
      .eq("trip_id", tripId)
      .order("created_at")
      .order("name"),
  );
}
