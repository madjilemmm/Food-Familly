import { STYLES, recherchesPour, type Envies } from "./envies";
import { normalizeName } from "./shopping-list";

/*
 * Ce que Kaddie cherche sur Marmiton quand le paquet s'épuise :
 * - les styles que la famille aime vraiment (appris de ses swipes), pas seulement ceux du questionnaire ;
 * - des plats voisins de ses matchs récents (« tacos au poulet » → d'autres tacos) ;
 * - un peu de saison (raclette en hiver, salades en été) ;
 * puis les envies déclarées. Et jamais un quasi-doublon d'un plat déjà là.
 */

/** Quelques plats de saison, par mois (janvier = 0). */
const SAISON: string[][] = [
  ["raclette", "tartiflette", "pot au feu", "soupe"],
  ["raclette", "tartiflette", "hachis parmentier", "crepes salees"],
  ["blanquette", "gratin", "quiche"],
  ["poulet roti", "lasagnes", "risotto"],
  ["salade composee", "wraps", "poulet curry"],
  ["salade de pates", "burger", "tacos"],
  ["salade composee", "brochettes", "tomates farcies"],
  ["taboule", "salade de riz", "grillades"],
  ["ratatouille", "tomates farcies", "lasagnes"],
  ["risotto champignons", "gratin", "quiche"],
  ["soupe", "parmentier", "chili con carne"],
  ["raclette", "fondue", "pot au feu", "tartiflette"],
];

export function termesDeRecherche({
  envies,
  stylesAimes,
  matchs,
  mois,
}: {
  envies: Envies[];
  /** Les styles les plus aimés par la famille (profil de goûts), les meilleurs d'abord. */
  stylesAimes: string[];
  /** Les titres des matchs et envies récents. */
  matchs: string[];
  mois: number;
}): string[] {
  const aimes = stylesAimes.flatMap((k) => STYLES.find((s) => s.key === k)?.recherches.slice(0, 3) ?? []);
  const voisins = matchs.slice(0, 3).map((t) => normalizeName(t).split(" ").slice(0, 3).join(" "));
  return [...new Set([...voisins, ...aimes, ...(SAISON.at(mois % 12) ?? []), ...recherchesPour(envies)])].filter(Boolean);
}

const mots = (titre: string) => new Set(normalizeName(titre).split(" ").filter((m) => m.length > 2));

/** Deux titres trop proches (« Gratin dauphinois » / « Gratin dauphinois facile ») : le second n'apporte rien. */
export function tropProche(titre: string, existants: string[], seuil = 0.6): boolean {
  const a = mots(titre);
  if (a.size === 0) return false;
  return existants.some((t) => {
    const b = mots(t);
    const communs = [...a].filter((m) => b.has(m)).length;
    return communs / new Set([...a, ...b]).size >= seuil;
  });
}
