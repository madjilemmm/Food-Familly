import { describe, expect, it } from "vitest";
import { ALLERGENES_DITS, allergenesSurLaCarte, contientPhrase, foodsIn, recipeConflicts } from "./foods";

/*
 * Ce que Kaddie repère d'après la liste d'ingrédients saisie, face aux 14 allergènes à déclaration obligatoire.
 * Chaque plat dit ce qui est écrit dans sa liste (`attendu` : doit être repéré, ni plus ni moins) et, à part, ce qu'un dictionnaire
 * de mots ne peut pas savoir (`limites` : un ingrédient composé, un titre sans liste). Les limites ne sont pas des garanties :
 * elles documentent pourquoi la carte dit « d'après les ingrédients saisis » et pourquoi « rien repéré » ne veut pas dire « aucun ».
 * Les 25 premiers plats ont servi à régler le dictionnaire ; les 30 suivants (« nouveaux ») ont été écrits après, pour le vérifier.
 */
type Cas = { plat: string; lignes: string[]; attendu: string[]; limites?: string[] };

// Les clés internes (régimes) → le code de l'allergène.
const CODE: Record<string, string> = {
  sans_gluten: "gluten",
  sans_lactose: "lait",
  oeufs: "oeufs",
  arachide: "arachide",
  fruits_a_coque: "fruits_a_coque",
  poisson: "poisson",
  fruits_de_mer: "fruits_de_mer",
  soja: "soja",
  sesame: "sesame",
  celeri: "celeri",
  moutarde: "moutarde",
  sulfites: "sulfites",
  lupin: "lupin",
};

const REGLAGE: Cas[] = [
  { plat: "Pad thaï", lignes: ["Pad thaï", "Nouilles de riz", "Cacahouètes concassées", "Crevettes", "Œufs", "Nuoc-mâm", "Germes de soja"], attendu: ["arachide", "fruits_de_mer", "oeufs", "poisson", "soja"] },
  { plat: "Poulet sauce soja", lignes: ["Poulet sauce soja", "Blanc de poulet", "Sauce soja", "Miel", "Gingembre"], attendu: ["soja", "gluten"] },
  { plat: "Houmous maison", lignes: ["Houmous maison", "Pois chiches", "Tahini", "Citron", "Ail"], attendu: ["sesame"] },
  { plat: "Céleri rémoulade", lignes: ["Céleri rémoulade", "Céleri rave", "Mayonnaise", "Moutarde de Dijon"], attendu: ["celeri", "oeufs", "moutarde"] },
  { plat: "Pâtes au pesto", lignes: ["Pâtes au pesto", "Spaghetti", "Pesto", "Parmesan"], attendu: ["gluten", "lait"], limites: ["fruits_a_coque : selon le pesto (noix, cajou), non écrits dans la liste"] },
  { plat: "Gratin dauphinois", lignes: ["Gratin dauphinois", "Pommes de terre", "Crème fraîche", "Lait", "Ail", "Muscade"], attendu: ["lait"] },
  { plat: "Quiche lorraine", lignes: ["Quiche lorraine", "Pâte brisée", "Lardons", "Œufs", "Crème fraîche", "Lait", "Gruyère râpé"], attendu: ["gluten", "oeufs", "lait"] },
  { plat: "Escargots de Bourgogne", lignes: ["Escargots de Bourgogne", "Escargots", "Beurre", "Ail", "Persil", "Chapelure"], attendu: ["fruits_de_mer", "lait", "gluten"] },
  { plat: "Tartare de thon", lignes: ["Tartare de thon", "Thon frais", "Sauce soja", "Huile de sésame", "Gingembre"], attendu: ["poisson", "soja", "sesame", "gluten"] },
  { plat: "Brownie", lignes: ["Brownie", "Chocolat noir", "Beurre", "Œufs", "Sucre", "Farine", "Noix"], attendu: ["lait", "oeufs", "gluten", "fruits_a_coque"] },
  { plat: "Cookies", lignes: ["Cookies", "Pépites de chocolat", "Pâte à tartiner", "Flocons d'avoine", "Beurre", "Œuf"], attendu: ["lait", "oeufs", "gluten", "fruits_a_coque"] },
  { plat: "Poulet pané", lignes: ["Poulet pané", "Escalope de poulet", "Panko", "Œuf", "Farine"], attendu: ["gluten", "oeufs"] },
  { plat: "Tiramisu", lignes: ["Tiramisu", "Mascarpone", "Œufs", "Boudoirs", "Café", "Cacao"], attendu: ["lait", "oeufs", "gluten"] },
  { plat: "Bœuf bourguignon", lignes: ["Bœuf bourguignon", "Bœuf à braiser", "Vin rouge", "Lardons", "Carottes", "Oignons", "Champignons de Paris", "Farine", "Bouquet garni"], attendu: ["gluten", "sulfites"] },
  { plat: "Soupe de poisson", lignes: ["Soupe de poisson", "Fumet de poisson", "Rouille", "Croûtons", "Gruyère"], attendu: ["poisson", "gluten", "lait"], limites: ["oeufs : la rouille en contient souvent, le mot ne le dit pas"] },
  { plat: "Salade césar", lignes: ["Salade césar", "Poulet", "Parmesan", "Croûtons", "Sauce Worcestershire", "Anchois"], attendu: ["lait", "gluten", "poisson"] },
  { plat: "Dahl de lentilles", lignes: ["Dahl de lentilles", "Lentilles corail", "Lait de coco", "Curry", "Oignon", "Ghee"], attendu: ["lait"] },
  { plat: "Riz cantonais", lignes: ["Riz cantonais", "Riz", "Œufs", "Petits pois", "Jambon", "Sauce soja"], attendu: ["oeufs", "soja", "gluten"] },
  { plat: "Poulet rôti et pommes de terre", lignes: ["Poulet rôti et pommes de terre", "Poulet fermier", "Pommes de terre", "Ail", "Thym", "Beurre"], attendu: ["lait"] },
  { plat: "Ratatouille et riz", lignes: ["Ratatouille et riz", "Aubergines", "Courgettes", "Poivrons", "Tomates", "Oignons", "Ail", "Huile d'olive", "Riz"], attendu: [] },
  { plat: "Tarte aux pommes", lignes: ["Tarte aux pommes", "Pommes", "Pâte sablée", "Sucre", "Cannelle"], attendu: ["gluten"], limites: ["lait, oeufs : la pâte sablée en contient, le mot ne le dit pas"] },
  { plat: "Crêpes (titre seul)", lignes: ["Crêpes"], attendu: ["gluten"], limites: ["lait, oeufs : aucune liste d'ingrédients"] },
  { plat: "Paella (titre seul)", lignes: ["Paella"], attendu: [], limites: ["fruits_de_mer : aucune liste d'ingrédients"] },
  { plat: "Mousse au chocolat", lignes: ["Mousse au chocolat", "Chocolat noir", "Œufs", "Sucre"], attendu: ["oeufs"], limites: ["lait : le chocolat noir en contient parfois des traces"] },
  { plat: "Salade de fruits", lignes: ["Salade de fruits", "Oranges", "Pommes", "Banane", "Sirop de sucre"], attendu: [] },
];

