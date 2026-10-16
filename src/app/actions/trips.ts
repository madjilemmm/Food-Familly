"use server";

import { redirect } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { getCurrentTrip, getRecipesWithIngredients, getProfile, getProfiles } from "@/lib/data";
import { deadlineFor, type DepartureChoice } from "@/lib/domain/trip";
import { mergeIngredients, itemKey, scaleIngredients } from "@/lib/domain/shopping-list";
import { notifyTripStarted, notifyRequestReceived } from "@/lib/notifications";
import { ROUTES } from "@/lib/routes";
import { changed, cleanText } from "./_shared";

const CHOICES: DepartureChoice[] = ["30min", "1h", "2h", "soir"];

async function currentTripOrThrow(user: CurrentUser) {
  const trip = await getCurrentTrip(user.familyId);
  if (!trip) throw new Error("Aucune course en cours");
  return trip;
}

/** Seule la personne qui fait les courses choisit les plats et valide la liste. */
async function myTripOrThrow(user: CurrentUser) {
  const trip = await currentTripOrThrow(user);
  if (trip.created_by !== user.profileId) throw new Error("Ce n'est pas vous qui faites ces courses");
  return trip;
}

/** Ne garde que les recettes de la famille. */
async function familyRecipeIds(user: CurrentUser, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data } = await db().from("recipes").select("id").eq("family_id", user.familyId).in("id", ids);
  return (data ?? []).map((r) => r.id as string);
}

// ─── La personne qui part faire les courses ────────────────────────────

/** Depuis le formulaire « Je pars dans… » : chaque durée est un bouton d'envoi (name="choice"). */
export async function startTripForm(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  return startTrip(String(formData.get("choice")) as DepartureChoice);
}

export async function startTrip(choice: DepartureChoice): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!CHOICES.includes(choice)) throw new Error("Choix invalide");

  const current = await getCurrentTrip(user.familyId);
  if (current && current.created_by !== user.profileId) {
    const shopper = current.created_by ? await getProfile(user.familyId, current.created_by) : null;
    if (shopper) return { error: `${shopper.name} fait déjà les courses.` };
  }

  const deadline = deadlineFor(choice);
  // Une seule session à la fois par famille : les anciennes sont closes.
  await db().from("shopping_trips").update({ status: "done" }).eq("family_id", user.familyId).neq("status", "done");
  const { data: trip, error } = await db()
    .from("shopping_trips")
    .insert({
      family_id: user.familyId,
      created_by: user.profileId,
      deadline_at: deadline.toISOString(),
      departs_at: deadline.toISOString(),
    })
    .select("id, deadline_at")
    .single();
  if (error) throw new Error(error.message);

  changed(() => notifyTripStarted(user.familyId, user.profileId, trip.deadline_at));
  // Une redirection plutôt qu'un rafraîchissement sur place : l'écran suit même si
  // les onglets sont encore en train de se précharger.
  redirect(ROUTES[user.style].courses);
}

export async function cancelTrip() {
  const user = await requireUser();
  const trip = await myTripOrThrow(user);
  await db().from("shopping_trips").delete().eq("id", trip.id);
  changed();
}

/** N'importe qui peut clore des courses terminées (par exemple si on les a faites à deux). */
export async function finishTrip() {
  const user = await requireUser();
  const trip = await currentTripOrThrow(user);
  await db().from("shopping_trips").update({ status: "done" }).eq("id", trip.id);
  changed();
  redirect(ROUTES[user.style].courses);
}

export async function setTripRecipe(recipeId: string, selected: boolean) {
  const user = await requireUser();
  const trip = await myTripOrThrow(user);
  if ((await familyRecipeIds(user, [recipeId])).length === 0) throw new Error("Recette inconnue");
  const { error } = await db()
    .from("trip_recipes")
    .upsert({ trip_id: trip.id, recipe_id: recipeId, selected }, { onConflict: "trip_id,recipe_id" });
  if (error) throw new Error(error.message);
  changed();
}

/** Pour combien de personnes sont ces courses (la liste en tient compte). */
export async function setTripPeople(people: number) {
  const user = await requireUser();
  const trip = await myTripOrThrow(user);
  const n = Math.round(Number(people));
  if (!Number.isFinite(n) || n < 1 || n > 30) throw new Error("Nombre invalide");
  await db().from("shopping_trips").update({ people: n }).eq("id", trip.id);
  changed();
}

/**
 * Génère (ou régénère) la liste à partir des plats cochés.
 * Les articles ajoutés à la main sont conservés ; les articles déjà cochés
 * le restent.
 */
export async function validateTrip() {
  const user = await requireUser();
  const trip = await myTripOrThrow(user);

  // Plats cochés et liste actuelle arrivent avec la course : pas de requête en plus.
  const selection = trip.trip_recipes.filter((r) => r.selected);
  const [recipes, members] = await Promise.all([
    getRecipesWithIngredients(user.familyId, selection.map((s) => s.recipe_id)),
    getProfiles(user.familyId),
  ]);
  // Quantités recalculées pour le nombre de personnes (toute la famille par défaut).
  const people = trip.people ?? Math.max(1, members.length);
  const merged = mergeIngredients(
    recipes.map((r) => ({ recipeTitle: r.title, ingredients: scaleIngredients(r.recipe_ingredients, r.servings, people) })),
  );

  const previous = trip.shopping_list_items;
  const wasChecked = new Set(
    previous.filter((i) => i.source === "recipe" && i.checked).map((i) => itemKey(i.name, i.unit)),
  );

  const replaceItems = async () => {
    await db().from("shopping_list_items").delete().eq("trip_id", trip.id).eq("source", "recipe");
    if (merged.length === 0) return;
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
  };
  await Promise.all([
    replaceItems(),
    db().from("shopping_trips").update({ status: "validated", validated_at: new Date().toISOString() }).eq("id", trip.id),
  ]);

  changed();
  redirect(ROUTES[user.style].liste);
}

// ─── Les autres membres ────────────────────────────────────────────────

export async function submitRequest(
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  const trip = await getCurrentTrip(user.familyId);
  if (!trip) return { error: "Personne n'a (encore) annoncé de courses." };
  if (trip.created_by === user.profileId) return { error: "C'est vous qui faites ces courses !" };

  const freeText = cleanText(formData.get("free_text")) || null;
  const recipeIds = await familyRecipeIds(user, [...new Set(formData.getAll("recipe_ids").map(String))].slice(0, 30));
  if (!freeText && recipeIds.length === 0) {
    return { error: "Écris quelque chose ou choisis au moins un plat." };
  }

  // La demande et le pré-cochage des plats demandés partent en même temps
  // (sans annuler un plat que la personne aurait volontairement décoché).
  const [{ error }] = await Promise.all([
    db()
      .from("trip_requests")
      .upsert(
        { trip_id: trip.id, profile_id: user.profileId, free_text: freeText, recipe_ids: recipeIds },
        { onConflict: "trip_id,profile_id" },
      ),
    recipeIds.length > 0
      ? db()
          .from("trip_recipes")
          .upsert(
            recipeIds.map((id) => ({ trip_id: trip.id, recipe_id: id, selected: true })),
            { onConflict: "trip_id,recipe_id", ignoreDuplicates: true },
          )
      : Promise.resolve(),
  ]);
  if (error) return { error: "Oups, l'envoi a échoué. Réessaie." };

  changed(() => notifyRequestReceived(user.familyId, trip.created_by, user.profileId, freeText, recipeIds.length));
  return { ok: true };
}
