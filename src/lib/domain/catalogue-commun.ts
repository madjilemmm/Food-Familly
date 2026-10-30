import { styleDe } from "./envies";
import { tropProche } from "./recherche";
import { normalizeName } from "./shopping-list";

/*
 * Le catalogue commun : des recettes que Kaddie a le droit de proposer à toutes les familles, issues de sources autorisées.
 * Une recette n'y entre que si elle est COMPLÈTE (photo, ingrédients, étapes) et si on sait d'où elle vient et sous quelle licence.
 * Ce fichier ne touche pas à la base : la règle d'admission, et le tirage des recettes à proposer à une famille (varié, sans doublon).
 */

export type RecetteCatalogue = {
  source: string;
  sourceId: string;
  titre: string;
  photoUrl: string;
  /** Qui a fait la photo et sous quelle licence (à afficher quand la licence l'exige). */
  photoAuteur: string | null;
  photoLicence: string;
  texteLicence: string;
  /** Où l'on retrouve la recette d'origine, et la mention à afficher. */
  attributionUrl: string;
  attributionTexte: string;
  minutes: number | null;
  portions: number | null;
  /** Les étapes, dans l'ordre. */
  etapes: string[];
  /** Les ingrédients, une ligne chacun, en français (« 400 g de spaghetti »). */
  ingredients: string[];
  cuisine: string | null;
  langue: string;
};

/** Les licences qu'on accepte, pour la photo comme pour le texte. Toute autre valeur est refusée : pas de licence connue, pas de recette. */
export const LICENCES_ADMISES = ["CC0", "PD", "CC-BY", "CC-BY-SA", "LICENCE-OUVERTE", "API-AUTORISEE", "KADDIE"] as const;

const SITES_EXCLUS = ["marmiton.org", "afcdn.com"];

/**
 * Ce qui empêche d'admettre une recette ; vide = admise. La photo est obligatoire (adresse https, jamais d'un site dont on n'a pas les droits),
 * comme les ingrédients (au moins 3) et les étapes (au moins 2) : sans eux, la recette n'est pas utilisable pour cuisiner ni pour faire la liste.
 */
