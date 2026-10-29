import "server-only";
import { db } from "@/lib/supabase/server";

/**
 * Compte une étape (l'accueil, une famille créée, un premier choix, la liste ouverte, un lien partagé, un invité arrivé ; puis,
 * pour savoir si l'on revient : comment Kaddie est ouverte, « Ce soir » affiché, « Autre idée », « Prévenir la famille ? ») :
 * un total par jour, sans identifiant ni famille. Sert à voir où l'on s'arrête. Base pas encore migrée : rien ne se passe.
 *
 *   select etape, sum(n) from parcours_etapes where jour >= current_date - 7 group by etape;
 */
export type Etape =
  | "accueil"
  | "famille_creee"
  | "premier_choix"
  | "liste_ouverte"
  | "invitation_envoyee"
  | "invite_arrive"
  // Comment Kaddie est ouverte, une fois par visite : l'icône de l'écran d'accueil, une notification, un lien partagé dans le groupe.
  | "ouverture_icone"
  | "ouverture_notification"
  | "ouverture_lien"
  // « Ce soir » affiché (une fois par visite), et les idées écartées avec « Autre idée ».
  | "ce_soir_affiche"
  | "autre_idee"
  // « Prévenir la famille ? » après « Ce sera ça » : la question posée (une fois par jour et par téléphone), puis la réponse.
  | "prevenir_propose"
  | "prevenir_oui"
  | "prevenir_plus_tard";

export async function noterEtape(etape: Etape): Promise<void> {
  try {
    await db().rpc("noter_etape", { p_etape: etape });
  } catch {
    // Compter ne doit jamais gêner l'utilisateur.
  }
}
