"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { getCurrentTrip } from "@/lib/data";
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

export async function addItem(name: string, source: "manual" | "request" = "manual") {
  const clean = name.trim().slice(0, 200);
  if (!clean) return;
  const { error } = await db()
    .from("shopping_list_items")
    .insert({ trip_id: await tripId(), name: clean, source, aisle: "autre" });
  if (error) throw new Error(error.message);
  changed();
}

export async function deleteItem(itemId: string) {
  await db().from("shopping_list_items").delete().eq("id", itemId).eq("trip_id", await tripId());
  changed();
}
