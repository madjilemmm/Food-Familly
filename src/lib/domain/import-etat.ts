/*
 * Quand retenter un import de nouvelles recettes. Pur calcul (pas de base) : voir lib/import-etat.ts pour le verrou.
 * Avant : à chaque affichage de « Idées » (donc à chaque swipe) un import tentait ~60 pages sans jamais se souvenir d'avoir déjà tout essayé :
 * en production, des dizaines d'imports d'affilée trouvaient « N recettes, 0 ajoutées ».
 */

const MIN = 60_000;
/** Délai avant de retenter après un import qui n'a rien ajouté (1er, 2e, 3e… essai vide) : s'allonge, puis plafonne à 6 h. */
const ATTENTE_APRES_RIEN = [3 * MIN, 10 * MIN, 30 * MIN, 2 * 60 * MIN, 6 * 60 * MIN];
/** Délai avant de retenter après une panne de la source (erreur, trop lent) : 1, 5, 15 minutes. */
const ATTENTE_APRES_ERREUR = [1 * MIN, 5 * MIN, 15 * MIN];
/** Après un import réussi, on laisse un court répit : les nouvelles cartes arrivent, pas besoin de relancer tout de suite. */
const ATTENTE_APRES_SUCCES = 3_000;
/** Une recherche qui n'a rien donné n'est pas refaite avant ce délai. */
export const OUBLI_TERME_MS = 3 * 24 * 60 * MIN;

export type Resultat = "ajoutees" | "rien" | "erreur";

export function prochainEssai(resultat: Resultat, essaisVides: number, maintenant: number): number {
  if (resultat === "ajoutees") return maintenant + ATTENTE_APRES_SUCCES;
  const paliers = resultat === "rien" ? ATTENTE_APRES_RIEN : ATTENTE_APRES_ERREUR;
  return maintenant + paliers[Math.min(Math.max(essaisVides, 1), paliers.length) - 1];
}

/** Ce que l'écran doit annoncer quand il n'y a plus rien devant l'utilisateur. */
export type EtatSource = "ok" | "en_cours" | "epuisee" | "indisponible";

export function etatDeLaSource(e: { verrouJusqua: number | null; essaisVides: number; dernierResultat: Resultat | null; maintenant: number } | null): EtatSource {
  if (!e) return "ok";
  if (e.verrouJusqua && e.verrouJusqua > e.maintenant) return "en_cours";
  if (e.dernierResultat === "erreur") return "indisponible";
  if (e.dernierResultat === "rien" && e.essaisVides >= 1) return "epuisee";
  return "ok";
}

/** Les recherches à ne pas refaire tout de suite : celles qui n'ont rien donné il y a moins de OUBLI_TERME_MS. */
export function termesAEviter(termesVides: Record<string, string>, maintenant: number): Set<string> {
  return new Set(Object.entries(termesVides).filter(([, quand]) => maintenant - Date.parse(quand) < OUBLI_TERME_MS).map(([t]) => t));
}
