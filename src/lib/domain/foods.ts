import { normalizeName } from "./shopping-list";

/*
 * Les goûts de la famille : un dictionnaire d'aliments et de régimes, et la
 * règle qui décide si une recette est cachée, mise en fin ou en tête de paquet.
 * Comparaison mot à mot sur les noms normalisés (accents, pluriels), comme les
 * rayons : « poivre » n'est pas du « poivron ». Les exceptions (« huile d'olive »
 * n'est pas une olive) sont retirées du texte avant de chercher.
 */

export type TasteLevel = "interdit" | "pas_fan" | "adore";

export type Food = {
  key: string;
  label: string;
  /** Synonymes et ingrédients qui trahissent l'aliment. */
  words: string[];
  /** Expressions à ignorer (« lait de coco » n'est pas du lactose). */
  except?: string[];
};

const PORC = ["porc", "lardon", "jambon", "chorizo", "saucisse", "saucisson", "bacon", "pancetta", "rillette", "coppa", "lard", "poitrine fumee", "chair a saucisse", "andouille", "andouillette", "boudin", "cervelas", "mortadelle", "prosciutto", "speck", "travers de porc", "echine de porc", "knack", "chipolata", "salami", "rosette"];
const PORC_SAUF = ["jambon de dinde", "jambon de poulet", "lardons de volaille", "lardons de dinde", "saucisse de volaille", "saucisse vegetale", "bacon de dinde"];
const POISSON = ["poisson", "saumon", "thon", "cabillaud", "colin", "merlu", "lieu noir", "lieu jaune", "dorade", "daurade", "bar", "truite", "sardine", "maquereau", "hareng", "anchois", "sole", "lotte", "haddock", "morue", "raie", "rouget", "tilapia", "pangasius", "espadon", "eglefin", "surimi", "brandade", "loup de mer", "flétan"];
const FRUITS_DE_MER = ["fruits de mer", "crevette", "gambas", "moule", "huitre", "homard", "langouste", "langoustine", "crabe", "saint jacques", "st jacques", "calamar", "encornet", "seiche", "poulpe", "palourde", "bulot", "bigorneau", "ecrevisse", "tourteau", "praire"];
const VIANDE = [...PORC, "viande", "boeuf", "veau", "poulet", "dinde", "volaille", "agneau", "mouton", "canard", "magret", "lapin", "steak", "escalope", "bavette", "entrecote", "faux filet", "paleron", "macreuse", "joue de boeuf", "gigot", "merguez", "kebab", "cordon bleu", "nugget", "pintade", "caille", "oie", "gibier", "chevreuil", "sanglier", "cheval", "foie", "foie gras", "rognon", "gesier", "bouillon de volaille", "bouillon de boeuf", "fond de veau", "fond de volaille", "gelatine", "osso bucco", "blanquette", "bourguignon"];

