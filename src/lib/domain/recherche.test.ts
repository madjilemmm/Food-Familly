import { describe, expect, it } from "vitest";
import { choisirALire, choisirTermes, recettesAOublier, termesDeRecherche, titreDepuisLien, tropProche } from "./recherche";

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

  it("les termes d'un import ne sont plus toujours les mêmes (avant : les deux termes de saison, à chaque fois)", () => {
    const e = { envies: [], stylesAimes: [], matchs: [], mois: 9 };
    // Un générateur de hasard déterministe, différent à chaque import.
    const graine = (n: number) => () => ((n = (n * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const imports = Array.from({ length: 12 }, (_, k) => choisirTermes(e, 4, graine(k + 1)));
    const premiers = new Set(imports.map((t) => t[0]));
    const tous = new Set(imports.flat());
    expect(premiers.size).toBeGreaterThan(3);
    expect(tous.size).toBeGreaterThan(14);
    expect(imports.every((t) => t.length === 4 && new Set(t).size === 4)).toBe(true);
  });
  it("les termes personnalisés restent en tête (au plus la moitié)", () => {
    const t = choisirTermes({ envies: [], stylesAimes: ["mexicain", "pates"], matchs: ["Tacos au poulet"], mois: 0 }, 4, () => 0.3);
    expect(t[0]).toBe("taco au poulet");
    expect(t.slice(0, 2).every((x) => ["taco au poulet", "tacos", "fajitas poulet", "chili con carne"].includes(x))).toBe(true);
    expect(t).toHaveLength(4);
  });
});

describe("recettes importées oubliées", () => {
  const JOUR = 86_400_000;
  const maintenant = Date.parse("2026-11-01T12:00:00Z");
  const vieille = maintenant - 40 * JOUR;
  const recente = maintenant - 3 * JOUR;
  it("une recette refusée (« Bof ») reste : sa mémoire ne s'efface jamais, même vieille de plusieurs mois", () => {
    const importees = [{ id: "refusee", creeLe: maintenant - 200 * JOUR }, { id: "aimee", creeLe: vieille }];
    expect(recettesAOublier(importees, new Set(["refusee", "aimee"]), new Set(), maintenant)).toEqual([]);
  });
  it("une recette que personne n'a swipée, vieille de plus de 4 semaines, laisse la place", () => {
    const importees = [{ id: "jamais-vue", creeLe: vieille }, { id: "recente", creeLe: recente }];
    expect(recettesAOublier(importees, new Set(), new Set(), maintenant)).toEqual(["jamais-vue"]);
  });
  it("une recette dans une course reste", () => {
    expect(recettesAOublier([{ id: "course", creeLe: vieille }], new Set(), new Set(["course"]), maintenant)).toEqual([]);
  });
});

describe("choisirALire : la file d'exploration", () => {
  const lien = (titre: string, id: number) => `https://x.test/recettes/recette_${titre.replace(/ /g, "-")}_${id}.aspx`;
  it("lit le titre dans l'adresse", () => expect(titreDepuisLien(lien("gratin dauphinois", 12))).toBe("gratin dauphinois"));
  it("écarte d'avance ce qui ressemble à un plat de la famille, sans le lire", () => {
    const r = choisirALire([lien("gratin dauphinois facile", 1), lien("risotto aux cepes", 2)], ["Gratin dauphinois"], 10, 0.6);
    expect(r.ecartees).toEqual([lien("gratin dauphinois facile", 1)]);
    expect(r.aLire).toEqual([lien("risotto aux cepes", 2)]);
  });
  it("n'en lit pas plus que le maximum, sans doublon", () => {
    const liens = Array.from({ length: 30 }, (_, i) => lien(`plat numero${i} unique${i}`, i));
    const r = choisirALire([...liens, ...liens], [], 10, 0.7);
    expect(r.aLire).toHaveLength(10);
    expect(new Set(r.aLire).size).toBe(10);
  });
  it("mélange la file : pas toujours les mêmes en premier", () => {
    const liens = Array.from({ length: 30 }, (_, i) => lien(`plat numero${i} unique${i}`, i));
    const a = choisirALire(liens, [], 5, 0.7, () => 0.1).aLire;
    const b = choisirALire(liens, [], 5, 0.7, () => 0.9).aLire;
    expect(a).not.toEqual(b);
  });
});
