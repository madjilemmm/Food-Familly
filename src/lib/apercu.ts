import "server-only";
import { db } from "@/lib/supabase/server";
import { familleInvitee } from "@/lib/acces";
import { jourAParis } from "@/lib/domain/heure";
import type { Apercu } from "@/lib/domain/apercu";

/** Ce que montre le lien d'invitation avant même qu'on l'ouvre. Lien expiré : rien. */
export async function apercuInvitation(jeton: string): Promise<Apercu | null> {
  const famille = await familleInvitee(jeton);
  if (!famille) return null;
  const { data: choix } = await db().from("ce_soir_choix").select("recipe_id").eq("family_id", famille.id).eq("jour", jourAParis()).maybeSingle();
  if (!choix) return { famille: famille.name, par: famille.par, plat: null };
  const [{ data: recette }, { count }] = await Promise.all([
    db().from("recipes").select("title, photo_url").eq("id", choix.recipe_id).maybeSingle(),
    db().from("recipe_ingredients").select("id", { count: "exact", head: true }).eq("recipe_id", choix.recipe_id),
  ]);
  if (!recette) return { famille: famille.name, par: famille.par, plat: null };
  return { famille: famille.name, par: famille.par, plat: { titre: recette.title as string, photo: (recette.photo_url as string | null) ?? null, articles: count ?? 0 } };
}
