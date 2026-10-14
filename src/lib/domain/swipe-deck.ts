export const SWIPE_TTL_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

/** Ce que les goûts de la famille font d'une recette (voir foods.ts). */
export type DeckRank = "cache" | "fin" | "tete" | "normal";

/**
 * Le paquet d'un membre : les recettes jamais swipées d'abord (celles qu'il
 * adore en tête, puis les plus récentes), puis celles swipées il y a plus de
 * 14 jours (les plus anciennes en premier), et enfin celles qu'un autre membre
 * n'aime pas. Les recettes « cache » n'y sont pas. Le paquet ne s'épuise donc
 * jamais pour de bon.
 */
export function buildDeck<R extends { id: string; created_at: string }>(
  recipes: R[],
  mySwipes: { recipe_id: string; swiped_at: string }[],
  now: Date = new Date(),
  rank: (r: R) => DeckRank = () => "normal",
): R[] {
  const swipedAt = new Map(mySwipes.map((s) => [s.recipe_id, new Date(s.swiped_at).getTime()]));
  const cutoff = now.getTime() - SWIPE_TTL_DAYS * DAY;
  const ranks = new Map(recipes.map((r) => [r.id, rank(r)]));
  const visible = recipes.filter((r) => ranks.get(r.id) !== "cache");
  const available = (r: R) => !swipedAt.has(r.id) || swipedAt.get(r.id)! <= cutoff;

  const fresh = visible
    .filter((r) => !swipedAt.has(r.id) && ranks.get(r.id) !== "fin")
    .sort(
      (a, b) =>
        Number(ranks.get(b.id) === "tete") - Number(ranks.get(a.id) === "tete") || b.created_at.localeCompare(a.created_at),
    );
  const returning = visible
    .filter((r) => swipedAt.has(r.id) && swipedAt.get(r.id)! <= cutoff && ranks.get(r.id) !== "fin")
    .sort((a, b) => swipedAt.get(a.id)! - swipedAt.get(b.id)!);
  const last = visible.filter((r) => ranks.get(r.id) === "fin" && available(r));

  return [...fresh, ...returning, ...last];
}

/** Date à laquelle une recette swipée reviendra dans le paquet. */
export function returnsAt(swipedAt: string): Date {
  return new Date(new Date(swipedAt).getTime() + SWIPE_TTL_DAYS * DAY);
}

export function daysLeft(until: string | Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(until).getTime() - now.getTime()) / DAY));
}
