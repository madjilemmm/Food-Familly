export const SWIPE_TTL_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

/**
 * Le paquet d'un enfant : les recettes jamais swipées d'abord (les plus
 * récentes en premier), puis celles swipées il y a plus de 14 jours (les plus
 * anciennes en premier). Le paquet ne s'épuise donc jamais pour de bon.
 */
export function buildDeck<R extends { id: string; created_at: string }>(
  recipes: R[],
  mySwipes: { recipe_id: string; swiped_at: string }[],
  now: Date = new Date(),
): R[] {
  const swipedAt = new Map(mySwipes.map((s) => [s.recipe_id, new Date(s.swiped_at).getTime()]));
  const cutoff = now.getTime() - SWIPE_TTL_DAYS * DAY;

  const fresh = recipes
    .filter((r) => !swipedAt.has(r.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const returning = recipes
    .filter((r) => swipedAt.has(r.id) && swipedAt.get(r.id)! <= cutoff)
    .sort((a, b) => swipedAt.get(a.id)! - swipedAt.get(b.id)!);

  return [...fresh, ...returning];
}

/** Date à laquelle une recette swipée reviendra dans le paquet. */
export function returnsAt(swipedAt: string): Date {
  return new Date(new Date(swipedAt).getTime() + SWIPE_TTL_DAYS * DAY);
}

export function daysLeft(until: string | Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(until).getTime() - now.getTime()) / DAY));
}
