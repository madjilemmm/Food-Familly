import { describe, expect, it } from "vitest";
import { termesDeRecherche, tropProche } from "./recherche";

describe("recherches de nouvelles recettes", () => {
  it("d'abord des plats voisins des matchs, puis les styles aimés, la saison, les envies", () => {
    const t = termesDeRecherche({ envies: [], stylesAimes: ["mexicain"], matchs: ["Tacos au poulet"], mois: 0 });
    expect(t[0]).toBe("taco au poulet");
    expect(t).toContain("raclette");
    expect(t.length).toBeGreaterThan(4);
  });
  it("écarte les quasi-doublons, pas les plats différents", () => {
    expect(tropProche("Gratin dauphinois facile", ["Gratin dauphinois"])).toBe(true);
    expect(tropProche("Gratin de pâtes", ["Gratin dauphinois"])).toBe(false);
    expect(tropProche("Tacos au poulet", ["Lasagnes"])).toBe(false);
  });
});
