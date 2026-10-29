import "server-only";
import { db } from "@/lib/supabase/server";

/**
 * Compte une étape du début (l'accueil, une famille créée, un premier choix, la liste ouverte, un lien partagé, un invité
 * arrivé) : un total par jour, sans identifiant ni famille. Sert à voir où l'on s'arrête. Base pas encore migrée : rien ne se passe.
 *
 *   select etape, sum(n) from parcours_etapes where jour >= current_date - 7 group by etape;
 */
export type Etape = "accueil" | "famille_creee" | "premier_choix" | "liste_ouverte" | "invitation_envoyee" | "invite_arrive";

export async function noterEtape(etape: Etape): Promise<void> {
  try {
    await db().rpc("noter_etape", { p_etape: etape });
  } catch {
    // Compter ne doit jamais gêner l'utilisateur.
  }
}
