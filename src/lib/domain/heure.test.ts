import { describe, expect, it } from "vitest";
import { heureAParis } from "./heure";

describe("heureAParis", () => {
  it("lit l'heure de Paris comme un nombre (été, UTC+2)", () => {
    expect(heureAParis(new Date("2026-07-01T15:30:00Z"))).toBe(17);
  });
  it("hiver (UTC+1) et minuit", () => {
    expect(heureAParis(new Date("2026-12-01T23:10:00Z"))).toBe(0);
    expect(heureAParis(new Date("2026-12-01T08:00:00Z"))).toBe(9);
  });
});
