/** Combien de personnes à table : un entier de 1 à `max` ; null si ce n'est pas un nombre (formulaire vide, valeur absurde). */
export function foyerValide(valeur: unknown, max = 12): number | null {
  const n = typeof valeur === "number" ? valeur : typeof valeur === "string" && valeur.trim() !== "" ? Number(valeur) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(1, Math.round(n)));
}
