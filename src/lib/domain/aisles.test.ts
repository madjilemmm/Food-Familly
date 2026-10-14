import { describe, expect, it } from "vitest";
import { AISLE_IDS, groupByAisle, normalizeAisleOrder } from "./aisles";

describe("normalizeAisleOrder", () => {
  it("garde l'ordre enregistré et complète avec les rayons manquants", () => {
    const order = normalizeAisleOrder(["epicerie", "fruits_legumes", "inconnu", "epicerie"]);
    expect(order.slice(0, 2)).toEqual(["epicerie", "fruits_legumes"]);
    expect(order).toHaveLength(AISLE_IDS.length);
    expect(new Set(order).size).toBe(AISLE_IDS.length);
  });

  it("revient à l'ordre classique sans rien d'exploitable", () => {
    expect(normalizeAisleOrder(null)).toEqual(AISLE_IDS);
    expect(normalizeAisleOrder("n'importe quoi")).toEqual(AISLE_IDS);
  });
});

describe("groupByAisle", () => {
  const items = [
    { name: "Pâtes", aisle: "epicerie" },
    { name: "Tomates", aisle: "fruits_legumes" },
    { name: "Mystère", aisle: "rayon-disparu" },
  ];

  it("suit l'ordre du magasin", () => {
    expect(groupByAisle(items, ["epicerie"]).map((g) => g.id)).toEqual(["epicerie", "fruits_legumes", "autre"]);
    expect(groupByAisle(items).map((g) => g.id)).toEqual(["fruits_legumes", "epicerie", "autre"]);
  });
});
