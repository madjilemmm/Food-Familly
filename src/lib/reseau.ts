import { unstable_isUnrecognizedActionError, unstable_rethrow } from "next/navigation";

/*
 * Une action qui échoue ne doit jamais faire planter l'écran (« Application error ») :
 * on reste sur place, avec ce qui a été saisi, et un message clair.
 */

export const MESSAGE_RESEAU = "Pas de réseau : rien n'est parti, mais rien n'est perdu. Réessaie quand ça revient.";
const MESSAGE_MISE_A_JOUR = "Kaddie vient d'être mise à jour : recharge la page pour continuer.";
const MESSAGE_IMPREVU = "Ça n'a pas marché. Réessaie dans un instant.";

/** La requête n'a pas pu partir (réseau coupé, appli mise en veille…) : rien n'a été fait côté serveur. */
export function estErreurReseau(e: unknown): boolean {
  return e instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false);
}

/** Le message à afficher pour une action qui a échoué. Les redirections de Next continuent leur chemin. */
export function messageErreur(e: unknown, reseau = MESSAGE_RESEAU): string {
  unstable_rethrow(e);
  if (unstable_isUnrecognizedActionError(e)) return MESSAGE_MISE_A_JOUR;
  return estErreurReseau(e) ? reseau : MESSAGE_IMPREVU;
}

/** Pour useActionState : en cas d'échec, l'état reçoit un message au lieu de faire planter la page. */
export function sansPlantage<S extends { error?: string }, A extends unknown[]>(
  action: (etat: S, ...args: A) => Promise<S>,
  reseau = MESSAGE_RESEAU,
) {
  return async (etat: S, ...args: A): Promise<S> => {
    try {
      return await action(etat, ...args);
    } catch (e) {
      return { ...etat, ok: undefined, error: messageErreur(e, reseau) };
    }
  };
}
