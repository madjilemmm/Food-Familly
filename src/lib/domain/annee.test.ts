import { describe, expect, it } from "vitest";
import { bilanAnnee } from "./annee";

const debut = Date.parse("2026-01-01");
const juin = Date.parse("2026-06-01");
const aime = (t = juin) => ({ liked: true, swipedAt: t, likedAt: t });

describe("Notre année à table", () => {
  it("compte les dîners, le plat star et qui a fait les courses", () => {
    const a = bilanAnnee(
      [
        { shopper: "anne", plats: ["tacos", "gratin"] },
        { shopper: "anne", plats: ["tacos"] },
        { shopper: "leo", plats: ["ramen"] },
      ],
      new Map(),
      debut,
    );
    expect(a).toMatchObject({ diners: 4, courses: 3, platStar: { id: "tacos", fois: 2 }, champion: { id: "anne", fois: 2 } });
  });
  it("le duo : les deux qui ont le plus d'envies en commun cette année", () => {
    const avis = new Map([
      ["tacos", new Map([["anne", aime()], ["leo", aime()], ["max", aime()]])],
      ["gratin", new Map([["anne", aime()], ["leo", aime()]])],
      ["ramen", new Map([["max", aime(Date.parse("2025-06-01"))], ["leo", aime()]])],
    ]);
    const a = bilanAnnee([], avis, debut);
    expect(a.duo).toEqual({ a: "anne", b: "leo", matchs: 2 });
    expect(a.swipes).toBe(6);
  });
  it("pas de plat star s'il n'a été pris qu'une fois", () => {
    expect(bilanAnnee([{ shopper: null, plats: ["tacos"] }], new Map(), debut).platStar).toBeNull();
  });
});
