import { describe, expect, it } from "vitest";
import { cleMaison, passagesDesIngredients, sansDouteALaMaison } from "./maison";

const course = (...items: [string, string, boolean][]) => ({ items: items.map(([name, source, checked]) => ({ name, source, checked })) });

describe("sans doute déjà à la maison", () => {
  it("retiré à 2 des 3 dernières courses → sans doute à la maison", () => {
    const passages = passagesDesIngredients([
      course(["Sel", "maison", false], ["Lardons", "recipe", true]),
      course(["Lardons", "recipe", true]),
      course(["Sel", "maison", false]),
    ]);
    expect(sansDouteALaMaison(passages)).toEqual(new Set([cleMaison("Sel")]));
  });
  it("une seule fois retiré : on ne suppose rien", () => {
    expect(sansDouteALaMaison(passagesDesIngredients([course(["Sel", "maison", false]), course(["Sel", "recipe", true])])).size).toBe(0);
  });
  it("acheté à la dernière course où il est apparu : la supposition tombe", () => {
    const passages = passagesDesIngredients([
      course(["Sel", "recipe", true]),
      course(["Sel", "maison", false]),
      course(["Sel", "maison", false]),
    ]);
    expect(sansDouteALaMaison(passages).size).toBe(0);
  });
  it("racheté à la main (le sel était fini) compte aussi comme acheté", () => {
    const passages = passagesDesIngredients([course(["sel", "manual", true]), course(["Sel", "maison", false]), course(["Sel", "maison", false])]);
    expect(sansDouteALaMaison(passages).size).toBe(0);
  });
  it("seules les 3 dernières courses où il apparaît comptent", () => {
    const passages = passagesDesIngredients([
      course(["Huile", "recipe", false]),
      course(["Huile", "recipe", false]),
      course(["Huile", "maison", false]),
      course(["Huile", "maison", false]),
    ]);
    expect(sansDouteALaMaison(passages).size).toBe(0);
  });
  it("un article ajouté à la main et pas acheté ne compte pas ; liste vide", () => {
    expect(passagesDesIngredients([course(["Piles", "manual", false])]).size).toBe(0);
    expect(sansDouteALaMaison(new Map()).size).toBe(0);
  });
});
