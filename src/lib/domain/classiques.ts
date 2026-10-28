/*
 * Les classiques du foyer : un plat cuisiné plusieurs fois (« C'est fait ») est un classique de la famille.
 * Version simple : seul le nombre de fois compte. Il se remplit tout seul, au fil des repas.
 */

/** Cuisiné au moins ce nombre de fois : un classique. */
export const CLASSIQUE_MIN = 3;

export type RepasCuisine = { recipeId: string; faitLe: number };

/** Les plats classiques (le nombre de fois cuisinés), les plus cuisinés d'abord, puis les plus récents. */
export function classiquesDe(repas: RepasCuisine[], min = CLASSIQUE_MIN): { recipeId: string; fois: number }[] {
  const fois = new Map<string, { n: number; dernier: number }>();
  for (const r of repas) {
    const x = fois.get(r.recipeId) ?? { n: 0, dernier: 0 };
    fois.set(r.recipeId, { n: x.n + 1, dernier: Math.max(x.dernier, r.faitLe) });
  }
  return [...fois]
    .filter(([, x]) => x.n >= min)
    .sort((a, b) => b[1].n - a[1].n || b[1].dernier - a[1].dernier || a[0].localeCompare(b[0]))
    .map(([recipeId, x]) => ({ recipeId, fois: x.n }));
}
