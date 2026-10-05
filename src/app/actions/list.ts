"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { getCurrentTrip } from "@/lib/data";
import { changed } from "./_shared";

async function tripId() {
  const trip = await getCurrentTrip();
  if (!trip) throw new Error("Aucune course en cours");
  return trip.id;
}

export async function setItemChecked(itemId: string, checked: boolean) {
  await requireUser("parent");
  await db().from("shopping_list_items").update({ checked }).eq("id", itemId);
  changed();
}

export async function addItem(name: string, source: "manual" | "request" = "manual") {
  await requireUser("parent");
  const clean = name.trim().slice(0, 200);
  if (!clean) return;
  const { error } = await db()
    .from("shopping_list_items")
    .insert({ trip_id: await tripId(), name: clean, source, aisle: "autre" });
  if (error) throw new Error(error.message);
  changed();
}

export async function deleteItem(itemId: string) {
  await requireUser("parent");
  await db().from("shopping_list_items").delete().eq("id", itemId);
  changed();
}
