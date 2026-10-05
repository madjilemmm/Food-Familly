"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { getCurrentTrip, getRecipesWithIngredients, getListItems } from "@/lib/data";
import { deadlineFor, type DepartureChoice } from "@/lib/domain/trip";
import { mergeIngredients, itemKey } from "@/lib/domain/shopping-list";
import { notifyTripStarted, notifyRequestReceived } from "@/lib/notifications";
import { changed, cleanText } from "./_shared";

const CHOICES: DepartureChoice[] = ["30min", "1h", "2h", "soir"];

async function currentTripOrThrow() {
  const trip = await getCurrentTrip();
  if (!trip) throw new Error("Aucune course en cours");
  return trip;
}

// ─── Maman ─────────────────────────────────────────────────────────────

export async function startTrip(choice: DepartureChoice) {
  const user = await requireUser("parent");
  if (!CHOICES.includes(choice)) throw new Error("Choix invalide");
  const deadline = deadlineFor(choice);

  // Une seule session à la fois : les anciennes sont closes.
  await db().from("shopping_trips").update({ status: "done" }).neq("status", "done");
  const { data: trip, error } = await db()
    .from("shopping_trips")
    .insert({ created_by: user.profileId, deadline_at: deadline.toISOString(), departs_at: deadline.toISOString() })
    .select("id, deadline_at")
    .single();
  if (error) throw new Error(error.message);

  changed(() => notifyTripStarted(trip.deadline_at));
}

export async function cancelTrip() {
  await requireUser("parent");
  const trip = await currentTripOrThrow();
  await db().from("shopping_trips").delete().eq("id", trip.id);
  changed();
}

export async function finishTrip() {
  await requireUser("parent");
  const trip = await currentTripOrThrow();
  await db().from("shopping_trips").update({ status: "done" }).eq("id", trip.id);
  changed();
  redirect("/maman");
}

export async function setTripRecipe(recipeId: string, selected: boolean) {
  await requireUser("parent");
  const trip = await currentTripOrThrow();
  const { error } = await db()
    .from("trip_recipes")
    .upsert({ trip_id: trip.id, recipe_id: recipeId, selected }, { onConflict: "trip_id,recipe_id" });
  if (error) throw new Error(error.message);
  changed();
}

/**
 * Génère (ou régénère) la liste à partir des plats cochés.
 * Les articles ajoutés à la main sont conservés ; les articles déjà cochés
 * le restent.
 */
export async function validateTrip() {
  await requireUser("parent");
  const trip = await currentTripOrThrow();

  const { data: selection, error } = await db()
    .from("trip_recipes")
    .select("recipe_id")
    .eq("trip_id", trip.id)
    .eq("selected", true);
  if (error) throw new Error(error.message);

  const recipes = await getRecipesWithIngredients(selection.map((s) => s.recipe_id));
  const merged = mergeIngredients(
    recipes.map((r) => ({ recipeTitle: r.title, ingredients: r.recipe_ingredients })),
  );

  const previous = await getListItems(trip.id);
  const wasChecked = new Set(
    previous.filter((i) => i.source === "recipe" && i.checked).map((i) => itemKey(i.name, i.unit)),
  );

  await db().from("shopping_list_items").delete().eq("trip_id", trip.id).eq("source", "recipe");
  if (merged.length > 0) {
    const { error: insertError } = await db().from("shopping_list_items").insert(
      merged.map((m) => ({
        trip_id: trip.id,
        name: m.name,
        quantity: m.quantity,
        unit: m.unit,
        aisle: m.aisle,
        source: "recipe",
        for_recipes: m.forRecipes.join(", "),
        checked: wasChecked.has(m.key),
      })),
    );
    if (insertError) throw new Error(insertError.message);
  }

  await db()
    .from("shopping_trips")
    .update({ status: "validated", validated_at: new Date().toISOString() })
    .eq("id", trip.id);

  changed();
  redirect("/maman/liste");
}

// ─── Enfants ───────────────────────────────────────────────────────────

export async function submitRequest(
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser("child");
  const trip = await getCurrentTrip();
  if (!trip) return { error: "Maman n'a pas (encore) annoncé de courses." };

  const freeText = cleanText(formData.get("free_text")) || null;
  const recipeIds = [...new Set(formData.getAll("recipe_ids").map(String))].slice(0, 30);
  if (!freeText && recipeIds.length === 0) {
    return { error: "Écris quelque chose ou choisis au moins un plat." };
  }

  const { error } = await db()
    .from("trip_requests")
    .upsert(
      { trip_id: trip.id, profile_id: user.profileId, free_text: freeText, recipe_ids: recipeIds },
      { onConflict: "trip_id,profile_id" },
    );
  if (error) return { error: "Oups, l'envoi a échoué. Réessaie." };

  // Les plats demandés sont pré-cochés pour maman (sans annuler un plat
  // qu'elle aurait volontairement décoché).
  if (recipeIds.length > 0) {
    await db()
      .from("trip_recipes")
      .upsert(
        recipeIds.map((id) => ({ trip_id: trip.id, recipe_id: id, selected: true })),
        { onConflict: "trip_id,recipe_id", ignoreDuplicates: true },
      );
  }

  changed(() => notifyRequestReceived(user.profileId, freeText, recipeIds.length));
  return { ok: true };
}
