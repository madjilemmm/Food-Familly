import { describe, expect, it } from "vitest";
import { lirePages } from "./pages";

/** Une base de `n` lignes qui, comme l'API, ne rend jamais plus de `plafond` lignes d'une requête. */
const base = (n: number, plafond = 1000) => {
  const appels: [number, number][] = [];
  const page = async (de: number, a: number) => {
    appels.push([de, a]);
    const fin = Math.min(a, de + plafond - 1, n - 1);
    return { data: Array.from({ length: Math.max(0, fin - de + 1) }, (_, i) => de + i), error: null };
  };
  return { page, appels };
};

describe("lirePages : lire toutes les lignes, même au-delà du plafond de l'API", () => {
  it("moins d'une page : une seule requête", async () => {
    const { page, appels } = base(250);
    expect(await lirePages(page)).toHaveLength(250);
    expect(appels).toEqual([[0, 999]]);
  });
  it("plus de 1 000 lignes : rien n'est perdu", async () => {
    const { page } = base(2500);
    const lignes = await lirePages(page);
    expect(lignes).toHaveLength(2500);
    expect(lignes[0]).toBe(0);
    expect(lignes[2499]).toBe(2499);
    expect(new Set(lignes).size).toBe(2500);
  });
  it("une page pleine pile : une page de plus pour s'en assurer", async () => {
    const { page, appels } = base(1000);
    expect(await lirePages(page)).toHaveLength(1000);
    expect(appels).toEqual([[0, 999], [1000, 1999]]);
  });
  it("aucune ligne", async () => {
    expect(await lirePages(base(0).page)).toEqual([]);
  });
  it("une erreur de la base n'est pas avalée", async () => {
    await expect(lirePages(async () => ({ data: null, error: { message: "boum" } }))).rejects.toThrow("boum");
  });
});