const NOUVEAUX: Cas[] = [
  { plat: "Curry de crevettes", lignes: ["Curry de crevettes", "Crevettes", "Lait de coco", "Pâte de curry", "Oignon", "Riz"], attendu: ["fruits_de_mer"] },
  { plat: "Lasagnes", lignes: ["Lasagnes", "Lasagnes (pâtes)", "Viande hachée", "Sauce tomate", "Béchamel", "Mozzarella", "Parmesan"], attendu: ["gluten", "lait"] },
  { plat: "Omelette aux champignons", lignes: ["Omelette aux champignons", "Œufs", "Champignons", "Beurre", "Persil"], attendu: ["oeufs", "lait"] },
  { plat: "Salade niçoise", lignes: ["Salade niçoise", "Thon", "Œufs durs", "Anchois", "Olives", "Tomates", "Haricots verts", "Huile d'olive"], attendu: ["poisson", "oeufs"] },
  { plat: "Moules marinières", lignes: ["Moules marinières", "Moules", "Vin blanc", "Échalotes", "Crème fraîche", "Persil"], attendu: ["fruits_de_mer", "sulfites", "lait"] },
  { plat: "Tajine de poulet aux amandes", lignes: ["Tajine de poulet aux amandes", "Poulet", "Amandes effilées", "Oignons", "Citron confit", "Épices"], attendu: ["fruits_a_coque"] },
  { plat: "Pancakes", lignes: ["Pancakes", "Farine", "Lait", "Œufs", "Levure", "Sucre", "Beurre"], attendu: ["gluten", "lait", "oeufs"] },
  { plat: "Soupe miso", lignes: ["Soupe miso", "Miso", "Tofu", "Algues wakamé", "Oignon vert"], attendu: ["soja"] },
  { plat: "Salade de lentilles", lignes: ["Salade de lentilles", "Lentilles vertes", "Échalote", "Moutarde", "Vinaigre", "Huile"], attendu: ["moutarde"] },
  { plat: "Bœuf sauté aux légumes", lignes: ["Bœuf sauté aux légumes", "Bœuf", "Sauce soja", "Huile de sésame", "Brocoli", "Gingembre"], attendu: ["soja", "gluten", "sesame"] },
  { plat: "Pizza margherita", lignes: ["Pizza margherita", "Pâte à pizza", "Sauce tomate", "Mozzarella", "Basilic"], attendu: ["gluten", "lait"] },
  { plat: "Gaspacho", lignes: ["Gaspacho", "Tomates", "Concombre", "Poivron", "Ail", "Huile d'olive", "Pain", "Vinaigre"], attendu: ["gluten"] },
  { plat: "Meringues", lignes: ["Meringues", "Blancs d'œufs", "Sucre"], attendu: ["oeufs"] },
  { plat: "Houmous et crudités", lignes: ["Houmous et crudités", "Pois chiches", "Tahin", "Citron", "Ail"], attendu: ["sesame"] },
  { plat: "Spaghetti carbonara", lignes: ["Spaghetti carbonara", "Spaghetti", "Lardons", "Œufs", "Parmesan", "Poivre"], attendu: ["gluten", "oeufs", "lait"] },
  { plat: "Salade de chèvre chaud", lignes: ["Salade de chèvre chaud", "Pain", "Fromage de chèvre", "Noix", "Miel", "Salade"], attendu: ["gluten", "lait", "fruits_a_coque"] },
  { plat: "Gâteau au yaourt", lignes: ["Gâteau au yaourt", "Yaourt", "Farine", "Sucre", "Œufs", "Huile", "Levure"], attendu: ["lait", "gluten", "oeufs"] },
  { plat: "Risotto aux champignons", lignes: ["Risotto aux champignons", "Riz arborio", "Champignons", "Vin blanc", "Parmesan", "Bouillon de légumes", "Beurre"], attendu: ["sulfites", "lait"] },
  { plat: "Wok aux cacahuètes", lignes: ["Wok aux cacahuètes", "Nouilles de blé", "Cacahuètes", "Carottes", "Sauce soja", "Chou"], attendu: ["gluten", "arachide", "soja"] },
  { plat: "Soupe de céleri", lignes: ["Soupe de céleri", "Céleri-rave", "Pommes de terre", "Crème", "Bouillon"], attendu: ["celeri", "lait"] },
  { plat: "Poke bowl saumon", lignes: ["Poke bowl saumon", "Riz", "Saumon cru", "Avocat", "Edamame", "Sauce soja", "Graines de sésame", "Concombre"], attendu: ["poisson", "soja", "sesame", "gluten"] },
  { plat: "Sandwich jambon-beurre", lignes: ["Sandwich jambon-beurre", "Baguette", "Jambon", "Beurre"], attendu: ["gluten", "lait"] },
  { plat: "Taboulé", lignes: ["Taboulé", "Semoule", "Tomates", "Menthe", "Citron", "Huile"], attendu: ["gluten"] },
  { plat: "Panna cotta", lignes: ["Panna cotta", "Crème liquide", "Lait", "Sucre", "Gélatine", "Coulis de fruits rouges"], attendu: ["lait"] },
  { plat: "Pâté de campagne", lignes: ["Pâté de campagne", "Porc", "Foie de volaille", "Cognac", "Œufs", "Pistaches"], attendu: ["oeufs", "fruits_a_coque"], limites: ["sulfites : le cognac n'est pas du vin"] },
  { plat: "Ceviche", lignes: ["Ceviche", "Poisson blanc", "Citron vert", "Coriandre", "Oignon rouge"], attendu: ["poisson"] },
  { plat: "Gnocchis à la sauge", lignes: ["Gnocchis à la sauge", "Gnocchis", "Beurre", "Sauge"], attendu: ["gluten", "lait"] },
  { plat: "Tacos au poulet", lignes: ["Tacos au poulet", "Tortillas de blé", "Poulet", "Fromage râpé", "Salade"], attendu: ["gluten", "lait"] },
  { plat: "Coleslaw", lignes: ["Coleslaw", "Chou", "Carottes", "Mayonnaise", "Moutarde"], attendu: ["oeufs", "moutarde"] },
  { plat: "Riz au lait", lignes: ["Riz au lait", "Riz", "Lait", "Sucre", "Vanille"], attendu: ["lait"] },
  // Pas de fausse alerte : ce qui ressemble à un allergène sans en être un.
  { plat: "Poulet au lait de coco", lignes: ["Poulet au lait de coco", "Poulet", "Lait de coco", "Curry", "Riz"], attendu: [] },
  { plat: "Pommes de terre sautées", lignes: ["Pommes de terre sautées", "Pommes de terre", "Huile d'olive", "Sel", "Romarin"], attendu: [] },
  { plat: "Poisson au beurre noisette", lignes: ["Poisson au beurre noisette", "Cabillaud", "Noisette de beurre", "Citron"], attendu: ["poisson", "lait"] },
  { plat: "Noix de Saint-Jacques", lignes: ["Noix de Saint-Jacques", "Noix de Saint-Jacques", "Noix de muscade", "Citron"], attendu: ["fruits_de_mer"] },
  { plat: "Vinaigrette", lignes: ["Vinaigrette", "Huile", "Vinaigre de vin", "Sel", "Poivre"], attendu: ["sulfites"] },
  { plat: "Vinaigrette au citron", lignes: ["Vinaigrette au citron", "Huile d'olive", "Citron", "Sel", "Poivre"], attendu: [] },
];

