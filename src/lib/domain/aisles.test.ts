import { describe, expect, it } from "vitest";
import { groupByAisle } from "./aisles";

describe("groupByAisle", () => {
  it("suit le parcours en magasin, surgelés à la fin", () => {
    const items = [
      { name: "Glace", aisle: "surgeles" },
      { name: "Pâtes", aisle: "epicerie" },
      { name: "Tomates", aisle: "fruits_legumes" },
      { name: "Mystère", aisle: "rayon-disparu" },
    ];
    expect(groupByAisle(items).map((g) => g.id)).toEqual(["fruits_legumes", "epicerie", "surgeles", "autre"]);
  });
});
