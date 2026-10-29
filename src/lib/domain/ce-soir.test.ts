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
  it("un plat déjà au Menu passe avant une envie à acheter, après un plat acheté", () => {
    const r = choisirCeSoir([c("envie", { envies: 1 }), c("menu", { auMenu: true }), c("achete", { achete: true })], { semaine: false });
    expect(r.map((x) => x.id)).toEqual(["achete", "menu", "envie"]);
  });
  it("sans rien d'acheté ni d'envie, Kaddie propose le haut du paquet, dans l'ordre", () => {
    const r = choisirCeSoir([c("c", { rang: 2 }), c("a", { rang: 0 }), c("b", { rang: 1 })], { semaine: false });
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("« Autre idée » fait défiler les plats, même quand tous ont déjà été écartés", () => {
    const tous = [c("a"), c("b"), c("c")];
    // a écarté il y a longtemps, c tout à l'heure : a revient en premier, c en dernier
    const r = choisirCeSoir(tous, { semaine: false, pasCeSoir: new Map([["a", 100], ["b", 200], ["c", 300]]) });
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
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

describe("Ce soir : les plats à refaire", () => {
  it("un plat aimé et déjà mangé passe devant une idée neuve", () => {
    const r = choisirCeSoir([c("neuf", { rang: 0 }), c("refait", { rang: 5, refait: 20 })], { semaine: false });
    expect(r.map((x) => x.id)).toEqual(["refait", "neuf"]);
  });
  it("mais jamais devant une envie, même s'il n'a pas été fait depuis des mois", () => {
    const r = choisirCeSoir([c("refait", { refait: 200 }), c("envie", { envies: 1 })], { semaine: false });
    expect(r[0].id).toBe("envie");
  });
  it("ni devant un plat déjà acheté", () => {
    const r = choisirCeSoir([c("refait", { refait: 60 }), c("achete", { achete: true })], { semaine: false });
    expect(r[0].id).toBe("achete");
  });
  it("entre deux plats à refaire : celui qu'on n'a pas fait depuis le plus longtemps", () => {
    const r = choisirCeSoir([c("recent", { refait: 10 }), c("ancien", { refait: 30 })], { semaine: false });
    expect(r[0].id).toBe("ancien");
  });
  it("« Autre idée » l'écarte comme les autres", () => {
    const r = choisirCeSoir([c("refait", { refait: 20 }), c("neuf")], { semaine: false, pasCeSoir: new Set(["refait"]) });
    expect(r[0].id).toBe("neuf");
  });
});
