import { describe, expect, it } from "vitest";
import { commeVoulu, courseCouvreLeDiner, duree, histoireDesRepas, ilYa, jourHabituel, mangesDeduits, platsARefaire, platsCoches, raisonDuSoir, raisonValide, type PlatDuSoir } from "./memoire";

const j = (iso: string, heure = "19:00") => Date.parse(`${iso}T${heure}:00Z`);
// 2026-10-27 est un mardi.
const MARDI = j("2026-10-27", "15:40");
const repas = (...jours: string[]) => jours.map((d) => ({ recipeId: "gratin", faitLe: j(d) }));
const plat = (o: Partial<PlatDuSoir> = {}): PlatDuSoir => ({ achete: false, qui: [], aime: false, adore: false, ...o });
const moi = "Léa";

describe("Dire un délai comme on le dirait", () => {
  it("jours, semaines, mois", () => {
    expect(duree(1)).toBe("1 jour");
    expect(duree(12)).toBe("12 jours");
    expect(duree(21)).toBe("3 semaines");
    expect(duree(70)).toBe("2 mois");
  });
  it("« hier » plutôt que « il y a 1 jour »", () => {
    expect(ilYa(1)).toBe("hier");
    expect(ilYa(5)).toBe("il y a 5 jours");
    expect(ilYa(21)).toBe("il y a 3 semaines");
  });
});

describe("Un dîner décidé dont les courses sont faites compte comme mangé", () => {
  const decision = { recipeId: "gratin", jour: "2026-10-20" };
  const course = (le: string, recettes = ["gratin"]) => ({ le: Date.parse(le), recettes });
  const aujourdhui = "2026-10-27";

  it("la course terminée avant ce soir-là : mangé ce soir-là, sans « C'est fait »", () => {
    const r = mangesDeduits([decision], [course("2026-10-18T16:00:00Z")], [], aujourdhui);
    expect(r).toEqual([{ recipeId: "gratin", faitLe: j("2026-10-20", "20:00") }]);
  });
  it("la course faite le lendemain compte encore (on décide le soir, on fait les courses au matin)", () => {
    expect(mangesDeduits([decision], [course("2026-10-21T09:00:00Z")], [], aujourdhui)).toHaveLength(1);
  });
  it("pas deux jours après : ce n'était pas pour ce dîner", () => {
    expect(mangesDeduits([decision], [course("2026-10-22T09:00:00Z")], [], aujourdhui)).toHaveLength(0);
  });
  it("pas une course vieille de plus de 10 jours", () => {
    expect(mangesDeduits([decision], [course("2026-10-09T09:00:00Z")], [], aujourdhui)).toHaveLength(0);
  });
  it("pas une course qui n'avait pas ce plat", () => {
    expect(mangesDeduits([decision], [course("2026-10-19T09:00:00Z", ["quiche"])], [], aujourdhui)).toHaveLength(0);
  });
  it("le dîner d'aujourd'hui n'est pas fini : il ne compte pas", () => {
    expect(mangesDeduits([{ recipeId: "gratin", jour: aujourdhui }], [course("2026-10-26T10:00:00Z")], [], aujourdhui)).toHaveLength(0);
  });
  it("déjà marqué « C'est fait » à un jour près : pas compté deux fois", () => {
    const explicite = [{ recipeId: "gratin", faitLe: j("2026-10-21", "12:00") }];
    expect(mangesDeduits([decision], [course("2026-10-18T16:00:00Z")], explicite, aujourdhui)).toHaveLength(0);
  });
  it("un « C'est fait » d'un autre jour ne cache pas ce dîner", () => {
    const explicite = [{ recipeId: "gratin", faitLe: j("2026-10-05", "12:00") }];
    expect(mangesDeduits([decision], [course("2026-10-18T16:00:00Z")], explicite, aujourdhui)).toHaveLength(1);
  });
});

