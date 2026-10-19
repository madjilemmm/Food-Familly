import { describe, expect, it } from "vitest";
import {
  REGLAGES,
  calculerMatchs,
  classerPlats,
  compatibilite,
  estEnvie,
  oubliParMembre,
  ordonnerPaquet,
  scoreIndividuel,
  type Avis,
  type CandidatCourse,
  type CartePaquet,
} from "./reco";

const now = Date.parse("2026-10-16T12:00:00Z");
const jours = (d: number) => now - d * 86_400_000;
const like = (d = 1): Avis => ({ liked: true, swipedAt: jours(d), likedAt: jours(d) });
const bof = (d = 1, aimeIlYA: number | null = null): Avis => ({ liked: false, swipedAt: jours(d), likedAt: aimeIlYA == null ? null : jours(aimeIlYA) });
const avisDe = (o: Record<string, Record<string, Avis>>) =>
  new Map(Object.entries(o).map(([r, m]) => [r, new Map(Object.entries(m))]));
const famille = ["maman", "madji", "yoalem", "papa"];

function candidat(id: string, o: Partial<CandidatCourse> = {}): CandidatCourse {
  return { id, demandePar: [], enviePar: [], aimePar: [], exclu: false, gouts: new Map(), joursDepuisRetenu: null, ecarte: false, ...o };
}
const classer = (c: CandidatCourse[], o: Partial<{ membres: string[]; oubli: Map<string, number>; ouverte: boolean; max: number }> = {}) =>
  classerPlats(c, { membres: famille, oubli: new Map(), ouverte: true, max: 5, ...o });

describe("scores de base", () => {
  it("rien de connu → null (jamais un refus)", () => {
    expect(scoreIndividuel({}, now)).toBeNull();
  });
  it("aimé récemment > aimé il y a longtemps > inconnu > refusé", () => {
    const recent = scoreIndividuel({ avis: like(2) }, now)!;
    const ancien = scoreIndividuel({ avis: like(200) }, now)!;
    expect(recent).toBeGreaterThan(ancien);
    expect(ancien).toBeGreaterThan(0);
    expect(scoreIndividuel({ avis: bof(2) }, now)!).toBeLessThan(0);
  });
  it("compatibilité : l'inconnu est neutre, un désaccord pèse", () => {
    expect(compatibilite([0.6, null, null])).toBeCloseTo(0.2);
    expect(compatibilite([0.6, 0.6, -0.5, -0.5])).toBeLessThan(compatibilite([0.6, 0.6, null, null]));
    expect(compatibilite([])).toBe(0);
  });
});

describe("Test 1 — famille unanime", () => {
  it("4 envies → match pour toute la famille, proposé d'office, pour 4", () => {
    const m = calculerMatchs(avisDe({ lasagnes: { maman: like(), madji: like(), yoalem: like(), papa: like() } }), () => null, now);
    expect(m[0].likers).toHaveLength(4);
    const [p] = classer([candidat("lasagnes", { enviePar: famille })]);
    expect(p).toMatchObject({ propose: true, checked: true, people: 4, raison: { type: "envie" } });
  });
});

describe("Test 2 — famille divisée", () => {
  it("2 aiment, 2 refusent → match entre les 2, pour les 2 seulement", () => {
    const m = calculerMatchs(avisDe({ x: { madji: like(), yoalem: like(), maman: bof(), papa: bof() } }), () => null, now);
    expect(m).toHaveLength(1);
    expect(m[0].likers.sort()).toEqual(["madji", "yoalem"]);
    const [p] = classer([candidat("x", { enviePar: ["madji", "yoalem"] })]);
    expect(p.eaters.sort()).toEqual(["madji", "yoalem"]);
    expect(p.people).toBe(2);
  });
});

