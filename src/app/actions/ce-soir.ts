"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { PAS_CE_SOIR_JOURS } from "@/lib/domain/ce-soir";
import { changed } from "./_shared";

/**
 * « Autre idée » : ce plat ne revient pas en premier dans Ce soir pendant deux jours,
 * pour toute la famille. Base pas encore migrée : on passe simplement à l'idée suivante.
 */
export async function autreIdee(recipeId: string, i: number) {
  const user = await requireUser();
  const { data: recette } = await db().from("recipes").select("id").eq("id", recipeId).eq("family_id", user.familyId).maybeSingle();
  if (!recette) redirect("/menu");
  const { error } = await db()
    .from("pas_ce_soir")
    .upsert(
      { family_id: user.familyId, recipe_id: recipeId, jusqu_a: new Date(Date.now() + PAS_CE_SOIR_JOURS * 86_400_000).toISOString() },
      { onConflict: "family_id,recipe_id" },
    );
  changed();
  redirect(error ? `/menu?i=${(Number(i) || 0) + 1}` : "/menu");
}