describe("Des courses couvrent un dîner", () => {
  it("faites avant ce soir-là (jusqu'à 10 jours), ce soir-là ou le lendemain", () => {
    expect(courseCouvreLeDiner("2026-10-20", j("2026-10-11", "12:00"))).toBe(true);
    expect(courseCouvreLeDiner("2026-10-20", j("2026-10-20", "18:00"))).toBe(true);
    expect(courseCouvreLeDiner("2026-10-20", j("2026-10-21", "23:00"))).toBe(true);
  });
  it("pas plus de 10 jours avant, ni après le lendemain", () => {
    expect(courseCouvreLeDiner("2026-10-20", j("2026-10-09", "12:00"))).toBe(false);
    expect(courseCouvreLeDiner("2026-10-20", j("2026-10-22", "08:00"))).toBe(false);
  });
});

describe("La liste cochée vaut courses faites", () => {
  const menu = [
    { id: "gratin", titre: "Gratin dauphinois" },
    { id: "quiche", titre: "Quiche" },
  ];
  const ligne = (pour: string, checked: boolean, source = "recipe") => ({ for_recipes: pour, source, checked });

  it("tous les articles du plat sont cochés", () => {
    expect(platsCoches(menu, [ligne("Gratin dauphinois", true), ligne("Gratin dauphinois, Quiche", true), ligne("Quiche", false)])).toEqual(["gratin"]);
  });
  it("un seul article manquant : pas encore", () => {
    expect(platsCoches(menu, [ligne("Gratin dauphinois", true), ligne("Gratin dauphinois", false)])).toEqual([]);
  });
  it("un plat sans article sur la liste n'est pas « coché »", () => {
    expect(platsCoches(menu, [ligne("Quiche", true)])).toEqual(["quiche"]);
  });
  it("les articles ajoutés à la main ne comptent pas", () => {
    expect(platsCoches(menu, [ligne("Gratin dauphinois", true), { for_recipes: null, source: "manual", checked: false }])).toEqual(["gratin"]);
  });
});

describe("Ce que la maison a mangé, jour par jour", () => {
  it("compte les fois, garde la dernière", () => {
    const h = histoireDesRepas(repas("2026-10-06", "2026-10-13", "2026-10-20")).get("gratin")!;
    expect(h.fois).toBe(3);
    expect(h.dernier).toBe(j("2026-10-20"));
  });
  it("trouve le jour habituel : au moins trois fois ce jour-là, et la plupart des fois", () => {
    const h = histoireDesRepas(repas("2026-10-06", "2026-10-13", "2026-10-20", "2026-10-23")).get("gratin")!; // trois mardis, un vendredi
    expect(jourHabituel(h)).toBe(2);
  });
  it("pas de jour habituel quand les jours varient, ni avec moins de trois fois", () => {
    expect(jourHabituel(histoireDesRepas(repas("2026-10-06", "2026-10-09", "2026-10-11", "2026-10-14")).get("gratin")!)).toBeNull();
    expect(jourHabituel(histoireDesRepas(repas("2026-10-06", "2026-10-13")).get("gratin")!)).toBeNull();
  });
});

