"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { AUTRE, DIETS, INGREDIENTS } from "@/lib/domain/foods";
import { normalizeName } from "@/lib/domain/shopping-list";
import { lireEnvies, type Envies } from "@/lib/domain/envies";
import { changed } from "./_shared";

export type CardAnswer = "pas_fan" | "ok" | "adore";
export type TastesInput = { diets: string[]; autres: string[]; cards: Record<string, CardAnswer>; envies?: Envies; done: boolean };

const DIET_KEYS = new Set(DIETS.map((d) => d.key));
const CARD_KEYS = new Set(INGREDIENTS.map((f) => f.key));

/** Enregistre mes goûts (remplace tout). « done » = questionnaire terminé. */
export async function saveTastes(input: TastesInput): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  const diets = [...new Set((input.diets ?? []).filter((k) => DIET_KEYS.has(k)))];
  const autres = [
    ...new Set(
      (input.autres ?? [])
        .map((a) => String(a).trim().slice(0, 40))
        .filter((a) => normalizeName(a).length >= 2),
    ),
  ].slice(0, 8);
  const rows = [
    ...diets.map((food) => ({ food, level: "interdit" })),
    ...autres.map((a) => ({ food: `${AUTRE}${a}`, level: "interdit" })),
    // Une carte déjà interdite par un régime ne compte pas deux fois.
    ...Object.entries(input.cards ?? {})
      .filter(([k, v]) => CARD_KEYS.has(k) && !diets.includes(k) && (v === "pas_fan" || v === "adore"))
      .map(([food, level]) => ({ food, level })),
  ].map((r) => ({ ...r, profile_id: user.profileId }));

  const { error: delError } = await db().from("profile_tastes").delete().eq("profile_id", user.profileId);
  if (delError) return { error: "L'enregistrement a échoué. Réessaie." };
  if (rows.length) {
    const { error } = await db().from("profile_tastes").insert(rows);
    if (error) return { error: "L'enregistrement a échoué. Réessaie." };
  }
  const now = new Date().toISOString();
  await db()
    .from("profiles")
    .update({
      tastes_seen_at: now,
      ...(input.done ? { tastes_done_at: now } : {}),
      ...(input.envies ? { envies: lireEnvies(input.envies), envies_done_at: now } : {}),
    })
    .eq("id", user.profileId)
    .eq("family_id", user.familyId);
  changed();
  return { ok: true };
}

/** « Plus tard » : on ne redemande pas, une petite carte reste sur le swipe. */
export async function skipTastes() {
  const user = await requireUser();
  await db()
    .from("profiles")
    .update({ tastes_seen_at: new Date().toISOString() })
    .eq("id", user.profileId)
    .eq("family_id", user.familyId);
  changed();
}

/** Mode strict : ce qu'un membre n'aime pas disparaît pour toute la famille. */
export async function setStrictDislikes(strict: boolean) {
  const user = await requireUser();
  await db().from("families").update({ strict_dislikes: Boolean(strict) }).eq("id", user.familyId);
  changed();
}
