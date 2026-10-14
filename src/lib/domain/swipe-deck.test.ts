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

describe("buildDeck et les goûts", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  const r = (id: string, created_at: string) => ({ id, created_at });
  const recipes = [r("a", "2026-10-01"), r("b", "2026-10-02"), r("c", "2026-10-03"), r("d", "2026-10-04")];
  const rank = (x: { id: string }) => ({ a: "tete", b: "cache", c: "fin", d: "normal" })[x.id] as "tete" | "cache" | "fin" | "normal";

  it("j'adore en tête, caché retiré, « n'aime pas » à la fin", () => {
    expect(buildDeck(recipes, [], now, rank).map((x) => x.id)).toEqual(["a", "d", "c"]);
  });
});
