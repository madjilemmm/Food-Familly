"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { isMatch } from "@/lib/data";
import { notifyMatch } from "@/lib/notifications";
import { changed } from "./_shared";

export async function swipe(recipeId: string, liked: boolean): Promise<{ match: boolean }> {
  const user = await requireUser("child");
  const { error } = await db()
    .from("swipes")
    .upsert(
      { profile_id: user.profileId, recipe_id: recipeId, liked, swiped_at: new Date().toISOString() },
      { onConflict: "profile_id,recipe_id" },
    );
  if (error) throw new Error(error.message);

  const match = liked && (await isMatch(recipeId));
  changed(match ? () => notifyMatch(user.profileId, recipeId) : undefined);
  return { match };
}