const trouves = (lignes: string[]) => [...foodsIn(lignes, ALLERGENES_DITS.map((a) => a.key))].map((k) => CODE[k]).sort();

describe("allergènes repérés dans les ingrédients saisis", () => {
  for (const [titre, cas] of [["plats qui ont servi à régler le dictionnaire", REGLAGE], ["nouveaux plats", NOUVEAUX]] as const) {
    describe(titre, () => {
      for (const c of cas) {
        it(`${c.plat} : ${c.attendu.length ? c.attendu.join(", ") : "rien"}`, () => {
          expect(trouves(c.lignes)).toEqual([...c.attendu].sort());
        });
      }
    });
  }

  it("les 14 allergènes réglementaires sont tous modélisés (crustacés et mollusques ensemble : « fruits de mer »)", () => {
    expect(new Set(ALLERGENES_DITS.map((a) => CODE[a.key]))).toEqual(
      new Set(["gluten", "lait", "oeufs", "arachide", "fruits_a_coque", "poisson", "fruits_de_mer", "soja", "sesame", "celeri", "moutarde", "sulfites", "lupin"]),
    );
  });

  it("ce qu'un dictionnaire ne peut pas savoir est dit comme une limite, pas comme une garantie", () => {
    // « Pâte sablée » : le mot ne dit pas qu'il y a du beurre et des œufs. La carte n'en parle pas, et ne prétend pas qu'il n'y en a pas.
    expect(contientPhrase(["Tarte aux pommes", "Pommes", "Pâte sablée", "Sucre"])).toBe("Contient du gluten");
    // Un plat sans liste d'ingrédients : « rien repéré » serait trompeur, la carte dit que la liste manque.
    expect(allergenesSurLaCarte(["Paella"])).toBe("Ingrédients non renseignés");
    expect(allergenesSurLaCarte(["Crêpes"])).toBe("Contient du gluten · ingrédients non renseignés");
    expect(allergenesSurLaCarte(["Ratatouille", "Courgettes", "Tomates"])).toBeNull();
    expect(allergenesSurLaCarte(["Gratin", "Lait"])).toBe("Contient du lait");
  });

  it("une carte peut dire plusieurs allergènes d'une phrase", () => {
    expect(contientPhrase(["Poke bowl", "Saumon", "Edamame", "Graines de sésame", "Sauce soja"])).toBe("Contient du gluten, du poisson, du soja et du sésame");
  });
});

