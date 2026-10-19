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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cocher ou décocher, un article ou plusieurs d'un coup (la file d'attente du téléphone,
 * au retour du réseau). Chaque état est absolu : renvoyer deux fois ne change rien.
 */
export async function setItemsChecked(changes: { id: string; checked: boolean }[]) {
  const valides = changes.slice(0, 300).filter((c) => UUID.test(c.id) && typeof c.checked === "boolean");
  if (valides.length === 0) return;
  const trip = await tripId();
  const maj = (checked: boolean) => {
    const ids = valides.filter((c) => c.checked === checked).map((c) => c.id);
    return ids.length ? db().from("shopping_list_items").update({ checked }).in("id", ids).eq("trip_id", trip) : null;
  };
  const resultats = await Promise.all([maj(true), maj(false)]);
  const erreur = resultats.find((r) => r?.error)?.error;
  if (erreur) throw new Error(erreur.message);
  changed();
}

/**
 * Un ou plusieurs articles ; « 2 kg pommes » garde sa quantité, le rayon est deviné.
 * Un article créé sur le téléphone arrive avec son identifiant : renvoyé deux fois
 * (réseau revenu, appui répété), il n'est ajouté qu'une fois.
 */
export async function addItems(entries: (string | { id: string; texte: string })[], source: "manual" | "request" = "manual") {
  if (source !== "manual" && source !== "request") return;
  const lignes = entries.slice(0, 20).flatMap((e) => {
    const { id, texte } = typeof e === "string" ? { id: crypto.randomUUID(), texte: e } : e;
    const article = UUID.test(id) && typeof texte === "string" ? lireArticle(texte) : null;
    return article ? [{ id, ...article, source }] : [];
  });
  if (lignes.length === 0) return;
  const trip = await tripId();
  const { error } = await db()
    .from("shopping_list_items")
    .upsert(
      lignes.map((l) => ({ ...l, trip_id: trip })),
      { onConflict: "id", ignoreDuplicates: true },
    );
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
