/**
 * Le retour tactile : une vibration de 10 ms, sur les gestes qu'on répète (Miam, Bof, « Ce sera ça », cocher un article).
 * Jamais pour ouvrir ou fermer quelque chose. Navigateurs sans vibration (iPhone dans Safari) : rien, le retour visuel suffit.
 */
export function vibrer() {
  try {
    navigator.vibrate?.(10);
  } catch {
    // Pas de vibration possible : sans conséquence.
  }
}
