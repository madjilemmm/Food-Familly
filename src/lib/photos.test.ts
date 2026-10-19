import { describe, expect, it } from "vitest";
import { photoALaTaille } from "./photos";

describe("photoALaTaille", () => {
  it("réduit une photo Marmiton carrée", () => {
    expect(photoALaTaille("https://assets.afcdn.com/recipe/20121106/14699_w1024h1024c1cx256cy192.jpg", 240)).toBe(
      "https://assets.afcdn.com/recipe/20121106/14699_w240h240c1cx256cy192.jpg",
    );
  });
  it("réduit une photo Marmiton recadrée", () => {
    expect(photoALaTaille("https://assets.afcdn.com/recipe/20190529/93191_w1024cx4330cy2886cxt0cyt0cxb8660cyb5773.webp", 240)).toBe(
      "https://assets.afcdn.com/recipe/20190529/93191_w240cx4330cy2886cxt0cyt0cxb8660cyb5773.webp",
    );
  });
  it("ne touche pas aux photos de la famille ni aux adresses inattendues", () => {
    const supabase = "https://xyz.supabase.co/storage/v1/object/public/photos/abc_w1024.jpg";
    expect(photoALaTaille(supabase, 240)).toBe(supabase);
    expect(photoALaTaille("https://assets.afcdn.com/recipe/sans-taille.jpg", 240)).toBe("https://assets.afcdn.com/recipe/sans-taille.jpg");
  });
});
