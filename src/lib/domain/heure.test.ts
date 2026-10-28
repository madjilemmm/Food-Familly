import { describe, expect, it } from "vitest";
import { heureAParis, jourAParis } from "./heure";

describe("heureAParis", () => {
  it("lit l'heure de Paris comme un nombre (été, UTC+2)", () => {
    expect(heureAParis(new Date("2026-07-01T15:30:00Z"))).toBe(17);
  });
  it("hiver (UTC+1) et minuit", () => {
    expect(heureAParis(new Date("2026-12-01T23:10:00Z"))).toBe(0);
    expect(heureAParis(new Date("2026-12-01T08:00:00Z"))).toBe(9);
  });
});

describe("jourAParis", () => {
  it("le jour de Paris, pas celui du serveur", () => {
    expect(jourAParis(new Date("2026-10-28T22:30:00Z"))).toBe("2026-10-28");
    expect(jourAParis(new Date("2026-10-28T23:30:00Z"))).toBe("2026-10-29");
  });
});
