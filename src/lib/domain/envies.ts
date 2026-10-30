import { normalizeName } from "./shopping-list";

/*
 * Les envies de chacun (écran « Tes envies » du questionnaire) et ce qui fait
 * un plat « pour jeunes ». Elles décident quels plats l'appli va chercher sur
 * Marmiton et lesquels passent en tête du paquet.
 */

export type Temps = "30" | "60" | "any";
export type Piquant = "non" | "un_peu" | "oui";
export type Envies = { styles: string[]; temps: Temps; piquant: Piquant };

export const ENVIES_VIDES: Envies = { styles: [], temps: "any", piquant: "un_peu" };

type Style = {
  key: string;
  label: string;
  /** Mots qui trahissent ce style dans le titre ou les ingrédients. */
  words: string[];
  /** Recherches Marmiton pour en trouver. */
  recherches: string[];
};

export const STYLES: Style[] = [
  {
    key: "street_food",
    label: "Burgers, street food",
    words: ["burger", "cheeseburger", "hot dog", "kebab", "nugget", "frite", "croque", "panini", "sandwich", "wrap", "bagel", "fish and chips", "tenders", "poulet frit"],
    recherches: ["burger maison", "cheeseburger", "smash burger", "kebab maison", "nuggets maison", "croque monsieur", "wrap poulet", "tenders poulet", "hot dog", "panini"],
  },
  {
    key: "pates",
    label: "Pâtes",
    words: ["pate", "spaghetti", "tagliatelle", "penne", "linguine", "fusilli", "macaroni", "coquillette", "lasagne", "carbonara", "bolognaise", "ravioli", "gnocchi", "one pot pasta"],
    recherches: ["pates carbonara", "spaghetti bolognaise", "lasagnes", "one pot pasta", "pates au poulet", "gratin de pates", "macaroni au fromage", "pates au saumon"],
  },
  {
    key: "pizza",
    label: "Pizza, tartes, quiches",
    words: ["pizza", "calzone", "quiche", "tarte salee", "flammekueche", "tarte flambee", "croziflette"],
    recherches: ["pizza maison", "quiche lorraine", "flammekueche", "calzone", "pizza poulet"],
  },
  {
    key: "mexicain",
    label: "Mexicain",
    words: ["taco", "fajita", "burrito", "quesadilla", "enchilada", "chili", "nacho", "guacamole"],
    recherches: ["tacos", "fajitas poulet", "chili con carne", "burritos", "quesadillas", "enchiladas"],
  },
  {
    key: "asiatique",
    label: "Asiatique",
    words: ["wok", "riz cantonais", "nouille", "pad thai", "teriyaki", "sushi", "ramen", "nem", "poulet coco", "curry", "sauce soja", "bo bun", "poke", "gyoza", "yakitori", "riz frit"],
    recherches: ["poulet curry coco", "riz cantonais", "wok de poulet", "pad thai", "nouilles sautees", "poulet teriyaki", "bo bun", "poke bowl", "poulet au caramel"],
  },
  {
    key: "grand_mere",
    label: "Plats de grand-mère",
    words: ["blanquette", "bourguignon", "pot au feu", "hachis parmentier", "gratin dauphinois", "potee", "tartiflette", "raclette", "boeuf carotte", "poule au pot", "roti", "cassoulet", "choucroute", "pot-au-feu", "puree", "gratin"],
    recherches: ["hachis parmentier", "gratin dauphinois", "tartiflette", "boeuf bourguignon", "poulet roti", "blanquette de veau", "croziflette", "parmentier de canard"],
  },
  {
    key: "grillades",
    label: "Grillades, barbecue",
    words: ["barbecue", "bbq", "grille", "brochette", "plancha", "cote de boeuf", "ribs", "merguez", "chipolata", "travers"],
    recherches: ["brochettes de poulet", "ribs", "travers de porc caramelises", "poulet barbecue", "plancha"],
  },
  {
    key: "vege",
    label: "Végé",
    words: ["vegetarien", "vegetarienne", "vege", "falafel", "lentille", "pois chiche", "tofu", "dahl", "risotto"],
    recherches: ["risotto champignons", "curry de pois chiches", "dahl de lentilles", "lasagnes vegetariennes", "falafels"],
  },
  {
    key: "poisson",
    label: "Poisson",
    words: ["poisson", "saumon", "thon", "cabillaud", "crevette", "fish", "colin"],
    recherches: ["saumon au four", "pave de saumon", "fish and chips", "crevettes a l ail", "poisson pane"],
  },
];

/** Recherches de base : ce que les ados et les jeunes mangent volontiers. */
export const RECHERCHES_JEUNES = [
  "burger maison", "tacos", "pates carbonara", "lasagnes", "poulet curry coco", "wrap poulet", "fajitas poulet",
  "pizza maison", "croque monsieur", "gratin dauphinois", "riz cantonais", "cordon bleu", "chili con carne",
  "hachis parmentier", "poulet roti", "spaghetti bolognaise", "nuggets maison", "quesadillas", "tartiflette",
  "one pot pasta", "poulet au curry", "croziflette", "kebab maison", "gratin de pates", "pates au poulet",
];

