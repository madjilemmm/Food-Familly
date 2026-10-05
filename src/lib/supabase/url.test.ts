import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl } from "./url";

describe("normalizeSupabaseUrl", () => {
  it("garde une URL correcte", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co")).toBe("https://abc.supabase.co");
  });
  it("retire les / finaux, espaces et suffixes d'API", () => {
    expect(normalizeSupabaseUrl(" https://abc.supabase.co/ ")).toBe("https://abc.supabase.co");
    expect(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1/")).toBe("https://abc.supabase.co");
    expect(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1")).toBe("https://abc.supabase.co");
  });
});
