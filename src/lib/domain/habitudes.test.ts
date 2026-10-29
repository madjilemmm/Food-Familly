import { describe, expect, it } from "vitest";
import { aAjouter, achetesLaDerniereFois, habituelsDus, pasPrisLaDerniereFois, vraimentFaite, type CoursePassee, type Reponse } from "./habitudes";

const now = Date.parse("2026-10-19T10:00:00Z");
const J = 86_400_000;
const il = (jours: number) => now - jours * J;
const achat = (name: string, cle = name.toLowerCase(), checked = true) => ({ name, cle, source: "manual", checked, aisle: "cremerie" });
/** Une course finie il y a `jours` jours, avec ces achats. */
const course = (jours: number, items: ReturnType<typeof achat>[], o: Partial<CoursePassee> = {}): CoursePassee => ({
  id: `c${jours}`,
  le: il(jours),
  finie: true,
  close: true,
  items,
  ...o,
});
const toutesLesSemaines = (fois: number, depuis: number, name = "Lait") =>
  Array.from({ length: fois }, (_, k) => course(depuis + 7 * k, [achat(name)]));
const libre = { surLaListe: new Set<string>(), repondusIci: new Set<string>(), now };

describe("habitudes", () => {
  it("A — le lait chaque semaine : proposé une semaine après", () => {
    expect(habituelsDus(toutesLesSemaines(4, 7), [], now).map((s) => s.nom)).toEqual(["Lait"]);
  });
  it("B — acheté il y a 2 jours : pas encore", () => {
    expect(habituelsDus(toutesLesSemaines(4, 2), [], now)).toEqual([]);
  });
  it("C — deux achats seulement : pas une habitude", () => {
    expect(habituelsDus(toutesLesSemaines(2, 10), [], now)).toEqual([]);
  });
  it("D — 3 achats en 10 jours : pas assez étalés", () => {
    expect(habituelsDus([course(10, [achat("Pain")]), course(15, [achat("Pain")]), course(20, [achat("Pain")])], [], now)).toEqual([]);
    expect(habituelsDus([course(10, [achat("Pain")]), course(14, [achat("Pain")]), course(18, [achat("Pain")])], [], now)).toEqual([]);
  });
  it("E — un produit rare (tous les 2 mois) revient quand c'est le moment, même tard", () => {
    const lessive = [course(70, [achat("Lessive")]), course(130, [achat("Lessive")]), course(190, [achat("Lessive")])];
    expect(habituelsDus(lessive, [], now).map((s) => s.nom)).toEqual(["Lessive"]);
  });
  it("F — « pas besoin » : le rythme repart de ce jour-là ; 2 fois de suite : en veille", () => {
    const lait = toutesLesSemaines(4, 8);
    const une: Reponse[] = [{ cle: "lait", reponse: "pas_besoin", le: il(2) }];
    expect(habituelsDus(lait, une, now)).toEqual([]);
    const deux: Reponse[] = [...une, { cle: "lait", reponse: "pas_besoin", le: il(1) }];
    expect(habituelsDus(lait, deux, now + 30 * J)).toEqual([]);
  });
  it("G — ignoré n'est pas refusé ; 3 fois sans réponse de suite : en veille jusqu'au prochain achat", () => {
    const lait = toutesLesSemaines(4, 30);
    const deux: Reponse[] = [1, 2].map((d) => ({ cle: "lait", reponse: "sans_reponse" as const, le: il(d) }));
    expect(habituelsDus(lait, deux, now)).toHaveLength(1);
    const trois: Reponse[] = [1, 2, 3].map((d) => ({ cle: "lait", reponse: "sans_reponse" as const, le: il(d) }));
    expect(habituelsDus(lait, trois, now)).toEqual([]);
    // Acheté depuis : les anciennes réponses ne comptent plus.
    expect(habituelsDus([course(10, [achat("Lait")]), ...lait], trois.map((r) => ({ ...r, le: il(20) })), now)).toHaveLength(1);
  });
  it("H — au plus 6, les plus en retard d'abord ; jamais ce qui est déjà sur la liste", () => {
    const produits = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const courses = [10, 17, 24, 31].map((d) => course(d, produits.map((p) => achat(p))));
    // « A » n'a pas été pris à la dernière course : c'est le plus en retard.
    courses[0].items = courses[0].items.filter((i) => i.name !== "A");
    const { habituels } = aAjouter(courses, [], { ...libre, surLaListe: new Set(["b"]) });
    expect(habituels).toHaveLength(6);
    expect(habituels[0].nom).toBe("A");
    expect(habituels.map((s) => s.cle)).not.toContain("b");
  });
  it("une course close sans être finie ne compte que si la moitié de la liste a été cochée", () => {
    expect(vraimentFaite(course(1, [achat("Lait", "lait", false), achat("Pain", "pain", false)], { finie: false }))).toBe(false);
    expect(vraimentFaite(course(1, [achat("Lait"), achat("Pain", "pain", false)], { finie: false }))).toBe(true);
  });
  it("le nom le plus acheté est proposé (« Danette chocolat »)", () => {
    const d = [7, 14, 21].map((j, k) => course(j, [achat(k === 1 ? "Danette" : "Danette chocolat", "danette")]));
    expect(habituelsDus(d, [], now)[0].nom).toBe("Danette chocolat");
  });
});

