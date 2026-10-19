import { describe, expect, it } from "vitest";
import { portrait } from "./portrait";

const aime = (style: string | null, minutes: number | null = null) => ({ style, minutes });

describe("portrait gourmand", () => {
  it("un style qui revient souvent devient un trait ; trop peu d'indices, rien n'est affirmé", () => {
    const p = portrait({ aimes: [aime("pates", 20), aime("pates", 15), aime("pates", 25), aime("pizza")], refuses: [], gouts: {} });
    expect(p.traits.map((t) => t.texte)).toEqual(["Team pâtes", "Plutôt des plats rapides"]);
    expect(portrait({ aimes: [aime("pates"), aime("pates")], refuses: [], gouts: {} }).traits).toEqual([]);
  });
  it("ce qu'on refuse presque toujours", () => {
    const p = portrait({ aimes: [aime("pates")], refuses: [{ style: "asiatique" }, { style: "asiatique" }, { style: "asiatique" }], gouts: {} });
    expect(p.traits.some((t) => t.id === "non:asiatique")).toBe(true);
  });
  it("les goûts déclarés se corrigent ; il reste des plats à swiper pour mieux connaître", () => {
    const p = portrait({ aimes: [], refuses: [], gouts: { fromage: "adore", sans_porc: "interdit" } });
    expect(p.traits).toEqual([{ id: "adore:fromage", texte: "Tu adores : fromage", gout: "fromage" }]);
    expect(p.aSwiper).toBe(10);
  });
});