describe("La phrase sous le plat : une seule raison, la plus vraie", () => {
  const trois = histoireDesRepas(repas("2026-10-06", "2026-10-13", "2026-10-20")).get("gratin")!;

  it("acheté d'abord, puis l'envie de quelqu'un", () => {
    expect(raisonDuSoir(plat({ achete: true, qui: ["Karin"] }), { moi, now: MARDI })).toEqual({ texte: "Déjà acheté aux dernières courses", raison: "achete" });
    expect(raisonDuSoir(plat({ qui: ["Karin"] }), { moi, now: MARDI })).toEqual({ texte: "Karin en a envie", raison: "envie" });
  });
  it("un classique, le jour où la maison le mange : « Votre classique du mardi »", () => {
    expect(raisonDuSoir(plat({ histoire: trois }), { moi, now: MARDI })).toEqual({ texte: "Votre classique du mardi", raison: "classique_jour" });
  });
  it("le même classique un autre jour, mangé il y a peu : « Un classique : 3 fois »", () => {
    expect(raisonDuSoir(plat({ histoire: trois }), { moi, now: j("2026-10-28", "15:40") })).toEqual({ texte: "Un classique : 3 fois", raison: "classique" });
  });
  it("le même classique, pas fait depuis plus de dix jours : « Pas fait depuis 12 jours »", () => {
    expect(raisonDuSoir(plat({ histoire: trois }), { moi, now: j("2026-11-01", "15:40") })).toEqual({ texte: "Pas fait depuis 12 jours", raison: "pas_fait" });
  });
  it("aimé après l'avoir mangé : « Adoré il y a 3 semaines »", () => {
    const une = histoireDesRepas(repas("2026-10-06")).get("gratin")!;
    expect(raisonDuSoir(plat({ histoire: une, aime: true, adore: true }), { moi, now: j("2026-10-27", "15:40") })).toEqual({ texte: "Adoré il y a 3 semaines", raison: "adore" });
  });
  it("aimé en swipant, jamais mangé : pas de date inventée", () => {
    expect(raisonDuSoir(plat({ aime: true }), { moi, now: MARDI })).toEqual({ texte: "Tu l'avais aimé", raison: "aime" });
  });
  it("mangé il y a longtemps, sans avis : la date seule", () => {
    const une = histoireDesRepas(repas("2026-10-06")).get("gratin")!;
    expect(raisonDuSoir(plat({ histoire: une }), { moi, now: MARDI }).texte).toBe("Pas fait depuis 3 semaines");
  });
  it("mangé la semaine dernière, sans avis : rien de daté, une idée de Kaddie", () => {
    const une = histoireDesRepas(repas("2026-10-24")).get("gratin")!;
    expect(raisonDuSoir(plat({ histoire: une }), { moi, now: MARDI })).toEqual({ texte: "Une idée de Kaddie", raison: "idee" });
  });
  it("sans rien à dire : une idée de Kaddie", () => {
    expect(raisonDuSoir(plat(), { moi, now: MARDI })).toEqual({ texte: "Une idée de Kaddie", raison: "idee" });
  });
});

describe("Les plats à refaire", () => {
  const histoires = histoireDesRepas([
    { recipeId: "gratin", faitLe: j("2026-10-06") },
    { recipeId: "blanquette", faitLe: j("2026-10-13") },
    { recipeId: "tacos", faitLe: j("2026-10-25") },
    { recipeId: "quiche", faitLe: j("2026-10-01") },
  ]);
  const now = MARDI;

  it("aimés et mangés il y a plus d'une semaine, les plus anciens d'abord", () => {
    const r = platsARefaire(histoires, { aimes: new Set(["gratin", "blanquette", "tacos"]), ecartes: new Set(), now });
    expect(r.map((x) => x.recipeId)).toEqual(["gratin", "blanquette"]);
  });
  it("jamais un plat que j'ai écarté, ni un plat que personne n'a aimé", () => {
    const r = platsARefaire(histoires, { aimes: new Set(["gratin", "quiche"]), ecartes: new Set(["quiche"]), now });
    expect(r.map((x) => x.recipeId)).toEqual(["gratin"]);
  });
  it("un classique en fait partie même sans « Miam »", () => {
    const h = histoireDesRepas([...repas("2026-09-01", "2026-09-08", "2026-09-15")]);
    expect(platsARefaire(h, { aimes: new Set(), ecartes: new Set(), now }).map((x) => x.recipeId)).toEqual(["gratin"]);
  });
  it("au plus trois", () => {
    const h = histoireDesRepas(["a", "b", "c", "d", "e"].map((id, k) => ({ recipeId: id, faitLe: j("2026-09-01") + k * 86_400_000 })));
    expect(platsARefaire(h, { aimes: new Set(["a", "b", "c", "d", "e"]), ecartes: new Set(), now })).toHaveLength(3);
  });
});

describe("Le message au groupe", () => {
  it("nomme celui ou celle qui en avait envie", () => {
    expect(commeVoulu(["Karin"])).toBe("comme Karin le voulait");
    expect(commeVoulu(["Karin", "Léo"])).toBe("comme Karin et Léo le voulaient");
  });
  it("rien quand personne d'autre n'en avait envie", () => {
    expect(commeVoulu([])).toBeNull();
  });
});

describe("La raison gardée avec la décision", () => {
  it("seulement une raison connue, jamais un texte libre", () => {
    expect(raisonValide("adore")).toBe("adore");
    expect(raisonValide("Karin en a envie")).toBeNull();
    expect(raisonValide(undefined)).toBeNull();
    expect(raisonValide({})).toBeNull();
  });
});
