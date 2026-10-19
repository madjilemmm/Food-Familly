import { lireSaisie, type Appris } from "./reconnaissance";

export type Article = { name: string; quantity: number | null; unit: string; aisle: string };

/**
 * « 2 kg pommes » → 2 kg de Pommes, rangées au rayon fruits et légumes ; « PQ » → Papier toilette.
 * Le catalogue et ce que la famille a appris passent d'abord (voir reconnaissance.ts).
 */
export function lireArticle(texte: string, appris: Appris = {}): Article | null {
  const lu = lireSaisie(texte, appris);
  return lu && { name: lu.nom.slice(0, 100), quantity: lu.quantite, unit: lu.unite, aisle: lu.rayon };
}

/**
 * Une demande écrite en un seul message devient plusieurs articles :
 * « Des pâtes carbo, des céréales et du Nutella » → Pâtes carbo · Céréales · Nutella.
 */
export function articlesDe(texte: string, appris: Appris = {}): Article[] {
  return texte
    .split(/\s*(?:[,;\n+]|\s(?:et|puis)\s)\s*/i)
    .map((morceau) => morceau.replace(/^(?:(?:des|du|de la|un|une|le|la|les)\s+|(?:de l|d|l)['’]\s*)/i, ""))
    .map((morceau) => lireArticle(morceau, appris))
    .filter((a): a is Article => a !== null)
    .slice(0, 20);
}
