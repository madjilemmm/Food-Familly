import { describe, expect, it } from "vitest";
import { formatQuantity, itemKey, mergeIngredients, normalizeName } from "./shopping-list";
import { groupByAisle } from "./aisles";

describe("normalizeName", () => {
  it("ignore casse, accents et pluriels", () => {
    expect(normalizeName("Oignons")).toBe(normalizeName("oignon"));
    expect(normalizeName("Œufs")).toBe("oeuf");
    expect(normalizeName("  Crème   fraîche ")).toBe("creme fraiche");
    expect(normalizeName("Riz")).toBe("riz");
  });
});

describe("mergeIngredients", () => {
  it("fusionne les doublons et additionne les quantités", () => {
    const merged = mergeIngredients([
      { recipeTitle: "Blanquette", ingredients: [
        { name: "Oignon", quantity: 1, unit: "", aisle: "fruits_legumes" },
        { name: "Riz", quantity: 400, unit: "g", aisle: "epicerie" },
      ] },
      { recipeTitle: "Ratatouille", ingredients: [
        { name: "Oignons", quantity: 2, unit: "", aisle: "fruits_legumes" },
        { name: "riz", quantity: 400, unit: "g", aisle: "epicerie" },
      ] },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ name: "Oignon", quantity: 3, unit: "", forRecipes: ["Blanquette", "Ratatouille"] });
    expect(merged[1]).toMatchObject({ name: "Riz", quantity: 800, unit: "g" });
  });

  it("convertit g/kg et cl/l", () => {
    const merged = mergeIngredients([
      { recipeTitle: "A", ingredients: [
        { name: "Pommes de terre", quantity: 1.2, unit: "kg", aisle: "fruits_legumes" },
        { name: "Lait", quantity: 20, unit: "cl", aisle: "cremerie" },
      ] },
      { recipeTitle: "B", ingredients: [
        { name: "Pommes de terre", quantity: 800, unit: "g", aisle: "fruits_legumes" },
        { name: "Lait", quantity: 1, unit: "l", aisle: "cremerie" },
      ] },
    ]);
    expect(merged.find((m) => m.name === "Pommes de terre")).toMatchObject({ quantity: 2, unit: "kg" });
    expect(merged.find((m) => m.name === "Lait")).toMatchObject({ quantity: 1.2, unit: "l" });
  });

  it("garde séparées des unités incompatibles", () => {
    const merged = mergeIngredients([
      { recipeTitle: "A", ingredients: [
        { name: "Ail", quantity: 2, unit: "gousses", aisle: "fruits_legumes" },
        { name: "Ail", quantity: 1, unit: "tête", aisle: "fruits_legumes" },
        { name: "Ail", quantity: 1, unit: "gousse", aisle: "fruits_legumes" },
      ] },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ quantity: 3, unit: "gousses" });
  });

  it("gère les ingrédients sans quantité", () => {
    const merged = mergeIngredients([
      { recipeTitle: "A", ingredients: [{ name: "Sel", quantity: null, unit: "", aisle: "epicerie" }] },
      { recipeTitle: "B", ingredients: [{ name: "sel", quantity: null, unit: "", aisle: "epicerie" }] },
    ]);
    expect(merged).toEqual([expect.objectContaining({ name: "Sel", quantity: null, forRecipes: ["A", "B"] })]);
  });

  it("range un rayon inconnu dans « autre »", () => {
    const [item] = mergeIngredients([{ recipeTitle: "A", ingredients: [{ name: "X", quantity: 1, unit: "", aisle: "lune" }] }]);
    expect(item.aisle).toBe("autre");
  });

  it("produit la même clé que itemKey", () => {
    const [item] = mergeIngredients([{ recipeTitle: "A", ingredients: [{ name: "Lait", quantity: 1, unit: "l", aisle: "cremerie" }] }]);
    expect(itemKey("lait", "cl")).toBe(item.key);
  });
});

describe("formatQuantity", () => {
  it("formate à la française", () => {
    expect(formatQuantity(1.5, "kg")).toBe("1,5 kg");
    expect(formatQuantity(3, "")).toBe("3");
    expect(formatQuantity(null, "")).toBe("");
  });
});

describe("groupByAisle", () => {
  it("regroupe dans l'ordre du magasin", () => {
    const groups = groupByAisle([
      { name: "Riz", aisle: "epicerie" },
      { name: "Carotte", aisle: "fruits_legumes" },
      { name: "Truc", aisle: "inconnu" },
    ]);
    expect(groups.map((g) => g.id)).toEqual(["fruits_legumes", "epicerie", "autre"]);
  });
});

describe("quantités selon le nombre de personnes", () => {
  it("ajuste et arrondit comme sur une liste", async () => {
    const { scaleQuantity, scaleIngredients } = await import("./shopping-list");
    expect(scaleQuantity(500, "g", 0.5)).toBe(250);
    expect(scaleQuantity(4, "", 3 / 8)).toBe(2); // 4 œufs pour 8 → 1,5 → 2 œufs pour 3
    expect(scaleQuantity(1, "", 0.25)).toBe(1); // jamais moins d'un œuf
    expect(scaleQuantity(1, "pincée", 3)).toBe(1);
    expect(scaleQuantity(3, "c. à soupe", 0.5)).toBe(1.5);
    expect(scaleQuantity(20, "cl", 0.5)).toBe(10);
    expect(scaleQuantity(1.5, "kg", 0.5)).toBe(0.75);
    expect(scaleQuantity(null, "", 2)).toBeNull();
    expect(scaleIngredients([{ name: "Pâtes", quantity: 600, unit: "g" }], 6, 3)[0].quantity).toBe(300);
    expect(scaleIngredients([{ name: "Pâtes", quantity: 600, unit: "g" }], null, 3)[0].quantity).toBe(600);
  });
});
