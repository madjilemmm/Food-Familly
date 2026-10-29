"use server";

import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { CE_SOIR_COOKIE, PAS_CE_SOIR_JOURS, PREVENU_COOKIE } from "@/lib/domain/ce-soir";
import { jourAParis } from "@/lib/domain/heure";
import { raisonValide, type RaisonSoir } from "@/lib/domain/memoire";
import { changerFoyer, choisirPlat } from "@/lib/menu";
import { noterEtape } from "@/lib/etapes";
import { changed } from "./_shared";
import { skipTastes } from "./tastes";

/*
 * Aucune de ces actions ne redirige : elles sont appelées par FormeAction, qui recharge l'écran une fois
 * l'action finie (une redirection vers la page déjà affichée pouvait laisser l'ancien écran).
 */

/**
 * « Autre idée » : ce plat passe après les autres dans Ce soir pendant deux jours, pour toute la famille.
 * Base pas encore migrée : l'écart n'est pas gardé, l'écran propose simplement la suite.
 */
export async function autreIdee(recipeId: string) {
  const user = await requireUser();
  const { data: recette } = await db().from("recipes").select("id").eq("id", recipeId).eq("family_id", user.familyId).maybeSingle();
  if (!recette) return;
  await db()
    .from("pas_ce_soir")
    .upsert(
      { family_id: user.familyId, recipe_id: recipeId, jusqu_a: new Date(Date.now() + PAS_CE_SOIR_JOURS * 86_400_000).toISOString() },
      { onConflict: "family_id,recipe_id" },
    );
  await noterEtape("autre_idee");
  changed();
}

/**
 * Garde avec la décision du soir combien d'idées ont été écartées aujourd'hui (« Autre idée ») et la raison affichée sous le plat :
 * de quoi voir si la proposition plaît, sans savoir qui a décidé. Colonnes pas encore migrées : rien n'est gardé, la décision est faite.
 */
async function noterLaDecision(familyId: string, raison: RaisonSoir | null) {
  try {
    const { data } = await db().from("pas_ce_soir").select("jusqu_a").eq("family_id", familyId).gt("jusqu_a", new Date().toISOString());
    const aujourdhui = jourAParis();
    // Un plat écarté l'est jusqu'à PAS_CE_SOIR_JOURS jours plus tard : on retrouve le jour où il l'a été.
    const rang = (data ?? []).filter((r) => jourAParis(new Date(Date.parse(r.jusqu_a as string) - PAS_CE_SOIR_JOURS * 86_400_000)) === aujourdhui).length;
    await db().from("ce_soir_choix").update({ rang, raison }).eq("family_id", familyId).eq("jour", aujourdhui);
  } catch {
    // Mesurer ne doit jamais gêner la décision.
  }
}

/**
 * « Ce sera ça » : le plat est celui de ce soir, il entre au Menu et ses ingrédients vont sur la liste
 * (le caddie). Pour toute la famille ; un seul plat par soir : le dernier choix remplace le précédent.
 * Base pas encore migrée : le plat entre quand même au Menu, le choix est gardé sur ce téléphone.
 * `raison` : la ligne affichée sous le plat (domain/memoire.ts), gardée avec la décision pour la mesure.
 */
export async function ceSeraCa(recipeId: string, raison?: string) {
  const user = await requireUser();
  const { data: recette } = await db().from("recipes").select("id").eq("id", recipeId).eq("family_id", user.familyId).maybeSingle();
  if (!recette) return;
  await choisirPlat(user.familyId, recipeId, true);
  const { count: dejaChoisi } = await db().from("ce_soir_choix").select("jour", { count: "exact", head: true }).eq("family_id", user.familyId);
  const { error } = await db()
    .from("ce_soir_choix")
    .upsert({ family_id: user.familyId, jour: jourAParis(), recipe_id: recipeId, choisi_par: user.profileId, choisi_le: new Date().toISOString() }, { onConflict: "family_id,jour" });
  if (error) (await cookies()).set(CE_SOIR_COOKIE, `${jourAParis()}:${recipeId}:${user.profileId}`, { path: "/", maxAge: 86_400, httpOnly: true, sameSite: "lax" });
  // Le tout premier choix de la famille : une étape du début à compter.
  if (!error && dejaChoisi === 0) await noterEtape("premier_choix");
  // Dans une écriture à part : sans les colonnes de mesure (base pas encore migrée), la décision, elle, est bien enregistrée.
  if (!error) await noterLaDecision(user.familyId, raisonValide(raison));
  changed();
}

/** « Changer de plat » : le choix de ce soir est annulé, Kaddie propose à nouveau. Le plat reste au Menu. */
export async function changerCeSoir() {
  const user = await requireUser();
  await db().from("ce_soir_choix").delete().eq("family_id", user.familyId).eq("jour", jourAParis());
  (await cookies()).delete(CE_SOIR_COOKIE);
  // Un autre plat sera retenu : la famille sera à nouveau à prévenir.
  (await cookies()).delete(PREVENU_COOKIE);
  changed();
}

/** « Non » : pas d'allergie ni de régime à signaler. On ne redemande pas. */
export async function aucuneAllergie() {
  await skipTastes();
}

/**
 * « Prévenir la famille ? » a reçu sa réponse (« Prévenir » ou « Plus tard ») : la question ne revient pas pour ce dîner, sur ce téléphone.
 * Rien d'autre n'est gardé que le total du jour.
 */
export async function prevenuAujourdhui(oui: boolean) {
  await requireUser();
  (await cookies()).set(PREVENU_COOKIE, jourAParis(), { path: "/", maxAge: 86_400, httpOnly: true, sameSite: "lax" });
  await noterEtape(oui ? "prevenir_oui" : "prevenir_plus_tard");
}

/** « pour 4 » : le nombre de personnes à table, pour la famille. */
export async function pourCombien(n: number) {
  const user = await requireUser();
  await changerFoyer(user.familyId, Number(n));
  changed();
}
