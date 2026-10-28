import { describe, expect, it } from "vitest";
import { classiquesDe } from "./classiques";

const r = (recipeId: string, jour: number) => ({ recipeId, faitLe: jour * 86_400_000 });

describe("Les classiques du foyer", () => {
  it("un plat cuisiné 3 fois est un classique, pas un plat cuisiné 2 fois", () => {
    const c = classiquesDe([r("tacos", 1), r("tacos", 8), r("tacos", 15), r("quiche", 2), r("quiche", 9)]);
    expect(c).toEqual([{ recipeId: "tacos", fois: 3 }]);
  });
  it("les plus cuisinés d'abord, puis les plus récents", () => {
    const c = classiquesDe([r("a", 1), r("a", 2), r("a", 3), r("b", 4), r("b", 5), r("b", 6), r("b", 7), r("c", 8), r("c", 9), r("c", 10)]);
    expect(c.map((x) => x.recipeId)).toEqual(["b", "c", "a"]);
  });
  it("rien tant que rien n'a été cuisiné", () => {
    expect(classiquesDe([])).toEqual([]);
  });
});
