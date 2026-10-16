import { guessAisle, parseIngredientLine } from "./recipe-import";

export type Article = { name: string; quantity: number | null; unit: string; aisle: string };

/** « 2 kg pommes » → 2 kg de Pommes, rangées au rayon fruits et légumes. */
export function lireArticle(texte: string): Article | null {
  const clean = texte.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!clean) return null;
  const lu = parseIngredientLine(clean);
  if (lu) return { name: lu.name, quantity: lu.quantity, unit: lu.unit, aisle: lu.aisle };
  return { name: clean.charAt(0).toUpperCase() + clean.slice(1), quantity: null, unit: "", aisle: guessAisle(clean) };
}

/**
 * Une demande écrite en un seul message devient plusieurs articles :
 * « Des pâtes carbo, des céréales et du Nutella » → Pâtes carbo · Céréales · Nutella.
 */
export function articlesDe(texte: string): Article[] {
  return texte
    .split(/\s*(?:[,;\n+]|\s(?:et|puis)\s)\s*/i)
    .map((morceau) => morceau.replace(/^(?:(?:des|du|de la|un|une|le|la|les)\s+|(?:de l|d|l)['’]\s*)/i, ""))
    .map(lireArticle)
    .filter((a): a is Article => a !== null)
    .slice(0, 20);
}
