import { describe, expect, it } from "vitest";
import { listeDeNoms } from "./convives";

describe("listeDeNoms", () => {
  it("liste les prénoms, « Toi » en premier", () => {
    expect(listeDeNoms(["Madji", "Yoalem", "Karin"])).toBe("Madji, Yoalem et Karin");
    expect(listeDeNoms(["Madji", "Karin"], "Karin")).toBe("Toi et Madji");
    expect(listeDeNoms([])).toBe("");
  });
});
