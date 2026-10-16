import { describe, expect, it } from "vitest";
import { resolveAlias } from "./routes";

describe("resolveAlias", () => {
  it("traduit les anciennes adresses", () => {
    expect(resolveAlias("/simple")).toBe("/courses");
    expect(resolveAlias("/fun")).toBe("/envies");
    expect(resolveAlias("/simple/plats")).toBe("/matchs");
    expect(resolveAlias("/fun/liste")).toBe("/courses?vue=liste");
    expect(resolveAlias("/enfant/courses")).toBe("/courses");
    expect(resolveAlias("/courses")).toBeNull();
  });
});