export function motifsDeRefus(r: RecetteCatalogue): string[] {
  const motifs: string[] = [];
  if (!/^https:\/\/[^/\s]+\/\S+$/.test(r.photoUrl)) motifs.push("photo absente ou pas en https");
  else if (SITES_EXCLUS.some((s) => new URL(r.photoUrl).hostname.endsWith(s))) motifs.push("photo d'un site sans autorisation");
  if (!(LICENCES_ADMISES as readonly string[]).includes(r.photoLicence)) motifs.push("licence de la photo inconnue");
  if (!(LICENCES_ADMISES as readonly string[]).includes(r.texteLicence)) motifs.push("licence du texte inconnue");
  if (r.ingredients.filter((i) => i.trim().length > 1).length < 3) motifs.push("moins de 3 ingrédients");
  if (r.etapes.filter((e) => e.trim().length > 10).length < 2) motifs.push("moins de 2 étapes");
  if (r.titre.trim().length < 3 || r.titre.length > 90) motifs.push("titre inutilisable");
  if (!/^https:\/\//.test(r.attributionUrl) || r.attributionTexte.trim().length < 3) motifs.push("origine non indiquée");
  if (r.langue !== "fr") motifs.push("pas en français");
  return motifs;
}

/** La ligne de crédit à afficher sur la recette : l'origine du texte, et la photo quand sa licence demande une mention. */
export function creditDeLaRecette(r: Pick<RecetteCatalogue, "attributionTexte" | "photoAuteur" | "photoLicence">): string {
  const photo = r.photoAuteur && r.photoLicence !== "KADDIE" && r.photoLicence !== "API-AUTORISEE" ? ` Photo : ${r.photoAuteur} (${r.photoLicence}).` : "";
  return `${r.attributionTexte}.${photo}`;
}

// ─── Ce que contient une recette : de quoi varier ───────────────────────

const PROTEINES: [string, string[]][] = [
  ["poulet", ["poulet", "dinde", "volaille", "cuisse", "blanc de poulet"]],
  ["boeuf", ["boeuf", "steak", "viande hachee", "paleron", "bourguignon"]],
  ["porc", ["porc", "lardon", "jambon", "saucisse", "chorizo", "bacon", "lard"]],
  ["agneau", ["agneau", "gigot"]],
  ["poisson", ["saumon", "cabillaud", "thon", "poisson", "colin", "crevette", "moule", "merlu"]],
  ["vege", ["lentille", "pois chiche", "tofu", "haricot rouge", "oeuf", "halloumi"]],
];

/** La protéine principale d'une recette (la première reconnue dans les ingrédients), pour ne pas proposer cinq plats de poulet d'affilée. */
export function proteineDe(ingredients: string[]): string | null {
  const t = ` ${ingredients.map(normalizeName).join(" ")} `;
  return PROTEINES.find(([, mots]) => mots.some((m) => t.includes(` ${normalizeName(m)} `)))?.[0] ?? null;
}

export type CandidatCatalogue = RecetteCatalogue & { id: string };

/**
 * Les recettes à ajouter à une famille. Dans l'ordre :
 * 1. rien qui ressemble à un plat déjà là (même titre à quelques mots près) ;
 * 2. un score : un peu de hasard, un bonus pour les styles que la famille aime, jamais décisif ;
 * 3. une sélection gloutonne qui pénalise ce qui ressemble déjà à ce qu'on vient de choisir (même style, même protéine, même cuisine, même type de plat : « risotto », « gratin »…) :
 *    pas cinq risottos de suite, et au moins une recette sur quatre HORS des styles aimés (la découverte).
 * Les contraintes de sécurité (allergies, régimes) sont appliquées AVANT, par l'appelant : ce tirage n'y touche pas.
 */
export function choisirDansLeCatalogue({
  candidats,
  titresDeLaFamille,
  stylesAimes,
  combien,
  hasard = Math.random,
}: {
  candidats: CandidatCatalogue[];
  titresDeLaFamille: string[];
  stylesAimes: string[];
  combien: number;
  hasard?: () => number;
}): CandidatCatalogue[] {
  const titres = [...titresDeLaFamille];
  const profil = (c: CandidatCatalogue) => ({ style: styleDe([c.titre, ...c.ingredients]), proteine: proteineDe(c.ingredients), cuisine: c.cuisine, type: normalizeName(c.titre).split(" ")[0] || null });
  const restants = candidats
    .filter((c) => !tropProche(c.titre, titres))
    .map((c) => ({ c, p: profil(c), base: hasard() + (styleDe([c.titre, ...c.ingredients]) && stylesAimes.includes(styleDe([c.titre, ...c.ingredients])!) ? 0.35 : 0) }));
  const choisis: typeof restants = [];
  const decouvertesVoulues = Math.floor(combien / 4);
  while (choisis.length < combien && restants.length) {
    const nbDecouvertes = choisis.filter((x) => !x.p.style || !stylesAimes.includes(x.p.style)).length;
    const manque = nbDecouvertes < decouvertesVoulues && combien - choisis.length <= decouvertesVoulues - nbDecouvertes;
    let meilleur = -1;
    let meilleurScore = -Infinity;
    restants.forEach((x, i) => {
      if (tropProche(x.c.titre, titres)) return;
      if (manque && x.p.style && stylesAimes.includes(x.p.style)) return;
      const pareils = (k: "style" | "proteine" | "cuisine" | "type") => (x.p[k] ? choisis.filter((y) => y.p[k] === x.p[k]).length : 0);
      const score = x.base - 0.45 * pareils("style") - 0.35 * pareils("proteine") - 0.25 * pareils("cuisine") - 0.6 * pareils("type");
      if (score > meilleurScore) (meilleur = i), (meilleurScore = score);
    });
    if (meilleur < 0) break;
    const [pris] = restants.splice(meilleur, 1);
    choisis.push(pris);
    titres.push(pris.c.titre);
  }
  return choisis.map((x) => x.c);
}
