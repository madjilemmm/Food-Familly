import { describe, expect, it } from "vitest";
import { correspondAuxStyles, dureeMax, lireEnvies, pourJeunes, recherchesPour, ENVIES_VIDES } from "./envies";

describe("pourJeunes", () => {
  it("écarte les plats que des ados ne regarderaient pas", () => {
    expect(pourJeunes("Chou-fleur gratiné léger")).toBe(false);
    expect(pourJeunes("Joues de porc au curry")).toBe(false);
    expect(pourJeunes("Velouté de potimarron")).toBe(false);
    expect(pourJeunes("Gratin de courgettes minceur")).toBe(false);
  });
  it("garde les classiques", () => {
    expect(pourJeunes("Burger maison")).toBe(true);
    expect(pourJeunes("Poulet curry coco")).toBe(true);
    expect(pourJeunes("Lasagnes à la bolognaise")).toBe(true);
    expect(pourJeunes("Pâtes à la carbonara")).toBe(true);
  });
});

describe("styles, temps et recherches", () => {
  it("reconnaît un style dans le titre", () => {
    expect(correspondAuxStyles(["Tacos au poulet"], ["mexicain"])).toBe(true);
    expect(correspondAuxStyles(["Spaghetti bolognaise"], ["pates"])).toBe(true);
    expect(correspondAuxStyles(["Spaghetti bolognaise"], ["asiatique"])).toBe(false);
  });
  it("la personne la plus pressée l'emporte", () => {
    expect(dureeMax([ENVIES_VIDES])).toBe(150);
    expect(dureeMax([ENVIES_VIDES, { ...ENVIES_VIDES, temps: "30" }])).toBe(45);
  });
  it("cherche d'abord les styles aimés", () => {
    const r = recherchesPour([{ ...ENVIES_VIDES, styles: ["mexicain"] }]);
    expect(r[0]).toBe("tacos");
    expect(r).toContain("burger maison");
    expect(new Set(r).size).toBe(r.length);
  });
  it("tolère des données incomplètes", () => {
    expect(lireEnvies(null)).toEqual(ENVIES_VIDES);
    expect(lireEnvies({ styles: ["pates", "inconnu"], temps: "30" })).toEqual({ styles: ["pates"], temps: "30", piquant: "un_peu" });
  });
});
