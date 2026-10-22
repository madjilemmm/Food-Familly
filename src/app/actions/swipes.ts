"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { enviesPour, getProfiles } from "@/lib/data";
import { notifyMatch } from "@/lib/notifications";
import { oublierDuMenu, platsDuMenu, synchroniserMenu } from "@/lib/menu";
import { changed } from "./_shared";

/** Un swipe tel qu'il était avant (pour « Annuler ») ; null s'il n'y en avait pas. */
export type SwipeAvant = { liked: boolean; swiped_at: string; liked_at: string | null } | null;

/**
 * À droite : « j'en ai envie » (une envie, et on retient qu'on aime ce plat) ;
 * à gauche : « pas envie là » (on n'oublie pas qu'on l'a aimé avant).
 * Match : au moins 2 personnes en ont envie. Seules ces personnes sont prévenues.
 * Un plat qui plaît entre au Menu, et ses ingrédients vont sur la liste (lib/menu.ts) :
 * auMenu le dit, pour l'écran « C'est un match » ; entre : c'est ce swipe qui l'y a mis.
 */
export async function swipe(
  recipeId: string,
  liked: boolean,
): Promise<{ match: boolean; avec: string[]; avant: SwipeAvant; auMenu: boolean; entre: boolean }> {
  const user = await requireUser();
  // Vérification de la recette, swipe d'avant et « était-ce déjà un match ? » en même temps.
  const [{ data: recipe }, { data: avant }, avantMatch] = await Promise.all([
    db().from("recipes").select("id").eq("id", recipeId).eq("family_id", user.familyId).maybeSingle(),
    db().from("swipes").select("liked, swiped_at, liked_at").eq("profile_id", user.profileId).eq("recipe_id", recipeId).maybeSingle(),
    liked ? enviesPour(user.familyId, recipeId) : Promise.resolve(null),
  ]);
  if (!recipe) throw new Error("Recette inconnue");
  const now = new Date().toISOString();
  const { error } = await db()
    .from("swipes")
    .upsert(
      { profile_id: user.profileId, recipe_id: recipeId, liked, swiped_at: now, ...(liked ? { liked_at: now } : {}) },
      { onConflict: "profile_id,recipe_id" },
    );
  if (error) throw new Error(error.message);

  const likers = liked ? await enviesPour(user.familyId, recipeId) : null;
  const autres = (likers ?? []).filter((id) => id !== user.profileId);
  // Un nouveau match seulement (rejoindre un match déjà là ne réveille personne).
  const nouveau = likers != null && avantMatch == null;
  // Un « Miam » peut faire entrer le plat au Menu (et ses ingrédients sur la liste).
  const menu = liked ? await synchroniserMenu(user.familyId) : null;
  const ajoutes = menu?.ajoutes ?? [];
  const auMenu = menu ? platsDuMenu(menu.trip).includes(recipeId) : false;
  // Les autres téléphones ne sont prévenus (et rafraîchis) que si quelque chose change pour eux.
  if (nouveau) changed(() => notifyMatch(user.familyId, recipeId, autres, auMenu));
  else if (ajoutes.length) changed();
  else revalidatePath("/", "layout");
  const noms = new Map((await getProfiles(user.familyId)).map((p) => [p.id, p.name]));
  return {
    match: likers != null,
    avec: autres.flatMap((id) => noms.get(id) ?? []),
    avant: (avant as SwipeAvant) ?? null,
    auMenu,
    entre: ajoutes.includes(recipeId),
  };
}

/**
 * « Annuler » : le swipe redevient ce qu'il était (ou disparaît s'il n'y en avait pas).
 * S'il venait de mettre le plat au Menu, le plat en ressort, avec ses ingrédients.
 */
export async function undoSwipe(recipeId: string, avant: SwipeAvant = null, sortirDuMenu = false) {
  const user = await requireUser();
  const date = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);
  const ligne = db().from("swipes");
  if (avant && typeof avant.liked === "boolean" && date(avant.swiped_at)) {
    await ligne
      .update({ liked: avant.liked, swiped_at: date(avant.swiped_at), liked_at: date(avant.liked_at) })
      .eq("profile_id", user.profileId)
      .eq("recipe_id", recipeId);
  } else {
    await ligne.delete().eq("profile_id", user.profileId).eq("recipe_id", recipeId);
  }
  if (sortirDuMenu === true) await oublierDuMenu(user.familyId, recipeId);
  changed();
}

/** « Effacer mon avis » (fiche recette) : ni goût ni envie, comme si on ne l'avait jamais swipé. */
export async function oublierAvis(recipeId: string) {
  const user = await requireUser();
  await db().from("swipes").delete().eq("profile_id", user.profileId).eq("recipe_id", recipeId);
  changed();
}