/** Régimes et allergies : niveau « interdit », pour toute la famille. */
export const DIETS: Food[] = [
  { key: "vegetarien", label: "Végétarien", words: [...VIANDE, ...POISSON, ...FRUITS_DE_MER], except: ["saucisse vegetale", "steak vegetal", "steak de soja"] },
  { key: "sans_porc", label: "Sans porc", words: PORC, except: PORC_SAUF },
  {
    key: "sans_gluten",
    label: "Sans gluten",
    words: ["gluten", "farine", "ble", "pate", "pain", "baguette", "brioche", "chapelure", "semoule", "couscous", "boulgour", "orge", "seigle", "epeautre", "biere", "biscuit", "spaghetti", "tagliatelle", "lasagne", "penne", "coquillette", "macaroni", "fusilli", "linguine", "ravioli", "gnocchi", "nouille", "vermicelle", "croissant", "crepe", "pizza", "tortilla", "wrap", "cracker", "panure", "pane", "chapati", "naan", "galette de ble"],
    except: ["farine de riz", "farine de mais", "farine de sarrasin", "farine de pois chiche", "farine sans gluten", "pain sans gluten", "pate sans gluten", "nouille de riz", "vermicelle de riz", "galette de riz", "tortilla de mais", "pate de curry", "pate d amande", "pate de sesame", "pate d arachide", "pate de tomate"],
  },
  {
    key: "sans_lactose",
    label: "Sans lactose",
    words: ["lactose", "lait", "creme", "creme fraiche", "beurre", "fromage", "yaourt", "yogourt", "gruyere", "emmental", "comte", "parmesan", "mozzarella", "feta", "ricotta", "mascarpone", "raclette", "reblochon", "camembert", "roquefort", "cheddar", "bechamel", "brie", "mimolette", "chevre", "fromage blanc", "petit suisse", "cancoillotte", "burrata", "gorgonzola", "munster", "maroilles", "tomme", "beaufort", "cantal", "bleu", "boursin", "kiri", "lait concentre"],
    except: ["lait de coco", "creme de coco", "lait d amande", "lait de soja", "lait d avoine", "lait de riz", "creme de soja", "beurre de cacahuete", "beurre d arachide", "beurre de cacao", "creme de marron", "sans lactose", "beurre vegetal", "creme vegetale"],
  },
  { key: "arachide", label: "Arachides", words: ["arachide", "cacahuete", "beurre de cacahuete", "beurre d arachide"] },
  {
    key: "fruits_a_coque",
    label: "Fruits à coque",
    words: ["noix", "noisette", "amande", "pistache", "cajou", "pecan", "macadamia", "noix du bresil", "praline", "pralin", "nougat", "frangipane", "pate d amande", "gianduja", "nutella"],
    except: ["noix de coco", "noix de muscade", "noix de saint jacques", "noix de st jacques", "noix de veau", "noix de beurre", "noix de jambon"],
  },
  { key: "fruits_de_mer", label: "Fruits de mer", words: FRUITS_DE_MER },
  { key: "poisson", label: "Poisson", words: POISSON },
  { key: "oeufs", label: "Œufs", words: ["oeuf", "jaune d oeuf", "blanc d oeuf", "mayonnaise", "meringue", "omelette", "quiche"] },
];

/** Les cartes du questionnaire : « j'aime pas », « ça me va » ou « j'adore ». */
export const INGREDIENTS: Food[] = [
  { key: "canard", label: "Canard", words: ["canard", "magret", "aiguillette de canard", "confit de canard", "cuisse de canard"] },
  { key: "champignons", label: "Champignons", words: ["champignon", "cepe", "girolle", "morille", "shiitake", "pleurote", "chanterelle", "trompette de la mort"] },
  { key: "poisson", label: "Poisson", words: POISSON },
  { key: "fruits_de_mer", label: "Fruits de mer", words: FRUITS_DE_MER },
  { key: "epinards", label: "Épinards", words: ["epinard"] },
  { key: "chou", label: "Chou", words: ["chou", "chou fleur", "chou rouge", "chou vert", "chou de bruxelles", "choucroute", "chou chinois"], except: ["chou a la creme", "pate a chou"] },
  { key: "brocoli", label: "Brocoli", words: ["brocoli"] },
  { key: "aubergine", label: "Aubergine", words: ["aubergine", "moussaka", "caviar d aubergine"] },
  { key: "poivron", label: "Poivron", words: ["poivron", "piperade"] },
  { key: "coriandre", label: "Coriandre", words: ["coriandre"] },
  { key: "piment", label: "Piment", words: ["piment", "harissa", "tabasco", "jalapeno", "sriracha", "chili", "pili pili"] },
  { key: "fromage_fort", label: "Fromage fort", words: ["fromage fort", "roquefort", "gorgonzola", "munster", "maroilles", "livarot", "epoisse", "fourme d ambert", "bleu d auvergne", "stilton", "bleu"] },
  { key: "olives", label: "Olives", words: ["olive", "tapenade"], except: ["huile d olive"] },
  { key: "abats", label: "Abats", words: ["abat", "foie", "rognon", "tripe", "cervelle", "ris de veau", "langue de boeuf", "gesier", "andouillette", "coeur de canard", "coeur de poulet"], except: ["foie gras"] },
  { key: "lapin", label: "Lapin", words: ["lapin"] },
  { key: "agneau", label: "Agneau", words: ["agneau", "mouton", "gigot", "navarin", "souris d agneau"] },
  { key: "betterave", label: "Betterave", words: ["betterave"] },
  { key: "avocat", label: "Avocat", words: ["avocat", "guacamole"] },
];

