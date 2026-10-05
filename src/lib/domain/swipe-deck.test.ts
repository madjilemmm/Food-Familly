import { describe, expect, it } from "vitest";
import { buildDeck, daysLeft } from "./swipe-deck";

const now = new Date("2026-10-05T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
const recipes = [
  { id: "a", created_at: "2026-01-01" },
  { id: "b", created_at: "2026-02-01" },
  { id: "c", created_at: "2026-03-01" },
  { id: "d", created_at: "2026-04-01" },
];

describe("buildDeck", () => {
  it("exclut les recettes swipées il y a moins de 14 jours", () => {
    const deck = buildDeck(recipes, [{ recipe_id: "a", swiped_at: daysAgo(2) }], now);
    expect(deck.map((r) => r.id)).toEqual(["d", "c", "b"]);
  });

  it("remet dans le paquet les recettes swipées il y a 14 jours ou plus, après les nouvelles", () => {
    const deck = buildDeck(
      recipes,
      [
        { recipe_id: "a", swiped_at: daysAgo(14) },
        { recipe_id: "b", swiped_at: daysAgo(20) },
        { recipe_id: "c", swiped_at: daysAgo(13) },
      ],
      now,
    );
    expect(deck.map((r) => r.id)).toEqual(["d", "b", "a"]);
  });

  it("calcule les jours restants", () => {
    expect(daysLeft(new Date(now.getTime() + 1.5 * 86400000), now)).toBe(2);
    expect(daysLeft(daysAgo(1), now)).toBe(0);
  });
});
