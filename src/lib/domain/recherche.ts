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

/** Le titre d'une recette lu dans son adresse (« …/recette_gratin-dauphinois_12345.aspx » → « gratin dauphinois »). */
export function titreDepuisLien(lien: string): string {
  return (lien.match(/recette_(.+?)_\d+\.aspx/)?.[1] ?? "").replace(/-/g, " ");
}

/** Ce qui rend le choix des recettes à lire personnel : une note (−1 à 1) pour un titre, et ce qui rapproche deux plats (pour varier). */
export type Perso = {
  note: (titre: string) => number;
  /** Une clé de ressemblance (le style du plat, par exemple) : on évite d'en lire trop d'une même clé d'un coup. */
  cle: (titre: string) => string;
  /** La part des lectures laissée à la découverte (au hasard, hors goûts connus). 0,3 par défaut. */
  exploration?: number;
};

/**
 * Parmi les recettes à voir (la file d'exploration), celles à lire maintenant : on écarte d'avance celles dont le titre (lu dans l'adresse) ressemble
 * déjà à un plat de la famille (elles seraient refusées après coup : inutile de les télécharger). Ensuite :
 * - sans `perso` : un tirage au hasard ;
 * - avec `perso` : surtout les mieux notées par les goûts de la famille (sans en lire trop d'un même style d'affilée), et une part de découverte au hasard,
 *   mêlée aux autres pour que les nouveautés ajoutées ne soient pas toutes du même genre.
 * Les écartées sont rendues pour qu'on ne les reconsidère pas.
 */
export function choisirALire(
  aVoir: string[],
  titres: string[],
  max: number,
  seuil: number,
  hasard: () => number = Math.random,
  perso?: Perso,
): { aLire: string[]; ecartees: string[] } {
  const ecartees: string[] = [];
  const restantes: string[] = [];
  for (const l of new Set(aVoir)) (tropProche(titreDepuisLien(l), titres, seuil) ? ecartees : restantes).push(l);
  // Mélange de Fisher-Yates : la file n'est pas lue dans l'ordre où elle a été découverte (sinon, toujours les mêmes familles de plats).
  for (let i = restantes.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [restantes[i], restantes[j]] = [restantes[j], restantes[i]];
  }
  if (!perso) return { aLire: restantes.slice(0, max), ecartees };

  const part = Math.min(0.9, Math.max(0, perso.exploration ?? 0.3));
  const nDecouverte = Math.round(max * part);
  const nGouts = max - nDecouverte;
  // Les mieux notées, avec un malus par plat de même clé déjà retenu (pas dix burgers d'affilée) ; le hasard du mélange départage les égalités.
  const notees = restantes.map((l) => ({ l, titre: titreDepuisLien(l), note: perso.note(titreDepuisLien(l)) }));
  const retenues: string[] = [];
  const parCle = new Map<string, number>();
  const pris = new Set<string>();
  while (retenues.length < nGouts) {
    let meilleur: (typeof notees)[number] | null = null;
    let meilleurScore = -Infinity;
    for (const c of notees) {
      if (pris.has(c.l)) continue;
      const score = c.note - 0.12 * (parCle.get(perso.cle(c.titre)) ?? 0);
      if (score > meilleurScore) (meilleur = c), (meilleurScore = score);
    }
    if (!meilleur) break;
    pris.add(meilleur.l);
    retenues.push(meilleur.l);
    const k = perso.cle(meilleur.titre);
    parCle.set(k, (parCle.get(k) ?? 0) + 1);
  }
  const decouverte = restantes.filter((l) => !pris.has(l)).slice(0, nDecouverte);
  // Mêlées : une découverte toutes les 1/part lectures, pour que la part de découverte soit lue même quand les goûts suffisent à remplir.
  const pas = part > 0 ? Math.max(2, Math.round(1 / part)) : Infinity;
  const aLire: string[] = [];
  let g = 0;
  let d = 0;
  while (g < retenues.length || d < decouverte.length) {
    const tourDecouverte = (aLire.length + 1) % pas === 0;
    if ((tourDecouverte && d < decouverte.length) || g >= retenues.length) aLire.push(decouverte[d++]);
    else aLire.push(retenues[g++]);
  }
  return { aLire, ecartees };
}
