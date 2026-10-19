import { describe, expect, it } from "vitest";
import { dureeDans } from "./cuisine";

describe("minuteurs dans les étapes", () => {
  it("lit les durées écrites", () => {
    expect(dureeDans("Enfourner 25 min à 200 °C.")).toBe(25);
    expect(dureeDans("Laisser mijoter 1 h 30.")).toBe(90);
    expect(dureeDans("Laisser reposer 2 heures.")).toBe(120);
    expect(dureeDans("Cuire 10 minutes.")).toBe(10);
    expect(dureeDans("Mélanger la farine et les œufs.")).toBeNull();
  });
});
