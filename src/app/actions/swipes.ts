"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { isMatch } from "@/lib/data";
import { notifyMatch } from "@/lib/notifications";
import { changed } from "./_shared";

export async function swipe(recipeId: string, liked: boolean): Promise<{ match: boolean }> {
  const user = await requireUser();
  // Vérification de la recette et « était-ce déjà un match ? » en même temps
  // (on ne prévient les autres que pour les nouveaux matchs).
  const [{ data: recipe }, wasMatch] = await Promise.all([
    db().from("recipes").select("id").eq("id", recipeId).eq("family_id", user.familyId).maybeSingle(),
    liked ? isMatch(user.familyId, recipeId) : Promise.resolve(false),
  ]);
  if (!recipe) throw new Error("Recette inconnue");
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