describe("un interdit tapé à la main (« Autre ») : orthographes, synonymes et dérivés", () => {
  const cache = (mot: string, lignes: string[]) =>
    recipeConflicts(lignes, [{ id: "m", name: "Madji", tastes: { [`autre:${mot}`]: "interdit" } }], true).familleCache;

  it("« cacahouète » et « cacahuète » : les deux orthographes, au singulier comme au pluriel", () => {
    expect(cache("cacahouète", ["Cacahuètes grillées"])).toBe(true);
    expect(cache("cacahuète", ["Cacahouètes grillées"])).toBe(true);
    expect(cache("cacahuètes", ["Beurre de cacahuète"])).toBe(true);
    expect(cache("arachide", ["Cacahouètes"])).toBe(true);
  });
  it("un allergène connu est cherché avec ses dérivés : soja → tofu, miso ; sésame → tahini ; céleri → céleri rave", () => {
    expect(cache("soja", ["Tofu ferme"])).toBe(true);
    expect(cache("soja", ["Miso"])).toBe(true);
    expect(cache("sésame", ["Tahini"])).toBe(true);
    expect(cache("céleri", ["Céleri rave"])).toBe(true);
    expect(cache("sulfites", ["Vin blanc"])).toBe(true);
    expect(cache("lupin", ["Farine de lupin"])).toBe(true);
  });
  it("un mot précis reste précis : « noisette » ne cache pas les amandes", () => {
    expect(cache("noisette", ["Amandes effilées"])).toBe(false);
    expect(cache("noisette", ["Noisettes torréfiées"])).toBe(true);
  });
  it("sans rapport : le mot libre ne cache que ce qu'il nomme", () => {
    expect(cache("kiwi", ["Salade de fruits", "Oranges", "Pommes"])).toBe(false);
    expect(cache("kiwi", ["Kiwis"])).toBe(true);
  });
  it("le lait de coco n'est pas du lait, même tapé à la main", () => {
    expect(cache("lait", ["Lait de coco", "Poulet"])).toBe(false);
    expect(cache("lait", ["Béchamel", "Pâtes"])).toBe(true);
  });
});
