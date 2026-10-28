import { describe, expect, it } from "vitest";
import { AUTRE, INGREDIENTS, cartesPour, compatibility, contientPhrase, foodsIn, nAimePas, recipeConflicts, type MemberTastes } from "./foods";

const has = (lines: string[], key: string) => foodsIn(lines, [key]).has(key);

describe("foodsIn : les cas pièges", () => {
  it("le poivre n'est pas un poivron", () => {
    expect(has(["Sel et poivre"], "poivron")).toBe(false);
    expect(has(["2 poivrons rouges"], "poivron")).toBe(true);
  });
  it("les lardons, c'est du porc (mais pas les lardons de volaille)", () => {
    expect(has(["200 g de lardons fumés"], "sans_porc")).toBe(true);
    expect(has(["Jambon blanc"], "sans_porc")).toBe(true);
    expect(has(["Chorizo"], "sans_porc")).toBe(true);
    expect(has(["200 g de lardons de volaille"], "sans_porc")).toBe(false);
  });
  it("la pâte feuilletée contient du gluten", () => {
    expect(has(["1 pâte feuilletée"], "sans_gluten")).toBe(true);
    expect(has(["Farine de riz"], "sans_gluten")).toBe(false);
  });
  it("huile d'arachide et beurre de cacahuète = arachide", () => {
    expect(has(["Huile d'arachide"], "arachide")).toBe(true);
    expect(has(["2 c. à soupe de beurre de cacahuète"], "arachide")).toBe(true);
    expect(has(["Beurre de cacahuète"], "sans_lactose")).toBe(false);
  });
  it("la crème fraîche contient du lactose, pas le lait de coco", () => {
    expect(has(["20 cl de crème fraîche"], "sans_lactose")).toBe(true);
    expect(has(["40 cl de lait de coco"], "sans_lactose")).toBe(false);
  });
  it("le magret, c'est du canard", () => {
    expect(has(["Magret de canard"], "canard")).toBe(true);
    expect(has(["2 magrets"], "canard")).toBe(true);
  });
  it("les pluriels et les accents", () => {
    expect(has(["Des Épinards frais"], "epinards")).toBe(true);
    expect(has(["3 œufs"], "oeufs")).toBe(true);
    expect(has(["Choux de Bruxelles"], "chou")).toBe(true);
  });
  it("l'huile d'olive n'est pas une olive, la noix de coco pas un fruit à coque", () => {
    expect(has(["Huile d'olive"], "olives")).toBe(false);
    expect(has(["Olives noires"], "olives")).toBe(true);
    expect(has(["Noix de coco râpée"], "fruits_a_coque")).toBe(false);
    expect(has(["Cerneaux de noix"], "fruits_a_coque")).toBe(true);
  });
  it("végétarien attrape viandes et poissons", () => {
    expect(has(["Blanc de poulet"], "vegetarien")).toBe(true);
    expect(has(["Filet de saumon"], "vegetarien")).toBe(true);
    expect(has(["Courgettes", "Pommes de terre"], "vegetarien")).toBe(false);
  });
  it("le champ « Autre »", () => {
    expect(has(["Branche de céleri"], `${AUTRE}céleri`)).toBe(true);
    expect(has(["Carottes"], `${AUTRE}céleri`)).toBe(false);
  });
});

