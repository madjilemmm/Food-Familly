"use server";

import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { CE_SOIR_COOKIE, PAS_CE_SOIR_JOURS, PREVENU_COOKIE } from "@/lib/domain/ce-soir";
import { jourAParis } from "@/lib/domain/heure";
import { raisonValide, type RaisonSoir } from "@/lib/domain/memoire";
import { getFamilyEnvies, getProfiles } from "@/lib/data";
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
 * (le caddie). Pour toute la famille ; un seul plat par soir : le premier choix gagne. Si quelqu'un a décidé entre-temps
 * (un écran pas encore à jour), on ne le remplace pas et le plat de celui qui arrive après n'entre ni au Menu ni sur la liste :
 * l'écran se recharge sur le choix déjà fait, « choisi par Karin ».
 * Base pas encore migrée : le plat entre quand même au Menu, le choix est gardé sur ce téléphone.
 * `raison` : la ligne affichée sous le plat (domain/memoire.ts), gardée avec la décision pour la mesure.
 */
export async function ceSeraCa(recipeId: string, raison?: string): Promise<{ dejaChoisi?: boolean }> {
  const user = await requireUser();
  const { data: recette } = await db().from("recipes").select("id").eq("id", recipeId).eq("family_id", user.familyId).maybeSingle();
  if (!recette) return {};
  const jour = jourAParis();
  const { count: dejaChoisi } = await db().from("ce_soir_choix").select("jour", { count: "exact", head: true }).eq("family_id", user.familyId);
  const { data: prise, error } = await db()
    .from("ce_soir_choix")
    .upsert({ family_id: user.familyId, jour, recipe_id: recipeId, choisi_par: user.profileId, choisi_le: new Date().toISOString() }, { onConflict: "family_id,jour", ignoreDuplicates: true })
    .select("recipe_id");
  const gagne = !error && Boolean(prise?.length);
  if (!error && !gagne) {
    // Une décision existe déjà pour ce soir : le même plat (un double appui), ou un autre, arrivé avant.
    const { data: existant } = await db().from("ce_soir_choix").select("recipe_id").eq("family_id", user.familyId).eq("jour", jour).maybeSingle();
    if (existant && existant.recipe_id !== recipeId) {
      changed();
      return { dejaChoisi: true };
    }
  }
  if (error) (await cookies()).set(CE_SOIR_COOKIE, `${jour}:${recipeId}:${user.profileId}`, { path: "/", maxAge: 86_400, httpOnly: true, sameSite: "lax" });
  await choisirPlat(user.familyId, recipeId, true);
  // Le tout premier choix de la famille : une étape du début à compter.
  if (gagne && dejaChoisi === 0) await noterEtape("premier_choix");
  // Dans une écriture à part : sans les colonnes de mesure (base pas encore migrée), la décision, elle, est bien enregistrée.
  if (gagne) await noterLaDecision(user.familyId, raisonValide(raison));
  changed();
  return {};
}

/**
 * « Changer de plat » : le choix de ce soir est annulé, Kaddie propose à nouveau. Le plat quitté ne revient pas en tête
 * (comme « Autre idée ») et sort du Menu, donc ses articles de la liste, sauf si la famille le voulait déjà (un match).
 */
export async function changerCeSoir() {
  const user = await requireUser();
  const jour = jourAParis();
  const { data: ancien } = await db().from("ce_soir_choix").select("recipe_id").eq("family_id", user.familyId).eq("jour", jour).maybeSingle();
  // Base pas encore migrée : le choix est sur ce téléphone.
  const [cookieJour, cookieRecette] = ((await cookies()).get(CE_SOIR_COOKIE)?.value ?? "").split(":");
  const quitte = (ancien?.recipe_id as string | undefined) ?? (cookieJour === jour ? cookieRecette : undefined);
  await db().from("ce_soir_choix").delete().eq("family_id", user.familyId).eq("jour", jour);
  (await cookies()).delete(CE_SOIR_COOKIE);
  // Un autre plat sera retenu : la famille sera à nouveau à prévenir.
  (await cookies()).delete(PREVENU_COOKIE);
  if (quitte) await quitterLePlat(user.familyId, quitte);
  changed();
}

/**
 * « Annuler » juste après « Ce sera ça » : le choix est défait comme s'il n'avait pas eu lieu. Le plat ne passe pas après les autres
 * (contrairement à « Changer de plat »), il sort du Menu s'il n'y était que par ce choix. Si quelqu'un a choisi un autre plat entre-temps, rien n'est défait.
 */
export async function defaireCeSoir(recipeId: string) {
  const user = await requireUser();
  const jour = jourAParis();
  const { data: supprime } = await db().from("ce_soir_choix").delete().eq("family_id", user.familyId).eq("jour", jour).eq("recipe_id", recipeId).select("recipe_id");
  // Base pas encore migrée : le choix est sur ce téléphone.
  const c = (await cookies()).get(CE_SOIR_COOKIE)?.value ?? "";
  const surCeTelephone = c.startsWith(`${jour}:${recipeId}:`);
  if (!supprime?.length && !surCeTelephone) return;
  (await cookies()).delete(CE_SOIR_COOKIE);
  (await cookies()).delete(PREVENU_COOKIE);
  await sortirDuMenuSiPasVoulu(user.familyId, recipeId);
  changed();
}

/** Le plat qu'on quitte passe après les autres pendant deux jours ; il sort du Menu s'il n'y était que par le choix du soir. */
async function quitterLePlat(familyId: string, recipeId: string) {
  await db()
    .from("pas_ce_soir")
    .upsert({ family_id: familyId, recipe_id: recipeId, jusqu_a: new Date(Date.now() + PAS_CE_SOIR_JOURS * 86_400_000).toISOString() }, { onConflict: "family_id,recipe_id" });
  await sortirDuMenuSiPasVoulu(familyId, recipeId);
}

async function sortirDuMenuSiPasVoulu(familyId: string, recipeId: string) {
  const [envies, membres] = await Promise.all([getFamilyEnvies(familyId), getProfiles(familyId)]);
  // Même règle que pour entrer au Menu tout seul : au moins deux envies (une seule dans une famille d'une personne).
  const voulu = (envies.get(recipeId)?.length ?? 0) >= (membres.length === 1 ? 1 : 2);
  if (!voulu) await choisirPlat(familyId, recipeId, false);
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
