"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { CE_SOIR_COOKIE, PAS_CE_SOIR_JOURS } from "@/lib/domain/ce-soir";
import { jourAParis } from "@/lib/domain/heure";
import { choisirPlat } from "@/lib/menu";
import { changed } from "./_shared";
import { skipTastes } from "./tastes";

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

/**
 * « Ce sera ça » : le plat est celui de ce soir, il entre au Menu et ses ingrédients vont sur la liste
 * (le caddie). Pour toute la famille ; un seul plat par soir : le dernier choix remplace le précédent.
 * Base pas encore migrée : le plat entre quand même au Menu, la carte n'est simplement pas retenue.
 */
export async function ceSeraCa(recipeId: string) {
  const user = await requireUser();
  const { data: recette } = await db().from("recipes").select("id").eq("id", recipeId).eq("family_id", user.familyId).maybeSingle();
  if (!recette) redirect("/menu");
  await choisirPlat(user.familyId, recipeId, true);
  const { error } = await db()
    .from("ce_soir_choix")
    .upsert({ family_id: user.familyId, jour: jourAParis(), recipe_id: recipeId, choisi_par: user.profileId, choisi_le: new Date().toISOString() }, { onConflict: "family_id,jour" });
  // Base pas encore migrée : le choix reste au moins sur ce téléphone.
  if (error) (await cookies()).set(CE_SOIR_COOKIE, `${jourAParis()}:${recipeId}:${user.profileId}`, { path: "/", maxAge: 86_400, httpOnly: true, sameSite: "lax" });
  changed();
  redirect("/menu");
}

/** « Changer de plat » : le choix de ce soir est annulé, Kaddie propose à nouveau. Le plat reste au Menu. */
export async function changerCeSoir() {
  const user = await requireUser();
  await db().from("ce_soir_choix").delete().eq("family_id", user.familyId).eq("jour", jourAParis());
  (await cookies()).delete(CE_SOIR_COOKIE);
  changed();
  redirect("/menu");
}

/** « Non, aucun » : pas d'allergie ni de régime à signaler. On ne redemande pas. */
export async function aucuneAllergie() {
  await skipTastes();
  redirect("/menu");
}
