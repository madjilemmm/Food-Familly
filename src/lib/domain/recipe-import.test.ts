import { describe, expect, it } from "vitest";
import { cleanTitle, extractRecipe, guessAisle, parseIngredientLine } from "./recipe-import";

const p = (s: string) => parseIngredientLine(s);

describe("parseIngredientLine", () => {
  it("lit les formats Marmiton (« 25 cl de vin blanc »)", () => {
    expect(p("25 cl de vin blanc")).toEqual({ name: "Vin blanc", quantity: 25, unit: "cl", aisle: "boissons" });
    expect(p("1 kg de blanquette de veau")).toMatchObject({ name: "Blanquette de veau", quantity: 1, unit: "kg", aisle: "boucherie" });
    expect(p("2 carottes")).toEqual({ name: "Carottes", quantity: 2, unit: "", aisle: "fruits_legumes" });
    expect(p("1 jaune d'oeuf")).toMatchObject({ quantity: 1, aisle: "cremerie" });
    expect(p("1 petite boîte de champignon (coupés)")).toEqual({ name: "Champignon", quantity: 1, unit: "boîte", aisle: "fruits_legumes" });
  });

  it("lit les formats 750g (« 300g de chair à saucisse »)", () => {
    expect(p("300g de chair à saucisse")).toEqual({ name: "Chair à saucisse", quantity: 300, unit: "g", aisle: "boucherie" });
    expect(p("2 œufs")).toMatchObject({ name: "Œufs", quantity: 2, aisle: "cremerie" });
    expect(p("Persil haché ou cerfeuil (facultatif)")).toMatchObject({ name: "Persil haché ou cerfeuil", quantity: null, aisle: "fruits_legumes" });
  });

  it("lit les formats Cuisine AZ (« 500 g Tomate(s) »)", () => {
    expect(p("500 g Tomate(s)")).toEqual({ name: "Tomate", quantity: 500, unit: "g", aisle: "fruits_legumes" });
    expect(p("1 bouquet(s) Basilic")).toEqual({ name: "Basilic", quantity: 1, unit: "bouquet", aisle: "fruits_legumes" });
    expect(p("50 g Pignon(s) de pin")).toMatchObject({ name: "Pignon de pin", unit: "g", aisle: "epicerie" });
  });

  it("gère fractions, décimales et cuillères", () => {
    expect(p("½ citron")).toMatchObject({ name: "Citron", quantity: 0.5 });
    expect(p("1/2 l de lait")).toMatchObject({ name: "Lait", quantity: 0.5, unit: "l" });
    expect(p("1,5 kg de pommes de terre")).toMatchObject({ quantity: 1.5, unit: "kg", aisle: "fruits_legumes" });
    expect(p("2 cuillères à soupe d'huile d'olive")).toMatchObject({ name: "Huile d'olive", quantity: 2, unit: "c. à soupe", aisle: "epicerie" });
    expect(p("1 c. à café de sel")).toMatchObject({ name: "Sel", unit: "c. à café" });
    expect(p("3 gousses d'ail")).toMatchObject({ name: "Ail", quantity: 3, unit: "gousses" });
  });

  it("garde les ingrédients sans quantité et ignore les titres de section", () => {
    expect(p("Sel")).toEqual({ name: "Sel", quantity: null, unit: "", aisle: "epicerie" });
    expect(p("Préparation")).toBeNull();
    expect(p("   ")).toBeNull();
  });
});

describe("guessAisle", () => {
  it("ne confond pas les mots proches", () => {
    expect(guessAisle("Vinaigre balsamique")).toBe("epicerie");
    expect(guessAisle("Oignon jaune")).toBe("fruits_legumes");
    expect(guessAisle("Lait de coco")).toBe("epicerie");
    expect(guessAisle("Épinards")).toBe("fruits_legumes");
    expect(guessAisle("Pâte feuilletée")).toBe("cremerie");
    expect(guessAisle("Pâtes")).toBe("epicerie");
    expect(guessAisle("Truc bizarre")).toBe("autre");
  });
});

describe("cleanTitle", () => {
  it("retire les mentions publicitaires", () => {
    expect(cleanTitle("Blanquette de veau : recette traditionnelle : la meilleure recette")).toBe("Blanquette de veau");
    expect(cleanTitle("Recette de gratin dauphinois")).toBe("Gratin dauphinois");
    expect(cleanTitle("Tomato fondant ")).toBe("Tomato fondant");
  });
});

describe("extractRecipe", () => {
  const page = (jsonld: unknown, head = "") =>
    `<html><head>${head}<script type="application/ld+json">${JSON.stringify(jsonld)}</script></head></html>`;

  it("lit une recette schema.org (format Marmiton)", () => {
    const r = extractRecipe(
      page({
        "@context": "http://schema.org",
        "@type": "Recipe",
        name: "Hachis parmentier : la meilleure recette",
        image: ["https://assets.afcdn.com/recipe/1/x_w1024h1024.jpg", "https://assets.afcdn.com/recipe/1/x_w300h300.jpg"],
        recipeYield: "4 personnes",
        recipeIngredient: ["600 g de b&oelig;uf haché", "1 kg de pommes de terre", "sel"],
      }),
    );
    expect(r).toMatchObject({ title: "Hachis parmentier", imageUrl: "https://assets.afcdn.com/recipe/1/x_w1024h1024.jpg", servings: "4 personnes" });
    expect(r!.ingredients.map((i) => i.name)).toEqual(["Bœuf haché", "Pommes de terre", "Sel"]);
  });

  it("trouve la recette dans un @graph et une image ImageObject (format 750g)", () => {
    const r = extractRecipe(
      page({ "@graph": [{ "@type": "WebPage" }, { "@type": ["Recipe"], name: "Croquettes", image: { "@type": "ImageObject", url: "https://static.750g.com/a.jpg" }, recipeYield: 5, recipeIngredient: ["2 œufs"] }] }),
    );
    expect(r).toMatchObject({ title: "Croquettes", imageUrl: "https://static.750g.com/a.jpg", servings: "5 personnes" });
  });

  it("ignore les images par défaut (format Cuisine AZ)", () => {
    const r = extractRecipe(
      page({ "@type": "Recipe", name: "Tomato", image: ["https://img.cuisineaz.com/400x300/default/default.jpg", "https://img.cuisineaz.com/660x495/2020/01/01/i1.jpg"], recipeIngredient: [] }),
    );
    expect(r!.imageUrl).toBe("https://img.cuisineaz.com/660x495/2020/01/01/i1.jpg");
  });

  it("se rabat sur les balises Open Graph sans données de recette", () => {
    const r = extractRecipe(`<html><head><meta property="og:title" content="Mon plat" /><meta property="og:image" content="https://x.fr/p.jpg" /></head></html>`);
    expect(r).toEqual({ title: "Mon plat", imageUrl: "https://x.fr/p.jpg", servings: null, ingredients: [] });
  });

  it("renvoie null pour une page sans rien d'exploitable", () => {
    expect(extractRecipe("<html></html>")).toBeNull();
  });
});
