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

type EntreesRecherche = {
  envies: Envies[];
  /** Les styles les plus aimés par la famille (profil de goûts), les meilleurs d'abord. */
  stylesAimes: string[];
  /** Les titres des matchs et envies récents. */
  matchs: string[];
  mois: number;
};

/** Ce que cette famille a montré aimer : des plats voisins de ses matchs, puis ses styles préférés. */
export function termesPersonnalises({ stylesAimes, matchs }: Pick<EntreesRecherche, "stylesAimes" | "matchs">): string[] {
  const aimes = stylesAimes.flatMap((k) => STYLES.find((s) => s.key === k)?.recherches.slice(0, 3) ?? []);
  const voisins = matchs.slice(0, 3).map((t) => normalizeName(t).split(" ").slice(0, 3).join(" "));
  return [...new Set([...voisins, ...aimes])].filter(Boolean);
}

/** Tout le reste : la saison, les styles déclarés, les classiques des jeunes. */
export function termesGeneriques({ envies, mois }: Pick<EntreesRecherche, "envies" | "mois">): string[] {
  return [...new Set([...(SAISON.at(mois % 12) ?? []), ...recherchesPour(envies)])].filter(Boolean);
}

export function termesDeRecherche(e: EntreesRecherche): string[] {
  return [...new Set([...termesPersonnalises(e), ...termesGeneriques(e)])];
}

/**
 * Les recherches d'un import : les termes personnalisés d'abord (au plus la moitié), puis des termes tirés au sort parmi tous les autres.
 * Avant, les deux premiers termes (la saison) étaient les mêmes à chaque import : leurs premiers résultats, toujours identiques,
 * occupaient la moitié des recherches. Le tirage change à chaque import, donc la source est interrogée sur tout son vocabulaire.
 * `aEviter` : les recherches qui n'ont rien donné récemment (même les personnalisées : en production, deux d'entre elles revenaient
 * à chaque import et ne trouvaient plus rien).
 */
export function choisirTermes(e: EntreesRecherche, combien: number, hasard: () => number = Math.random, aEviter: Set<string> = new Set()): string[] {
  const perso = termesPersonnalises(e).filter((t) => !aEviter.has(t)).slice(0, Math.floor(combien / 2));
  const reste = termesDeRecherche(e).filter((t) => !perso.includes(t) && !aEviter.has(t));
  const a = [...reste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return [...perso, ...a].slice(0, combien);
}

/**
 * Les recettes importées qu'on peut oublier : celles que PERSONNE n'a jamais swipées (ni « Miam », ni « Bof »), vieilles de `joursMax`
 * jours, et qui ne sont dans aucune course. Une recette avec un seul avis reste : c'est la mémoire des refus (un « Bof » effacé,
 * le même plat revenait comme une nouveauté) et des goûts. Supprimer une recette supprime ses avis (clé étrangère en cascade).
 */
export function recettesAOublier(
  importees: { id: string; creeLe: number }[],
  avecAvis: Set<string>,
  dansUneCourse: Set<string>,
  maintenant: number,
  joursMax = 28,
): string[] {
  const limite = maintenant - joursMax * 86_400_000;
  return importees.filter((r) => r.creeLe < limite && !avecAvis.has(r.id) && !dansUneCourse.has(r.id)).map((r) => r.id);
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
