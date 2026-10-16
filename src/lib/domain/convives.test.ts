import { describe, expect, it } from "vitest";
import { convivesDe, libelleConvives } from "./convives";

const base = { isMatch: false, demandePar: [], envieDuShopper: false, shopper: "Karin", famille: 4 };

describe("convivesDe", () => {
  it("un match est pour toute la famille", () => {
    expect(convivesDe({ ...base, isMatch: true, demandePar: ["Yoalem"] })).toMatchObject({ noms: "famille", n: 4 });
  });
  it("un plat demandé est pour celles et ceux qui l'ont demandé", () => {
    const c = convivesDe({ ...base, demandePar: ["Yoalem"] });
    expect(c).toMatchObject({ n: 1 });
    expect(libelleConvives(c, "Karin")).toBe("Yoalem");
  });
  it("l'envie de la personne qui fait les courses est pour elle", () => {
    expect(libelleConvives(convivesDe({ ...base, envieDuShopper: true, demandePar: ["Madji"] }), "Karin")).toBe("Toi et Madji");
  });
  it("le nombre corrigé l'emporte", () => {
    expect(convivesDe({ ...base, demandePar: ["Yoalem"], corrige: 3 })).toMatchObject({ n: 3, corrige: true });
  });
});
