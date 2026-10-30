import { describe, expect, it } from "vitest";
import { choisirDansLeCatalogue, creditDeLaRecette, motifsDeRefus, proteineDe, type CandidatCatalogue, type RecetteCatalogue } from "./catalogue-commun";

const bonne: RecetteCatalogue = {
  source: "themealdb",
  sourceId: "1",
  titre: "Poulet rôti aux herbes",
  photoUrl: "https://www.themealdb.com/images/media/meals/a.jpg",
  photoAuteur: null,
  photoLicence: "API-AUTORISEE",
  texteLicence: "API-AUTORISEE",
  attributionUrl: "https://www.themealdb.com/meal/1",
  attributionTexte: "Recette : TheMealDB",
  minutes: 60,
  portions: 4,
  etapes: ["Préchauffer le four à 200 °C.", "Enfourner le poulet une heure."],
  ingredients: ["1 poulet", "2 gousses d'ail", "thym"],
  cuisine: null,
  langue: "fr",
};

describe("admission au catalogue commun", () => {
  it("admet une recette complète", () => expect(motifsDeRefus(bonne)).toEqual([]));
  it("refuse sans photo ou avec une photo qui n'est pas en https", () => {
    expect(motifsDeRefus({ ...bonne, photoUrl: "" })).toContain("photo absente ou pas en https");
    expect(motifsDeRefus({ ...bonne, photoUrl: "http://exemple.fr/a.jpg" })).toContain("photo absente ou pas en https");
  });
  it("refuse la photo d'un site dont on n'a pas les droits", () => {
    expect(motifsDeRefus({ ...bonne, photoUrl: "https://assets.afcdn.com/recipe/a.jpg" })).toContain("photo d'un site sans autorisation");
    expect(motifsDeRefus({ ...bonne, photoUrl: "https://img.marmiton.org/a.jpg" })).toContain("photo d'un site sans autorisation");
  });
  it("refuse une recette sans ingrédients ou sans étapes", () => {
    expect(motifsDeRefus({ ...bonne, ingredients: ["poulet", "sel"] })).toContain("moins de 3 ingrédients");
    expect(motifsDeRefus({ ...bonne, etapes: ["Cuire le poulet longtemps."] })).toContain("moins de 2 étapes");
  });
  it("refuse une licence inconnue et une origine non indiquée", () => {
    expect(motifsDeRefus({ ...bonne, photoLicence: "tous droits réservés" })).toContain("licence de la photo inconnue");
    expect(motifsDeRefus({ ...bonne, texteLicence: "?" })).toContain("licence du texte inconnue");
    expect(motifsDeRefus({ ...bonne, attributionTexte: "" })).toContain("origine non indiquée");
  });
  it("refuse ce qui n'est pas en français", () => expect(motifsDeRefus({ ...bonne, langue: "en" })).toContain("pas en français"));
  it("le crédit cite l'auteur de la photo quand la licence l'exige", () => {
    expect(creditDeLaRecette({ attributionTexte: "Recette : Wikilivres (CC BY-SA)", photoAuteur: "Jeanne D.", photoLicence: "CC-BY-SA" })).toBe("Recette : Wikilivres (CC BY-SA). Photo : Jeanne D. (CC-BY-SA).");
    expect(creditDeLaRecette(bonne)).toBe("Recette : TheMealDB.");
  });
});

const c = (id: string, titre: string, ingredients: string[], cuisine: string | null = null): CandidatCatalogue => ({ ...bonne, id, titre, ingredients, cuisine });

describe("tirage dans le catalogue", () => {
  const catalogue = [
    c("a", "Risotto aux champignons", ["riz arborio", "champignons", "parmesan"]),
    c("b", "Risotto aux asperges", ["riz arborio", "asperges", "parmesan"]),
    c("c", "Spaghetti bolognaise", ["spaghetti", "viande hachee", "tomate"]),
    c("d", "Tacos au poulet", ["tortilla", "poulet", "avocat"]),
    c("e", "Curry de pois chiches", ["pois chiches", "lait de coco", "curry"]),
    c("f", "Burger maison", ["pain à burger", "steak haché", "cheddar"]),
    c("g", "Gratin dauphinois", ["pommes de terre", "crème", "ail"]),
    c("h", "Poulet curry coco", ["poulet", "lait de coco", "curry"]),
  ];
  const graine = (n: number) => () => ((n = (n * 1664525 + 1013904223) % 4294967296) / 4294967296);
  it("ne propose jamais un plat qui ressemble à un plat déjà là", () => {
    const r = choisirDansLeCatalogue({ candidats: catalogue, titresDeLaFamille: ["Risotto aux champignons"], stylesAimes: [], combien: 5, hasard: graine(3) });
    expect(r.map((x) => x.id)).not.toContain("a");
  });
  it("évite deux plats du même type dans un tirage (deux risottos), sans l'interdire quand il n'y a pas d'autre choix", () => {
    let ensemble = 0;
    for (let k = 1; k <= 60; k++) {
      const ids = choisirDansLeCatalogue({ candidats: catalogue, titresDeLaFamille: [], stylesAimes: [], combien: 4, hasard: graine(k) }).map((x) => x.id);
      if (ids.includes("a") && ids.includes("b")) ensemble++;
    }
    expect(ensemble).toBeLessThanOrEqual(6);
    const seuls = choisirDansLeCatalogue({ candidats: [catalogue[0], catalogue[1]], titresDeLaFamille: [], stylesAimes: [], combien: 2, hasard: graine(1) });
    expect(seuls).toHaveLength(2);
  });
  it("le tirage change d'un appel à l'autre", () => {
    const tirages = new Set(Array.from({ length: 15 }, (_, k) => choisirDansLeCatalogue({ candidats: catalogue, titresDeLaFamille: [], stylesAimes: [], combien: 4, hasard: graine(k + 7) }).map((x) => x.id).join()));
    expect(tirages.size).toBeGreaterThan(5);
  });
  it("garde au moins une découverte sur quatre hors des styles aimés", () => {
    for (let k = 1; k <= 20; k++) {
      const r = choisirDansLeCatalogue({ candidats: catalogue, titresDeLaFamille: [], stylesAimes: ["pates", "street_food"], combien: 4, hasard: graine(k) });
      const hors = r.filter((x) => !["c", "f"].includes(x.id));
      expect(hors.length).toBeGreaterThanOrEqual(1);
    }
  });
  it("reconnaît la protéine principale", () => {
    expect(proteineDe(["1 poulet", "ail"])).toBe("poulet");
    expect(proteineDe(["500 g de saumon"])).toBe("poisson");
    expect(proteineDe(["riz", "sel"])).toBeNull();
  });
});
