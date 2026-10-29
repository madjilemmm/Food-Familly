import { describe, expect, it } from "vitest";
import { foyerValide } from "./foyer";

describe("foyerValide", () => {
  it("garde un nombre de personnes entre 1 et le maximum", () => {
    expect(foyerValide(4)).toBe(4);
    expect(foyerValide("3")).toBe(3);
    expect(foyerValide(0)).toBe(1);
    expect(foyerValide(-2)).toBe(1);
    expect(foyerValide(40)).toBe(12);
    expect(foyerValide(9, 6)).toBe(6);
    expect(foyerValide(2.6)).toBe(3);
  });
  it("refuse ce qui n'est pas un nombre : la famille garde alors son foyer d'avant", () => {
    expect(foyerValide(null)).toBeNull();
    expect(foyerValide(undefined)).toBeNull();
    expect(foyerValide("")).toBeNull();
    expect(foyerValide("  ")).toBeNull();
    expect(foyerValide("quatre")).toBeNull();
    expect(foyerValide(Number.NaN)).toBeNull();
    expect(foyerValide(Infinity)).toBeNull();
    expect(foyerValide({})).toBeNull();
  });
});
