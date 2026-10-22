import { describe, expect, it } from "vitest";
import { etiquettesDe, etiquettesPreferees, prediction, profilDe } from "./profil-gouts";
import { ordonnerPaquet, scoreIndividuel, type Avis, type CartePaquet } from "./reco";

const now = Date.parse("2026-10-22T12:00:00Z");
const ilYA = (j: number) => now - j * 86_400_000;
const oui = (j = 2): Avis => ({ liked: true, swipedAt: ilYA(j), likedAt: ilYA(j) });
const non = (j = 2): Avis => ({ liked: false, swipedAt: ilYA(j), likedAt: null });

describe("goûts par caractéristiques", () => {
  it("étiquettes : style, aliments, temps", () => {
    const t = etiquettesDe(["Tacos au poulet", "poulet", "fromage râpé", "tortillas"], 25);
    expect(t).toContain("style:mexicain");
    expect(t).toContain("aliment:poulet");
    expect(t).toContain("temps:rapide");
  });
  it("aimer des plats au poulet rend un plat au poulet jamais vu plus probable", () => {
    const etiquettes = new Map([
      ["a", ["aliment:poulet", "style:mexicain"]],
      ["b", ["aliment:poulet", "style:pates"]],
      ["c", ["aliment:poisson"]],
    ]);
    const profil = profilDe([["a", oui()], ["b", oui()], ["c", non()]], etiquettes, now);
    expect(prediction(profil, ["aliment:poulet", "style:asiatique"])!).toBeGreaterThan(0.3);
    expect(prediction(profil, ["style:asiatique"])).toBeNull();
  });
  it("un « non » seul compte peu ; répété, il devient un vrai goût", () => {
    const tags = new Map([["p1", ["aliment:poisson"]], ["p2", ["aliment:poisson"]], ["p3", ["aliment:poisson"]], ["p4", ["aliment:poisson"]]]);
    const unNon = profilDe([["p1", non()], ["p2", non()]], tags, now).get("aliment:poisson")!;
    const quatreNon = profilDe([["p1", non()], ["p2", non()], ["p3", non()], ["p4", non()]], tags, now).get("aliment:poisson")!;
    expect(unNon).toBeGreaterThan(-0.4);
    expect(quatreNon).toBeLessThan(unNon);
  });
  it("un « non » sur un plat s'efface plus vite qu'un « oui »", () => {
    const apres = (a: Avis) => scoreIndividuel({ avis: a }, now)!;
    expect(Math.abs(apres(non(60)))).toBeLessThan(Math.abs(apres(non(1))) / 3);
    expect(apres(oui(60))).toBeGreaterThan(apres(oui(1)) / 2);
  });
  it("les styles préférés d'une famille", () => {
    const p1 = new Map([["style:pates", 0.6], ["style:mexicain", 0.2], ["aliment:poulet", 0.9]]);
    const p2 = new Map([["style:mexicain", 0.5], ["style:asiatique", -0.4]]);
    expect(etiquettesPreferees([p1, p2], "style:", 3)).toEqual(["mexicain", "pates"]);
  });
});

describe("paquet : prédiction, matchs probables, lassitude", () => {
  const carte = (id: string, o: Partial<CartePaquet> = {}): CartePaquet & { id: string } => ({
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
  it("un plat jamais vu que j'aimerais probablement passe devant", () => {
    const p = ordonnerPaquet([carte("neutre"), carte("probable", { signaux: { prediction: 0.6 } })], now);
    expect(p[0].id).toBe("probable");
  });
  it("un plat qu'un autre aimerait probablement passe devant : viser les matchs", () => {
    const p = ordonnerPaquet([carte("seul"), carte("match", { matchProbable: 0.7 })], now);
    expect(p[0].id).toBe("match");
  });
  it("un style déjà retenu deux fois cette semaine recule", () => {
    const p = ordonnerPaquet([carte("pates-encore", { lassitude: 2 }), carte("autre")], now);
    expect(p[0].id).toBe("autre");
  });
});
