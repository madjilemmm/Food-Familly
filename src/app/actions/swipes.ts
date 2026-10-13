"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { isMatch } from "@/lib/data";
import { notifyMatch } from "@/lib/notifications";
import { changed } from "./_shared";

export async function swipe(recipeId: string, liked: boolean): Promise<{ match: boolean }> {
  const user = await requireUser();
  const { data: recipe } = await db().from("recipes").select("id").eq("id", recipeId).eq("family_id", user.familyId).maybeSingle();
  if (!recipe) throw new Error("Recette inconnue");

  // Était-ce déjà un match avant ce like ? On ne prévient les autres que pour les nouveaux.
  const wasMatch = liked && (await isMatch(user.familyId, recipeId));
  const { error } = await db()
    .from("swipes")
    .upsert(
      { profile_id: user.profileId, recipe_id: recipeId, liked, swiped_at: new Date().toISOString() },
      { onConflict: "profile_id,recipe_id" },
    );
  if (error) throw new Error(error.message);

  const match = liked && (await isMatch(user.familyId, recipeId));
  changed(match && !wasMatch ? () => notifyMatch(user.familyId, user.profileId, recipeId) : undefined);
  return { match };
}
