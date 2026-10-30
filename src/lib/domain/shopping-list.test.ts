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
    // Sans nombre de personnes écrit sur la recette, elle est lue pour 4 (le formulaire le propose) : 600 g pour 3 → 450 g.
    expect(scaleIngredients([{ name: "Pâtes", quantity: 600, unit: "g" }], null, 3)[0].quantity).toBe(450);
    expect(scaleIngredients([{ name: "Pâtes", quantity: 500, unit: "g" }], null, 8)[0].quantity).toBe(1000);
  });
});

describe("la liste additionne avant d'arrondir", () => {
  it("un quart d'oignon dans trois plats : un oignon, pas trois", async () => {
    const { mergeIngredients, scaleIngredients } = await import("./shopping-list");
    const plat = (titre: string, quantite: number) => ({ recipeTitle: titre, ingredients: scaleIngredients([{ name: "Oignon", quantity: quantite, unit: "", aisle: "fruits_legumes" }], 4, 1, true) });
    // 1 + 1 + 2 oignons pour 4 → pour 1 personne : 0,25 + 0,25 + 0,5 = 1 oignon (arrondi chaque fois à 1, on en achetait 3).
    const [oignon] = mergeIngredients([plat("A", 1), plat("B", 1), plat("C", 2)], { arrondir: true });
    expect(oignon.quantity).toBe(1);
    expect(oignon.forRecipes).toEqual(["A", "B", "C"]);
    // 3 oignons pour 4, et 3 de plus, pour 1 personne : 0,75 + 0,75 = 1,5 → 2.
    const [deux] = mergeIngredients([plat("A", 3), plat("B", 3)], { arrondir: true });
    expect(deux.quantity).toBe(2);
  });
  it("sans « arrondir », la somme reste exacte", async () => {
    const { mergeIngredients } = await import("./shopping-list");
    const [oignon] = mergeIngredients([{ recipeTitle: "A", ingredients: [{ name: "Oignon", quantity: 0.25, unit: "", aisle: "autre" }] }, { recipeTitle: "B", ingredients: [{ name: "Oignon", quantity: 0.5, unit: "", aisle: "autre" }] }]);
    expect(oignon.quantity).toBe(0.75);
  });
  it("une tête d'ail ne se coupe pas en 0,3", async () => {
    const { scaleQuantity } = await import("./shopping-list");
    expect(scaleQuantity(1, "tête", 0.25)).toBe(1);
    expect(scaleQuantity(1, "bouquet", 0.25)).toBe(1);
    expect(scaleQuantity(1, "bouquet", 1.5)).toBe(2);
  });
});

describe("les unités s'accordent avec la quantité", () => {
  it("1 gousse, 2 gousses, 2 boîtes, 1,5 kg", async () => {
    const { formatQuantity } = await import("./shopping-list");
    expect(formatQuantity(1, "gousses")).toBe("1 gousse");
    expect(formatQuantity(2, "gousse")).toBe("2 gousses");
    expect(formatQuantity(2, "boîte")).toBe("2 boîtes");
    expect(formatQuantity(1, "boîte")).toBe("1 boîte");
    expect(formatQuantity(0.5, "tête")).toBe("0,5 tête");
    expect(formatQuantity(3, "rouleau")).toBe("3 rouleaux");
    expect(formatQuantity(1.5, "kg")).toBe("1,5 kg");
    expect(formatQuantity(2, "c. à soupe")).toBe("2 c. à soupe");
    expect(formatQuantity(3, "")).toBe("3");
    expect(formatQuantity(null, "pincée")).toBe("pincée");
  });
});

describe("les titres de recettes d'un article, même avec une virgule", () => {
  it("coupe aux virgules quand les titres n'en contiennent pas", async () => {
    const { titresPourLesquels } = await import("./shopping-list");
    expect(titresPourLesquels("Blanquette de veau, Hachis parmentier")).toEqual(["Blanquette de veau", "Hachis parmentier"]);
    expect(titresPourLesquels(null)).toEqual([]);
    expect(titresPourLesquels("")).toEqual([]);
  });
  it("lit un titre qui contient une virgule avec les titres connus", async () => {
    const { estPourLaRecette, titresPourLesquels } = await import("./shopping-list");
    const connus = ["Gratin dauphinois, version crème", "Blanquette de veau"];
    expect(titresPourLesquels("Gratin dauphinois, version crème, Blanquette de veau", connus)).toEqual(connus);
    expect(estPourLaRecette("Gratin dauphinois, version crème", "Gratin dauphinois, version crème")).toBe(true);
    expect(estPourLaRecette("Gratin dauphinois, version crème", "Blanquette de veau", connus)).toBe(false);
  });
  it("ne confond pas un titre avec le début d'un autre", async () => {
    const { estPourLaRecette } = await import("./shopping-list");
    const connus = ["Gratin dauphinois", "Gratin dauphinois, version crème"];
    expect(estPourLaRecette("Gratin dauphinois, version crème", "Gratin dauphinois", connus)).toBe(false);
    expect(estPourLaRecette("Gratin dauphinois, version crème", "Gratin dauphinois, version crème", connus)).toBe(true);
    expect(estPourLaRecette("Gratin dauphinois, Gratin dauphinois, version crème", "Gratin dauphinois", connus)).toBe(true);
  });
  it("un titre renommé ou supprimé depuis est lu jusqu'à la virgule suivante", async () => {
    const { titresPourLesquels } = await import("./shopping-list");
    expect(titresPourLesquels("Ancien nom, Blanquette de veau", ["Blanquette de veau"])).toEqual(["Ancien nom", "Blanquette de veau"]);
  });
});