describe("recipeConflicts", () => {
  const madji: MemberTastes = { id: "m", name: "Madji", tastes: { canard: "pas_fan", champignons: "adore" } };
  const leo: MemberTastes = { id: "l", name: "Léo", tastes: { sans_porc: "interdit" } };
  const karin: MemberTastes = { id: "k", name: "Karin", tastes: {} };
  const famille = [madji, leo, karin];

  it("interdit : caché pour tout le monde", () => {
    const c = recipeConflicts(["Quiche lorraine", "200 g de lardons"], famille, false, "k");
    expect(c.interditPar).toEqual(["Léo"]);
    expect(c.verdict).toBe("cache");
    expect(c.familleCache).toBe(true);
  });
  it("je n'aime pas : caché pour moi", () => {
    expect(recipeConflicts(["Magret de canard"], famille, false, "m").verdict).toBe("cache");
  });
  it("un autre n'aime pas : caché en mode strict, en fin de paquet sinon", () => {
    expect(recipeConflicts(["Magret de canard"], famille, true, "k").verdict).toBe("cache");
    const c = recipeConflicts(["Magret de canard"], famille, false, "k");
    expect(c.verdict).toBe("fin");
    expect(c.familleCache).toBe(false);
    expect(nAimePas(c.pasFanDe)).toBe("Madji n'aime pas");
  });
  it("j'adore : en tête de mon paquet", () => {
    expect(recipeConflicts(["Risotto", "Champignons de Paris"], famille, true, "m").verdict).toBe("tete");
    expect(recipeConflicts(["Risotto", "Champignons de Paris"], famille, true, "k").verdict).toBe("normal");
  });
});

describe("compatibility", () => {
  it("part des cartes où les deux sont du même avis", () => {
    expect(compatibility({}, {})).toBe(100);
    const n = INGREDIENTS.length;
    expect(compatibility({ canard: "pas_fan" }, { canard: "adore" })).toBe(Math.round(((n - 1) / n) * 100));
    expect(compatibility({ canard: "pas_fan" }, { canard: "pas_fan" })).toBe(100);
  });
});

describe("nAimePas", () => {
  it("accorde au pluriel", () => {
    expect(nAimePas(["Madji", "Léo"])).toBe("Madji et Léo n'aiment pas");
  });
});

describe("les cartes du questionnaire", () => {
  it("assez de cartes, et pas de doublon", () => {
    expect(INGREDIENTS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(INGREDIENTS.map((f) => f.key)).size).toBe(INGREDIENTS.length);
  });
  it("un régime coché retire les cartes qu'il couvre", () => {
    const keys = (d: string[]) => cartesPour(d).map((f) => f.key);
    expect(keys(["sans_porc"])).not.toContain("charcuterie");
    expect(keys(["sans_porc"])).toContain("poulet");
    expect(keys(["vegetarien"])).not.toContain("saumon");
    expect(keys(["vegetarien"])).toContain("lentilles");
  });
  it("les nouvelles cartes reconnaissent leurs ingrédients", () => {
    expect(foodsIn(["200 g de lardons"], ["charcuterie"]).has("charcuterie")).toBe(true);
    expect(foodsIn(["Bouillon de volaille"], ["poulet"]).has("poulet")).toBe(false);
    expect(foodsIn(["400 g de haricots verts"], ["haricots_verts"]).has("haricots_verts")).toBe(true);
    expect(foodsIn(["Haricots rouges"], ["haricots_verts"]).has("haricots_verts")).toBe(false);
    expect(foodsIn(["Tajine aux pruneaux"], ["sucre_sale"]).has("sucre_sale")).toBe(true);
  });
});

describe("ordre des cartes", () => {
  it("les plus départageantes d'abord", () => {
    const keys = cartesPour([]).map((f) => f.key);
    expect(keys[0]).toBe("champignons");
    expect(keys.indexOf("poisson")).toBeLessThan(keys.indexOf("boeuf"));
    expect(keys).toHaveLength(INGREDIENTS.length);
  });
});

describe("contientPhrase : ce que dit la carte d'un plat", () => {
  it("un seul allergène", () => {
    expect(contientPhrase(["Gratin dauphinois", "Pommes de terre", "Crème", "Lait", "Gruyère"])).toBe("Contient du lait");
  });
  it("plusieurs, dits en une phrase", () => {
    expect(contientPhrase(["Quiche lorraine", "Pâte brisée", "Lardons", "Œufs", "Crème", "Lait"])).toBe("Contient du gluten, du lait et des œufs");
  });
  it("rien de repéré : pas de phrase", () => {
    expect(contientPhrase(["Ratatouille et riz", "Aubergine", "Courgette", "Tomate", "Riz"])).toBeNull();
  });
});
