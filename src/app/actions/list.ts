"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { getCurrentTrip } from "@/lib/data";
import { lireArticle } from "@/lib/domain/articles";
import { changed } from "./_shared";

/** La liste appartient à la course en cours de la famille ; tout le monde peut la compléter. */
async function tripId() {
  const user = await requireUser();
  const trip = await getCurrentTrip(user.familyId);
  if (!trip) throw new Error("Aucune course en cours");
  return trip.id;
}

export async function setItemChecked(itemId: string, checked: boolean) {
  await db().from("shopping_list_items").update({ checked }).eq("id", itemId).eq("trip_id", await tripId());
  changed();
}

/** Un ou plusieurs articles ; « 2 kg pommes » garde sa quantité, le rayon est deviné. */
export async function addItems(texts: string[], source: "manual" | "request" = "manual") {
  const articles = texts.slice(0, 20).map(lireArticle).filter((a) => a !== null);
  if (articles.length === 0) return;
  const trip = await tripId();
  const { error } = await db()
    .from("shopping_list_items")
    .insert(articles.map((a) => ({ trip_id: trip, ...a, source })));
  if (error) throw new Error(error.message);
  changed();
}

export async function addItem(name: string, source: "manual" | "request" = "manual") {
  return addItems([name], source);
}

/**
 * Un article ajouté à la main disparaît ; un ingrédient de recette ou un article demandé
 * est mis de côté (« j'en ai déjà ») pour ne pas revenir à la prochaine mise à jour de la liste.
 */
export async function deleteItem(itemId: string, recette = false) {
  const trip = await tripId();
  const retire = recette
    ? await db().from("shopping_list_items").update({ source: "maison" }).eq("id", itemId).eq("trip_id", trip)
    : { error: null };
  // Base pas encore migrée (« maison » inconnu) : on supprime simplement.
  if (!recette || retire.error) await db().from("shopping_list_items").delete().eq("id", itemId).eq("trip_id", trip);
  changed();
}

/** « Annuler » après avoir retiré un ingrédient de recette ou un article demandé. */
export async function restoreItem(itemId: string, source: "recipe" | "request" = "recipe") {
  await db().from("shopping_list_items").update({ source }).eq("id", itemId).eq("trip_id", await tripId());
  changed();
}