describe("Test 3 — préférences inconnues", () => {
  it("2 envies, les autres n'ont jamais voté → match, et l'inconnu ne fait pas baisser le score comme un refus", () => {
    expect(calculerMatchs(avisDe({ x: { madji: like(), yoalem: like() } }), () => null, now)).toHaveLength(1);
    const inconnus = compatibilite([0.6, 0.6, null, null]);
    const refus = compatibilite([0.6, 0.6, -0.5, -0.5]);
    expect(inconnus).toBeGreaterThan(refus);
  });
});

describe("Test 4 — repas individuels", () => {
  it("la mère mange autre chose : ses envies ne bloquent pas celles des enfants, chacun a son plat", () => {
    const m = calculerMatchs(
      avisDe({ crepes: { madji: like(), yoalem: like() }, salade: { maman: like() } }),
      () => null,
      now,
    );
    expect(m.map((x) => x.recipeId)).toEqual(["crepes"]);
    const plats = classer([candidat("crepes", { enviePar: ["madji", "yoalem"] }), candidat("salade", { enviePar: ["maman"] })]);
    const crepes = plats.find((p) => p.id === "crepes")!;
    const salade = plats.find((p) => p.id === "salade")!;
    expect(crepes).toMatchObject({ checked: true, people: 2 });
    // Une envie seule n'est pas cochée d'office, mais reste visible, pour elle.
    expect(salade).toMatchObject({ checked: false, eaters: ["maman"], people: 1 });
  });
});

describe("Test 5 — utilisateur seul", () => {
  it("pas de match possible, mais ses envies arrivent à la course et son paquet suit ses goûts", () => {
    expect(calculerMatchs(avisDe({ x: { solo: like() } }), () => null, now)).toHaveLength(0);
    const [p] = classer([candidat("x", { enviePar: ["solo"] })], { membres: ["solo"] });
    expect(p).toMatchObject({ eaters: ["solo"], people: 1 });
  });
});

describe("Test 6 — préférences minoritaires", () => {
  it("le goût minoritaire passe en premier dans les autres idées, et l'équité le remonte après des courses sans lui", () => {
    const c = [
      candidat("pates", { enviePar: ["maman", "madji"] }),
      candidat("pizza", { enviePar: ["maman", "yoalem"] }),
      candidat("risotto", { enviePar: ["madji"] }),
      candidat("ramen", { enviePar: ["papa"] }),
    ];
    const idees = classer(c, { max: 2 }).filter((p) => !p.checked);
    expect(idees.map((p) => p.id)).toContain("ramen");
    const oubli = oubliParMembre([{ eaters: new Set(["maman", "madji"]) }, { eaters: new Set(["yoalem", "maman"]) }], famille);
    expect(oubli.get("papa")).toBe(2);
    const avec = classer(c, { max: 2, oubli }).filter((p) => !p.checked);
    expect(avec[0].id).toBe("ramen");
  });
  it("jamais de plat imposé : une envie seule n'est pas cochée d'office", () => {
    expect(classer([candidat("ramen", { enviePar: ["papa"] })])[0].checked).toBe(false);
  });
});

describe("Test 7 — recettes répétées", () => {
  it("un plat retenu il y a 2 jours passe derrière un autre, puis revient avec le temps", () => {
    const base = { enviePar: ["madji", "yoalem"] };
    const plats = classer([candidat("tacos", { ...base, joursDepuisRetenu: 2 }), candidat("curry", base)], { max: 1 });
    expect(plats[0].id).toBe("curry");
    const plusTard = classer([candidat("tacos", { ...base, joursDepuisRetenu: 60 }), candidat("curry", base)], { max: 2 });
    expect(plusTard.every((p) => p.checked)).toBe(true);
  });
  it("une envie s'éteint quand le plat a été acheté depuis", () => {
    expect(estEnvie(like(3), jours(1), now)).toBe(false);
    expect(estEnvie(like(3), jours(5), now)).toBe(true);
    expect(calculerMatchs(avisDe({ x: { madji: like(3), yoalem: like(3) } }), () => jours(1), now)).toHaveLength(0);
  });
});

