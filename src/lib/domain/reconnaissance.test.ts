import { describe, expect, it } from "vitest";
import { AMBIGUS, CATALOGUE } from "./catalogue";
import { cleProduit, lireSaisie, plier } from "./reconnaissance";

const lu = (t: string) => lireSaisie(t)!;

describe("catalogue", () => {
  it("chaque alias désigne un seul produit (sauf les mots ambigus déclarés)", () => {
    const vus = new Map<string, string>();
    const ambigus = new Set(Object.keys(AMBIGUS).map(plier));
    for (const p of CATALOGUE)
      for (const a of new Set([p.nom, ...p.alias].map(plier))) {
        if (vus.has(a) && vus.get(a) !== p.id) expect(ambigus.has(a), `${a} : ${vus.get(a)} / ${p.id}`).toBe(true);
        vus.set(a, p.id);
      }
  });
  it("les choix des mots ambigus existent", () => {
    const ids = new Set(CATALOGUE.map((p) => p.id));
    for (const a of Object.values(AMBIGUS)) for (const c of a.choix) expect(ids.has(c)).toBe(true);
  });
});

describe("reconnaissance", () => {
  it.each([
    ["Pims", "Pim's", "epicerie"],
    ["PQ", "Papier toilette", "hygiene"],
    ["P.Q", "Papier toilette", "hygiene"],
    ["Sopalin", "Essuie-tout", "hygiene"],
    ["pdt", "Pommes de terre", "fruits_legumes"],
    ["mozza", "Mozzarella", "cremerie"],
    ["Danette chocolat", "Danette chocolat", "cremerie"],
    ["Danette", "Danette", "cremerie"],
    ["pâté", "Pâté", "boucherie"],
    ["pates", "Pâtes", "epicerie"],
    ["7up", "7up", "boissons"],
    ["Coca", "Coca-Cola", "boissons"],
  ])("« %s » → %s (%s)", (saisie, nom, rayon) => {
    expect(lu(saisie)).toMatchObject({ nom, rayon });
  });

  it("quantités : en tête, en fin, en toutes lettres ; jamais inventées", () => {
    expect(lu("2 packs de lait")).toMatchObject({ nom: "Lait", quantite: 2, unite: "pack" });
    expect(lu("Lait 1L")).toMatchObject({ nom: "Lait", quantite: 1, unite: "l" });
    expect(lu("coca x6")).toMatchObject({ nom: "Coca-Cola", quantite: 6 });
    expect(lu("une douzaine d'œufs")).toMatchObject({ nom: "Œufs", quantite: 12 });
    expect(lu("Coca")).toMatchObject({ quantite: null, unite: "" });
  });

  it("une faute sur un mot assez long est corrigée (avec Annuler), pas sur un mot court", () => {
    expect(lu("chocapik")).toMatchObject({ nom: "Chocapic", confiance: "probable", corrige: true });
    expect(lu("beure").confiance).not.toBe("probable");
  });

  it("faux amis et compléments : rien n'est fusionné à tort", () => {
    expect(lu("gomme").nom).toBe("Gomme");
    expect(lu("eau de javel").nom).toBe("Eau de Javel");
    expect(lu("beurre de cacahuète").nom).toBe("Beurre de cacahuète");
    expect(cleProduit("Danette chocolat")).not.toBe(cleProduit("Danette vanille"));
    expect(cleProduit("Pâtes")).not.toBe(cleProduit("Pâté"));
    // Trois pâtes qui ne se remplacent pas : chacune garde sa ligne sur la liste.
    expect(cleProduit("pâte brisée")).not.toBe(cleProduit("pâte feuilletée"));
    expect(cleProduit("pâte feuilletée")).not.toBe(cleProduit("pâte sablée"));
    expect(cleProduit("pâte à tarte")).toBe(cleProduit("pâte brisée"));
  });

  it("un mot ambigu propose des choix sans bloquer", () => {
    const k = lu("Kinder");
    expect(k.confiance).toBe("incertain");
    expect(k.nom).toBe("Kinder");
    expect(k.choix!.map((c) => c.nom)).toContain("Kinder Bueno");
  });

  it("même produit, même identité : PQ = papier toilette", () => {
    expect(cleProduit("PQ")).toBe(cleProduit("Papier toilette"));
    expect(cleProduit("Pim's")).toBe(cleProduit("pims"));
  });

  it("ce que la famille a choisi passe avant tout", () => {
    expect(lireSaisie("kinder", { kinder: { nom: "Kinder Bueno", rayon: "epicerie", produit: "kinder-bueno" } })).toMatchObject({
      nom: "Kinder Bueno",
      confiance: "sur",
    });
    expect(lireSaisie("chocapik", { chocapik: "tel-quel" })).toMatchObject({ nom: "Chocapik", confiance: "inconnu" });
  });

  it("inconnu : comme avant (nom tel que tapé, rayon deviné)", () => {
    expect(lu("cire pour meubles")).toMatchObject({ nom: "Cire pour meubles", confiance: "inconnu" });
  });

  it("rapide : moins d'une milliseconde par article", () => {
    lu("x");
    const t = performance.now();
    for (let i = 0; i < 500; i++) lu(["Pims", "nutela", "2 packs de lait", "croquettes pour lapin", "Kinder"][i % 5]);
    expect((performance.now() - t) / 500).toBeLessThan(1);
  });
});