describe("pas pris la dernière fois", () => {
  it("seulement après « J'ai fini », et seulement ce qui avait été ajouté ou demandé", () => {
    const derniere = course(3, [achat("Yaourts", "yaourt", false), { ...achat("Farine", "farine", false), source: "recipe" }, achat("Pain")]);
    expect(pasPrisLaDerniereFois([derniere]).map((s) => s.nom)).toEqual(["Yaourts"]);
    expect(pasPrisLaDerniereFois([{ ...derniere, finie: false }])).toEqual([]);
  });
  it("un article pas pris n'est pas aussi proposé comme habituel ; déjà répondu ici : plus proposé", () => {
    const courses = [course(7, [achat("Lait", "lait", false)]), ...toutesLesSemaines(4, 14)];
    const r = aAjouter(courses, [], libre);
    expect(r.reportes.map((s) => s.cle)).toEqual(["lait"]);
    expect(r.habituels).toEqual([]);
    expect(aAjouter(courses, [], { ...libre, repondusIci: new Set(["lait"]) }).reportes).toEqual([]);
  });
});

describe("la dernière fois", () => {
  const lait = achat("Lait");
  const oeufs = achat("Œufs", "oeufs");

  it("à la deuxième course : ce qui a été acheté à la main à la première", () => {
    expect(achetesLaDerniereFois([course(7, [lait, oeufs])]).map((s) => s.nom)).toEqual(["Lait", "Œufs"]);
    const { derniere, habituels, reportes } = aAjouter([course(7, [lait, oeufs])], [], libre);
    expect(derniere.map((s) => s.origine)).toEqual(["derniere", "derniere"]);
    expect([habituels, reportes]).toEqual([[], []]);
  });
  it("seulement ce qui a été acheté : ni un article pas pris, ni un ingrédient de recette", () => {
    const pasPris = achat("Café", "cafe", false);
    const poulet = { ...achat("Poulet"), source: "recipe" };
    expect(achetesLaDerniereFois([course(7, [lait, pasPris, poulet])]).map((s) => s.nom)).toEqual(["Lait"]);
  });
  it("la dernière course faite, pas une plus ancienne", () => {
    expect(achetesLaDerniereFois([course(7, [oeufs]), course(14, [lait])]).map((s) => s.nom)).toEqual(["Œufs"]);
  });
  it("rien avant la première course faite", () => {
    expect(achetesLaDerniereFois([])).toEqual([]);
    expect(achetesLaDerniereFois([course(3, [lait], { finie: false, close: false })])).toEqual([]);
  });
  it("à partir de trois courses faites, ce sont les habituels qui parlent", () => {
    expect(achetesLaDerniereFois([course(7, [lait]), course(14, [lait]), course(21, [lait])])).toEqual([]);
  });
  it("jamais ce qui est déjà sur la liste ni ce qui a déjà reçu une réponse ici", () => {
    const { derniere } = aAjouter([course(7, [lait, oeufs, achat("Pain")])], [], { ...libre, surLaListe: new Set(["lait"]), repondusIci: new Set(["pain"]) });
    expect(derniere.map((s) => s.nom)).toEqual(["Œufs"]);
  });
  it("un article pas pris la dernière fois n'est pas aussi proposé là (même produit coché dans une course plus ancienne)", () => {
    const { reportes, derniere } = aAjouter([course(7, [achat("Café", "cafe", false), lait]), course(14, [achat("Café", "cafe")])], [], libre);
    expect(reportes.map((s) => s.nom)).toEqual(["Café"]);
    expect(derniere.map((s) => s.nom)).toEqual(["Lait"]);
  });
  it("au plus 8 articles", () => {
    const beaucoup = Array.from({ length: 12 }, (_, k) => achat(`Article ${k}`));
    expect(aAjouter([course(7, beaucoup)], [], libre).derniere).toHaveLength(8);
  });
});