const ALL: Food[] = [...DIETS, ...INGREDIENTS.filter((f) => !DIETS.some((d) => d.key === f.key))];
const BY_KEY = new Map(ALL.map((f) => [f.key, f]));

export function foodLabel(key: string): string {
  return isAutre(key) ? key.slice(AUTRE.length) : (BY_KEY.get(key)?.label ?? key);
}

/** Le champ libre « Autre » : enregistré comme un aliment interdit « autre:céleri ». */
export const AUTRE = "autre:";
const isAutre = (key: string) => key.startsWith(AUTRE);

const pad = (s: string) => ` ${normalizeName(s)} `;

/** Le texte d'une recette (titre + ingrédients), une ligne par élément. */
export type RecipeText = string[];

function contains(lines: string[], food: Food): boolean {
  const words = food.words.map(pad);
  const except = (food.except ?? []).map(pad);
  return lines.some((raw) => {
    let line = pad(raw);
    for (const e of except) line = line.split(e).join(" ");
    return words.some((w) => line.includes(w));
  });
}

/** Les aliments (clés) repérés dans une recette, parmi ceux demandés. */
export function foodsIn(text: RecipeText, keys: Iterable<string>): Set<string> {
  const found = new Set<string>();
  for (const key of keys) {
    const food = isAutre(key) ? { key, label: key, words: [key.slice(AUTRE.length)] } : BY_KEY.get(key);
    if (food && food.words.some((w) => normalizeName(w)) && contains(text, food)) found.add(key);
  }
  return found;
}

export type MemberTastes = { id: string; name: string; tastes: Record<string, TasteLevel> };

export type Verdict = "cache" | "fin" | "tete" | "normal";

export type Conflicts = {
  interditPar: string[];
  pasFanDe: string[];
  adorePar: string[];
  /** Pour le paquet de `meId`. */
  verdict: Verdict;
  /** Pour ce que toute la famille voit (matchs, plats des courses, import). */
  familleCache: boolean;
};

/**
 * Qui interdit la recette, qui ne l'aime pas, qui l'adore, et ce qu'on en fait :
 * - interdit par quelqu'un → cachée pour tout le monde ;
 * - je n'aime pas → cachée pour moi ;
 * - un autre n'aime pas → cachée (mode strict) ou en fin de paquet ;
 * - j'adore → en tête de mon paquet.
 */
export function recipeConflicts(text: RecipeText, members: MemberTastes[], strict: boolean, meId?: string): Conflicts {
  const keys = new Set(members.flatMap((m) => Object.keys(m.tastes)));
  const present = foodsIn(text, keys);
  const who = (level: TasteLevel) =>
    members.filter((m) => Object.entries(m.tastes).some(([k, l]) => l === level && present.has(k)));

  const interdit = who("interdit");
  const pasFan = who("pas_fan");
  const adore = who("adore");
  const familleCache = interdit.length > 0 || (strict && pasFan.length > 0);

  let verdict: Verdict = "normal";
  if (familleCache || pasFan.some((m) => m.id === meId)) verdict = "cache";
  else if (pasFan.length > 0) verdict = "fin";
  else if (adore.some((m) => m.id === meId)) verdict = "tete";

  return {
    interditPar: interdit.map((m) => m.name),
    pasFanDe: pasFan.map((m) => m.name),
    adorePar: adore.map((m) => m.name),
    verdict,
    familleCache,
  };
}

/** « Madji et Léo n'aiment pas » */
export function nAimePas(names: string[]): string {
  const liste = names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}` : names[0];
  return `${liste} ${names.length > 1 ? "n'aiment" : "n'aime"} pas`;
}

/**
 * Compatibilité entre deux membres : part des cartes du questionnaire où ils
 * sont du même avis (« j'aime pas » d'un côté, « ça me va / j'adore » de l'autre = désaccord).
 * Une carte sans réponse compte comme « ça me va ».
 */
export function compatibility(a: Record<string, TasteLevel>, b: Record<string, TasteLevel>): number {
  const cards = INGREDIENTS.map((f) => f.key);
  const avis = (t: Record<string, TasteLevel>, k: string) => (t[k] === "pas_fan" || t[k] === "interdit" ? "non" : "oui");
  const same = cards.filter((k) => avis(a, k) === avis(b, k)).length;
  return Math.round((same / cards.length) * 100);
}
