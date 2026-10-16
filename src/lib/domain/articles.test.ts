import { describe, expect, it } from "vitest";
import { articlesDe, lireArticle } from "./articles";

describe("articlesDe", () => {
  it("découpe une demande en articles", () => {
    expect(articlesDe("Des pâtes carbo, des céréales et du Nutella").map((a) => a.name)).toEqual(["Pâtes carbo", "Céréales", "Nutella"]);
    expect(articlesDe("sel et poivre").map((a) => a.name)).toEqual(["Sel", "Poivre"]);
    expect(articlesDe("Lait").map((a) => a.name)).toEqual(["Lait"]);
  });
  it("lit les quantités", () => {
    expect(lireArticle("2 kg pommes")).toMatchObject({ name: "Pommes", quantity: 2, unit: "kg" });
  });
});
