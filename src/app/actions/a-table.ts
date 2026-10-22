"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { notifyATable, notifyReponseATable } from "@/lib/notifications";
import { changed, cleanText } from "./_shared";

const DELAIS = [0, 10, 20, 30];

/** « À table ! » : maintenant ou dans quelques minutes ; les autres sont prévenus. */
export async function appelerATable(minutes: number, titre?: string) {
  const user = await requireUser();
  const delai = DELAIS.includes(minutes) ? minutes : 0;
  const plat = cleanText(titre, 120) || null;
  const { error } = await db()
    .from("a_table")
    .insert({
      family_id: user.familyId,
      cuisinier: user.profileId,
      titre: plat,
      a: new Date(Date.now() + delai * 60_000).toISOString(),
    });
  if (error) throw new Error(error.message);
  changed(() => notifyATable(user.familyId, user.profileId, delai, plat));
}

/** « J'arrive » ou « 5 min ». */
export async function repondreATable(id: string, reponse: "arrive" | "retard") {
  const user = await requireUser();
  const { data: appel } = await db().from("a_table").select("cuisinier").eq("id", id).eq("family_id", user.familyId).maybeSingle();
  if (!appel) throw new Error("Cet appel n'existe plus");
  const { error } = await db()
    .from("a_table_reponses")
    .upsert({
      a_table_id: id,
      profile_id: user.profileId,
      reponse: reponse === "retard" ? "retard" : "arrive",
      at: new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
  changed(() => (appel.cuisinier ? notifyReponseATable(user.familyId, user.profileId, appel.cuisinier as string, reponse) : Promise.resolve()));
}

/** La personne qui cuisine retire son appel. */
export async function annulerATable(id: string) {
  const user = await requireUser();
  await db().from("a_table").delete().eq("id", id).eq("family_id", user.familyId).eq("cuisinier", user.profileId);
  changed();
}
