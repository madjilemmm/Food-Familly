import { describe, expect, it } from "vitest";
import { listeDeNoms, nomDeFamille, phraseEnvie } from "./convives";

describe("listeDeNoms", () => {
  it("liste les prénoms, « Toi » en premier", () => {
    expect(listeDeNoms(["Madji", "Yoalem", "Karin"])).toBe("Madji, Yoalem et Karin");
    expect(listeDeNoms(["Madji", "Karin"], "Karin")).toBe("Toi et Madji");
    expect(listeDeNoms([])).toBe("");
  });
});

describe("phraseEnvie", () => {
  it("jamais « envie de toi » : une phrase qui dit qui en a envie", () => {
    expect(phraseEnvie(["Madji"], "Madji")).toBe("Tu en as envie");
    expect(phraseEnvie(["Madji", "Karin"], "Madji")).toBe("Karin et toi en avez envie");
    expect(phraseEnvie(["Karin", "Léo", "Madji"], "Madji")).toBe("Karin, Léo et toi en avez envie");
    expect(phraseEnvie(["Karin"], "Madji")).toBe("Karin en a envie");
    expect(phraseEnvie(["Karin", "Léo"], "Madji")).toBe("Karin et Léo en ont envie");
    expect(phraseEnvie([], "Madji")).toBe("");
  });
});

describe("nomDeFamille", () => {
  it("élide devant une voyelle ou un h", () => {
    expect(nomDeFamille("Madji")).toBe("Famille de Madji");
    expect(nomDeFamille("Anne")).toBe("Famille d'Anne");
    expect(nomDeFamille("Élodie")).toBe("Famille d'Élodie");
    expect(nomDeFamille("Hugo")).toBe("Famille d'Hugo");
    expect(nomDeFamille("yasmine")).toBe("Famille d'yasmine");
  });
});
