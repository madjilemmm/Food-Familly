import { describe, expect, it } from "vitest";
import { etatDeLaSource, prochainEssai, termesAEviter } from "./import-etat";

const T = Date.parse("2026-11-01T12:00:00Z");
const MIN = 60_000;
describe("quand retenter un import", () => {
  it("un import qui ne trouve rien attend de plus en plus longtemps, 6 h au plus", () => {
    const delais = [1, 2, 3, 4, 5, 9].map((n) => (prochainEssai("rien", n, T) - T) / MIN);
    expect(delais).toEqual([3, 10, 30, 120, 360, 360]);
  });
  it("une panne de la source se retente vite, puis de moins en moins", () => {
    expect([1, 2, 3, 8].map((n) => (prochainEssai("erreur", n, T) - T) / MIN)).toEqual([1, 5, 15, 15]);
  });
  it("après un succès, un court répit seulement", () => expect(prochainEssai("ajoutees", 0, T) - T).toBe(10_000));
});

describe("l'état à annoncer", () => {
  it("rien d'enregistré : tout va bien", () => expect(etatDeLaSource(null)).toBe("ok"));
  it("un import en cours : on cherche", () => expect(etatDeLaSource({ verrouJusqua: T + 30_000, essaisVides: 0, dernierResultat: null, maintenant: T })).toBe("en_cours"));
  it("deux essais vides de suite : l'offre est épuisée pour l'instant", () => expect(etatDeLaSource({ verrouJusqua: null, essaisVides: 2, dernierResultat: "rien", maintenant: T })).toBe("epuisee"));
  it("un seul essai vide : pas encore de conclusion", () => expect(etatDeLaSource({ verrouJusqua: null, essaisVides: 1, dernierResultat: "rien", maintenant: T })).toBe("ok"));
  it("la source a échoué : indisponible", () => expect(etatDeLaSource({ verrouJusqua: null, essaisVides: 0, dernierResultat: "erreur", maintenant: T })).toBe("indisponible"));
  it("un verrou périmé n'est plus un import en cours", () => expect(etatDeLaSource({ verrouJusqua: T - 1, essaisVides: 0, dernierResultat: "ajoutees", maintenant: T })).toBe("ok"));
});

describe("mémoire des recherches vides", () => {
  it("n'évite que les recherches vides récentes", () => {
    const vides = { tacos: new Date(T - 3600_000).toISOString(), pizza: new Date(T - 4 * 86_400_000).toISOString() };
    expect([...termesAEviter(vides, T)]).toEqual(["tacos"]);
  });
});
