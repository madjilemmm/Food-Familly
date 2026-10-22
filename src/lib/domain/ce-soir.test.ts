import { describe, expect, it } from "vitest";
import { aRedemander, choisirCeSoir } from "./ce-soir";

const c = (id: string, o: Partial<Parameters<typeof choisirCeSoir>[0][number]> = {}) => ({ id, achete: false, joursDepuisAchat: 0, envies: 0, minutes: null, ...o });

describe("Ce soir : une seule réponse", () => {
  it("un plat déjà acheté passe avant une envie à acheter", () => {
    expect(choisirCeSoir([c("envie", { envies: 2 }), c("achete", { achete: true })], { semaine: false })[0].id).toBe("achete");
  });
  it("parmi les plats achetés : l'envie et l'ancienneté départagent", () => {
    const r = choisirCeSoir([c("a", { achete: true, joursDepuisAchat: 1 }), c("b", { achete: true, joursDepuisAchat: 5, envies: 1 })], { semaine: false });
    expect(r[0].id).toBe("b");
  });
  it("« Autre idée » : le plat écarté passe après les autres, sans disparaître", () => {
    const r = choisirCeSoir([c("a", { achete: true }), c("b")], { semaine: false, pasCeSoir: new Set(["a"]) });
    expect(r.map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("un soir de semaine, le plus rapide avance", () => {
    const r = choisirCeSoir([c("long", { achete: true, minutes: 90 }), c("rapide", { achete: true, minutes: 20 })], { semaine: true });
    expect(r[0].id).toBe("rapide");
  });
});

describe("C'était bon ? : le plat d'hier en premier", () => {
  const hier = Date.now() - 20 * 3_600_000;
  it("je l'ai mangé et je n'en ai rien dit depuis", () => {
    expect(aRedemander([{ recipeId: "r", faitLe: hier, mangeurs: null }], "moi", () => ({ liked: true, swipedAt: hier - 5e8, likedAt: hier - 5e8 }))).toBe("r");
  });
  it("pas si je ne le mangeais pas", () => {
    expect(aRedemander([{ recipeId: "r", faitLe: hier, mangeurs: ["autre"] }], "moi", () => undefined)).toBeNull();
  });
  it("pas si j'ai déjà répondu depuis", () => {
    expect(aRedemander([{ recipeId: "r", faitLe: hier, mangeurs: ["moi"] }], "moi", () => ({ liked: false, swipedAt: hier + 1000, likedAt: null }))).toBeNull();
  });
});
