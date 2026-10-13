import { describe, expect, it } from "vitest";
import { equivalentFor, resolveAlias } from "./routes";

describe("routes", () => {
  it("traduit les adresses neutres et anciennes selon le style", () => {
    expect(resolveAlias("/", "simple")).toBe("/simple");
    expect(resolveAlias("/", "fun")).toBe("/fun");
    expect(resolveAlias("/courses", "fun")).toBe("/fun/courses");
    expect(resolveAlias("/enfant/courses", "simple")).toBe("/simple");
    expect(resolveAlias("/maman/liste", "fun")).toBe("/fun/liste");
    expect(resolveAlias("/recettes", "fun")).toBeNull();
  });

  it("renvoie vers l'écran équivalent de son propre style", () => {
    expect(equivalentFor("/simple/plats", "fun")).toBe("/fun/matchs");
    expect(equivalentFor("/fun/liste", "simple")).toBe("/simple/liste");
    expect(equivalentFor("/simple/swipe", "fun")).toBe("/fun");
    expect(equivalentFor("/fun/courses", "fun")).toBeNull();
    expect(equivalentFor("/recettes", "simple")).toBeNull();
  });
});
