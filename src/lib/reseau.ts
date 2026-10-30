import { unstable_isUnrecognizedActionError, unstable_rethrow } from "next/navigation";

/*
 * Une action qui échoue ne doit jamais faire planter l'écran (« Application error ») :
 * on reste sur place, avec ce qui a été saisi, et un message clair.
 */

export const MESSAGE_RESEAU = "Pas de réseau : rien n'est parti, mais rien n'est perdu. Réessaie quand ça revient.";
const MESSAGE_MISE_A_JOUR = "Kaddie vient d'être mise à jour : recharge la page pour continuer.";
const MESSAGE_IMPREVU = "Ça n'a pas marché. Réessaie dans un instant.";

/** La session a pris fin (cookie effacé ou expiré) : le serveur répond « non connecté ». Ce n'est pas le réseau. */
export class SessionExpiree extends Error {
  constructor() {
    super("Session expirée");
    this.name = "SessionExpiree";
  }
}
/** Là où l'on renvoie une session expirée : l'accueil, qui dit pourquoi. */
export const ADRESSE_SESSION_EXPIREE = "/bienvenue?session=expiree";

/** Le serveur ne reconnaît plus l'action : l'appli a été mise à jour depuis que cet écran est ouvert. Rien n'a été refusé. */
export const estActionInconnue = (e: unknown) => unstable_isUnrecognizedActionError(e);

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

/** Ce que dit l'écran après un échec, côté téléphone : le réseau, une mise à jour de l'appli, ou un imprévu (jamais « pas de réseau » pour autre chose). */
export function raisonDeLEchec(e: unknown, reseau = MESSAGE_RESEAU): string {
  if (estActionInconnue(e)) return MESSAGE_MISE_A_JOUR;
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