/** Plus de vocabulaire : des plats et des ingrédients variés, pour que les recherches ne tournent pas toujours autour des mêmes plats. */
export const RECHERCHES_VARIEES = [
  "poulet a la creme", "poulet basquaise", "poulet au citron", "poulet moutarde", "blanc de poulet champignons", "cuisses de poulet au four", "poulet tikka",
  "boulettes de boeuf", "boeuf aux oignons", "steak hache gratine", "tomates farcies", "poivrons farcies", "courgettes farcies", "paupiettes de veau",
  "saute de porc", "filet mignon moutarde", "travers de porc", "saucisses lentilles", "endives au jambon", "cordon bleu maison",
  "saumon a la creme", "saumon en papillote", "cabillaud au four", "crevettes curry", "moules frites", "gratin de poisson", "thon a la tomate",
  "gratin de courgettes", "gratin de chou fleur", "gratin de brocolis", "gratin de pommes de terre", "puree et saucisse", "pommes de terre farcies",
  "risotto poulet", "risotto aux legumes", "riz sauté aux legumes", "semoule couscous", "tajine de poulet", "boulgour legumes",
  "pates aux legumes", "pates au pesto", "pates courgettes", "penne a la tomate", "tagliatelles saumon", "raviolis gratines", "gnocchis gratines",
  "omelette garnie", "tortilla", "galette complete", "crepes salees", "wraps legumes", "tarte aux legumes", "tarte au thon", "pizza blanche",
  "soupe de legumes", "veloute de potiron", "curry de legumes", "chili sin carne", "lentilles saucisse", "pois chiches epices", "falafels", "dahl",
  "nems", "bo bun", "sushi maison", "poke bowl saumon", "pad thai", "boeuf teriyaki", "porc au caramel", "nouilles sautees poulet",
  "fajitas", "burrito", "quesadilla", "tacos de poulet", "nachos gratines", "enchiladas", "chili con carne",
  "salade de pates", "salade de riz", "salade de poulet", "salade cesar", "taboule",
  "hamburger maison", "hot dog maison", "croque madame", "sandwich poulet", "bagel saumon", "quiche poireaux", "quiche saumon epinards",
];

/** Dans le titre : pas pour des ados (régime, abats, plats « d'adulte »). */
const PAS_POUR_JEUNES = [
  "leger", "legere", "light", "minceur", "detox", "regime", "sans matiere grasse", "allege", "ww", "weight watcher", "healthy", "dietetique",
  "joue", "tripe", "rognon", "cervelle", "ris de veau", "langue", "pied de", "tete de veau", "andouillette", "foie", "gesier", "boudin",
  "escargot", "grenouille", "chevreuil", "sanglier", "gibier", "pigeon", "caille", "lapin", "anguille", "huitre", "oursin", "bulot",
  "chou fleur", "navet", "topinambour", "panais", "cardon", "blette", "rutabaga", "salsifis", "endive", "celeri rave",
  "veloute", "soupe", "aspic", "terrine", "gelee",
];

const pad = (s: string) => ` ${normalizeName(s)} `;
const contient = (texte: string, mots: string[]) => {
  const t = pad(texte);
  return mots.some((m) => t.includes(pad(m)));
};

/** Un titre qu'un ado ne regarderait pas (« Chou-fleur gratiné léger », « Joue de porc »…) ? */
export function pourJeunes(titre: string): boolean {
  return !contient(titre, PAS_POUR_JEUNES);
}

/** La recette correspond à un des styles aimés ? */
export function correspondAuxStyles(texte: string[], styles: string[]): boolean {
  const choisis = STYLES.filter((s) => styles.includes(s.key));
  return choisis.some((s) => texte.some((ligne) => contient(ligne, s.words)));
}

/** Le style d'un plat (le premier reconnu), pour varier le paquet ; null si aucun. */
export function styleDe(texte: string[]): string | null {
  return STYLES.find((s) => texte.some((ligne) => contient(ligne, s.words)))?.key ?? null;
}

/** Durée maximale acceptable pour la famille : la plus pressée l'emporte, avec un peu de marge. */
export function dureeMax(envies: Envies[]): number {
  if (envies.some((e) => e.temps === "30")) return 45;
  if (envies.some((e) => e.temps === "60")) return 75;
  return 150;
}

/** Les recherches Marmiton à faire pour la famille : ses styles d'abord, puis les classiques des jeunes. */
export function recherchesPour(envies: Envies[]): string[] {
  const styles = new Set(envies.flatMap((e) => e.styles));
  const aimees = STYLES.filter((s) => styles.has(s.key)).flatMap((s) => s.recherches);
  return [...new Set([...aimees, ...aimees, ...RECHERCHES_JEUNES, ...RECHERCHES_VARIEES])];
}

/** Lit des envies enregistrées (jsonb), en tolérant les données incomplètes. */
export function lireEnvies(raw: unknown): Envies {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const keys = new Set(STYLES.map((s) => s.key));
  return {
    styles: Array.isArray(o.styles) ? o.styles.filter((s): s is string => typeof s === "string" && keys.has(s)) : [],
    temps: o.temps === "30" || o.temps === "60" ? o.temps : "any",
    piquant: o.piquant === "non" || o.piquant === "oui" ? o.piquant : "un_peu",
  };
}