describe("Test 8 — changement d'avis", () => {
  it("un Bof après un like retire l'envie, et le match tombe", () => {
    expect(calculerMatchs(avisDe({ x: { madji: like(5), yoalem: bof(1, 5) } }), () => null, now)).toHaveLength(0);
  });
  it("le dernier avis compte : refusé puis aimé = envie", () => {
    expect(estEnvie({ liked: true, swipedAt: jours(1), likedAt: jours(1) }, null, now)).toBe(true);
  });
});

describe("Test 9 — envie ponctuelle", () => {
  it("aime le plat mais « Bof » cette semaine : pas d'envie, mais le goût reste positif", () => {
    const avis = bof(1, 30);
    expect(estEnvie(avis, null, now)).toBe(false);
    expect(scoreIndividuel({ avis }, now)!).toBeGreaterThan(0);
  });
  it("un like trop ancien n'est plus une envie, mais reste un goût", () => {
    expect(estEnvie(like(REGLAGES.ENVIE_JOURS + 1), null, now)).toBe(false);
    expect(scoreIndividuel({ avis: like(REGLAGES.ENVIE_JOURS + 1) }, now)!).toBeGreaterThan(0);
  });
});

describe("Test 10 — nouvelle course", () => {
  it("un goût durable devient une idée, jamais cochée d'office ; seules les demandes et envies partagées le sont", () => {
    const plats = classer([
      candidat("demande", { demandePar: ["madji"] }),
      candidat("partage", { enviePar: ["madji", "yoalem"] }),
      candidat("idee", { aimePar: ["maman"] }),
    ]);
    expect(plats.find((p) => p.id === "demande")).toMatchObject({ checked: true, raison: { type: "demande" } });
    expect(plats.find((p) => p.id === "partage")).toMatchObject({ checked: true });
    expect(plats.find((p) => p.id === "idee")).toMatchObject({ checked: false, raison: { type: "aime" }, eaters: ["maman"] });
  });
  it("liste faite : plus rien n'est coché d'office ; un choix enregistré l'emporte", () => {
    const plats = classer(
      [candidat("nouveau", { enviePar: ["madji", "yoalem"] }), candidat("garde", { enviePar: ["madji"], choix: { selected: true, people: 3, eaters: ["madji", "papa"] } })],
      { ouverte: false },
    );
    expect(plats.find((p) => p.id === "nouveau")!.checked).toBe(false);
    expect(plats.find((p) => p.id === "garde")).toMatchObject({ checked: true, people: 3, eaters: ["madji", "papa"] });
  });
  it("au plus MAX plats proposés d'office", () => {
    const c = Array.from({ length: 8 }, (_, i) => candidat(`p${i}`, { enviePar: ["madji", "yoalem"] }));
    expect(classer(c, { max: 5 }).filter((p) => p.checked)).toHaveLength(5);
  });
});

describe("Test 11 — restrictions", () => {
  it("un interdit exclut le plat, même demandé et aimé de tous", () => {
    const plats = classer([candidat("arachide", { demandePar: famille, enviePar: famille, exclu: true })]);
    expect(plats).toHaveLength(0);
    expect(calculerMatchs(avisDe({ arachide: { madji: like(), yoalem: like() } }), () => null, now, (id) => id === "arachide")).toHaveLength(0);
  });
});

describe("Test 12 — membre inactif", () => {
  it("un membre qui ne swipe plus ne bloque rien et n'est compté dans aucun plat", () => {
    const m = calculerMatchs(avisDe({ x: { madji: like(), yoalem: like(), papa: bof(300) } }), () => null, now);
    expect(m).toHaveLength(1);
    const [p] = classer([candidat("x", { enviePar: ["madji", "yoalem"] })]);
    expect(p.eaters).not.toContain("papa");
  });
  it("équité : une course sans information ne compte pas comme un oubli", () => {
    expect(oubliParMembre([{ eaters: null }, { eaters: new Set(["madji"]) }], ["papa"]).get("papa")).toBe(0);
  });
});

describe("paquet de swipe", () => {
  const carte = (id: string, o: Partial<CartePaquet> = {}): CartePaquet => ({
    id,
    created_at: "2026-10-01",
    cache: false,
    fin: false,
    signaux: {},
    enviesDesAutres: 0,
    vuParLaFamille: true,
    style: null,
    ...o,
  });
  it("caché retiré, « j'adore » et ce dont les autres ont envie en tête, « un autre n'aime pas » à la fin", () => {
    const p = ordonnerPaquet(
      [carte("a"), carte("b", { cache: true }), carte("c", { fin: true }), carte("d", { signaux: { adore: true } }), carte("e", { enviesDesAutres: 2 })],
      now,
    );
    expect(p.map((c) => c.id)).toEqual(["d", "e", "a", "c"]);
  });
  it("un plat aimé revient après 3 semaines, un refusé après 6 ; jamais avant", () => {
    const p = ordonnerPaquet(
      [
        carte("aime-10j", { avis: like(10) }),
        carte("aime-25j", { avis: like(25) }),
        carte("refuse-30j", { avis: bof(30) }),
        carte("refuse-50j", { avis: bof(50) }),
      ],
      now,
    );
    expect(p.map((c) => c.id).sort()).toEqual(["aime-25j", "refuse-50j"]);
  });
  it("les favoris reviennent une carte sur 5, au milieu des découvertes", () => {
    const nouvelles = Array.from({ length: 8 }, (_, i) => carte(`n${i}`, { created_at: `2026-10-0${i + 1}` }));
    const p = ordonnerPaquet([...nouvelles, carte("favori", { avis: like(30) })], now);
    expect(p.findIndex((c) => c.id === "favori")).toBe(REGLAGES.RYTHME_RETOUR - 1);
  });
  it("pas trois plats du même style d'affilée quand on peut l'éviter", () => {
    const p = ordonnerPaquet(
      [
        carte("i1", { style: "italien", created_at: "2026-10-09" }),
        carte("i2", { style: "italien", created_at: "2026-10-08" }),
        carte("i3", { style: "italien", created_at: "2026-10-07" }),
        carte("a1", { style: "asiatique", created_at: "2026-10-06" }),
      ],
      now,
    );
    expect(p.map((c) => c.style).slice(0, 3)).not.toEqual(["italien", "italien", "italien"]);
  });
  it("liste vide → paquet vide ; découverte : jamais vu par la famille d'abord", () => {
    expect(ordonnerPaquet([], now)).toEqual([]);
    expect(ordonnerPaquet([carte("vu"), carte("neuf", { vuParLaFamille: false })], now)[0].id).toBe("neuf");
  });
});

describe("cas limites", () => {
  it("doublons de demandeurs, pas de candidats, groupe vide", () => {
    expect(classer([])).toEqual([]);
    const [p] = classer([candidat("x", { demandePar: ["madji", "madji"], enviePar: ["madji"] })]);
    expect(p.eaters).toEqual(["madji"]);
  });
  it("sans personne en particulier : pour toute la famille", () => {
    const [p] = classer([candidat("x", { choix: { selected: true, people: null, eaters: null } })]);
    expect(p).toMatchObject({ eaters: famille, people: 4, raison: { type: "famille" } });
  });
});

describe("Un plat choisi à la main ne disparaît jamais", () => {
  it("exclu par les goûts mais choisi : gardé, avec un avertissement (ses ingrédients vont sur la liste)", () => {
    const [p] = classer([candidat("quiche", { exclu: true, choix: { selected: true, people: 3, eaters: null } })], { ouverte: false });
    expect(p).toMatchObject({ id: "quiche", checked: true, attention: true });
  });
  it("exclu et pas choisi : jamais proposé", () => {
    expect(classer([candidat("quiche", { exclu: true, enviePar: famille })])).toEqual([]);
  });
});
