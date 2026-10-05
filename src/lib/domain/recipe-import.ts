import type { AisleId } from "./aisles";
import { normalizeName } from "./shopping-list";

/**
 * Lecture d'une recette publiée sur un site (Marmiton, 750g, Cuisine AZ,
 * Ptitchef…) à partir de ses données structurées schema.org/Recipe (JSON-LD),
 * que la plupart des sites de cuisine publient pour Google.
 */

export type ImportedIngredient = { name: string; quantity: number | null; unit: string; aisle: AisleId };

export type ImportedRecipe = {
  title: string;
  imageUrl: string | null;
  servings: string | null;
  ingredients: ImportedIngredient[];
};

// ─── Extraction du JSON-LD ────────────────────────────────────────────

type Json = Record<string, unknown>;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", ocirc: "ô", oelig: "œ" };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

function isRecipe(node: Json): boolean {
  const type = node["@type"];
  return Array.isArray(type) ? type.includes("Recipe") : type === "Recipe";
}

function findRecipe(node: unknown): Json | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const obj = node as Json;
    if (isRecipe(obj)) return obj;
    if (obj["@graph"]) return findRecipe(obj["@graph"]);
    if (obj.mainEntity) return findRecipe(obj.mainEntity);
  }
  return null;
}

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content) : null;
}

function isPlaceholderImage(url: string): boolean {
  return /default[-_.]|placeholder|no[-_]?image/i.test(url);
}

function pickImage(image: unknown): string | null {
  const candidates: string[] = [];
  const visit = (v: unknown) => {
    if (typeof v === "string") candidates.push(v);
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") visit((v as Json).url ?? (v as Json).contentUrl);
  };
  visit(image);
  const real = candidates.filter((u) => /^https?:\/\//.test(u) && !isPlaceholderImage(u));
  // Préfère la plus grande déclinaison quand le site en propose plusieurs.
  const size = (u: string) => Number(u.match(/(\d{3,4})x\d{3,4}|w(\d{3,4})/)?.slice(1).find(Boolean) ?? 0);
  return real.sort((a, b) => size(b) - size(a))[0] ?? null;
}

/** « Blanquette de veau : la meilleure recette » → « Blanquette de veau ». */
export function cleanTitle(title: string): string {
  const t = decodeEntities(title)
    .replace(/\s*[:|–-]\s*(la meilleure recette|recette (facile|traditionnelle|rapide|de grand-mère|maison)).*$/i, "")
    .replace(/\s*[:|–-]\s*recette.*$/i, "")
    .replace(/^recette (de |du |des |d')?/i, "")
    .trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function servingsOf(value: unknown): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (v == null) return null;
  const s = String(v).trim();
  return /^\d+$/.test(s) ? `${s} personnes` : s;
}

export function extractRecipe(html: string): ImportedRecipe | null {
  let recipe: Json | null = null;
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      recipe = findRecipe(JSON.parse(m[1].trim()));
    } catch {
      continue;
    }
    if (recipe) break;
  }

  const fallbackTitle = metaContent(html, "og:title");
  const fallbackImage = metaContent(html, "og:image");
  if (!recipe) {
    if (!fallbackTitle) return null;
    return {
      title: cleanTitle(fallbackTitle),
      imageUrl: fallbackImage && !isPlaceholderImage(fallbackImage) ? fallbackImage : null,
      servings: null,
      ingredients: [],
    };
  }

  const lines = Array.isArray(recipe.recipeIngredient)
    ? (recipe.recipeIngredient as unknown[])
    : Array.isArray(recipe.ingredients)
      ? (recipe.ingredients as unknown[])
      : [];

  return {
    title: cleanTitle(String(recipe.name ?? fallbackTitle ?? "")),
    imageUrl: pickImage(recipe.image) ?? (fallbackImage && !isPlaceholderImage(fallbackImage) ? fallbackImage : null),
    servings: servingsOf(recipe.recipeYield),
    ingredients: lines.flatMap((l) => {
      const parsed = parseIngredientLine(decodeEntities(String(l)));
      return parsed ? [parsed] : [];
    }),
  };
}

// ─── Découpage d'une ligne d'ingrédient ───────────────────────────────

const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

/** Unités reconnues → forme affichée. L'ordre compte : les plus longues d'abord. */
const UNITS: [RegExp, string][] = [
  [/^(cuill[eè]res?|c\.)\s*(à|a)\s*(soupe|s\.)(?=[\s,']|$)|^c\.?\s*à\.?\s*s\.?(?=[\s,']|$)|^c\.?a\.?s(?=[\s,']|$)|^càs(?=[\s,']|$)|^cs(?=[\s,']|$)/i, "c. à soupe"],
  [/^(cuill[eè]res?|c\.)\s*(à|a)\s*(caf[eé]|c\.)(?=[\s,']|$)|^c\.?\s*à\.?\s*c\.?(?=[\s,']|$)|^c\.?a\.?c(?=[\s,']|$)|^càc(?=[\s,']|$)|^cc(?=[\s,']|$)/i, "c. à café"],
  [/^kilos?(?=[\s,']|$)|^kg(?=[\s,']|$)/i, "kg"],
  [/^grammes?(?=[\s,']|$)|^gr?(?=[\s,']|$)/i, "g"],
  [/^mg(?=[\s,']|$)/i, "mg"],
  [/^litres?(?=[\s,']|$)|^l(?=[\s,']|$)/i, "l"],
  [/^dl(?=[\s,']|$)/i, "dl"],
  [/^cl(?=[\s,']|$)/i, "cl"],
  [/^ml(?=[\s,']|$)/i, "ml"],
  [/^pinc[ée]es?(\(s\))?/i, "pincée"],
  [/^gousses?(\(s\))?/i, "gousses"],
  [/^tranches?(\(s\))?/i, "tranches"],
  [/^bo[iî]tes?(\(s\))?/i, "boîte"],
  [/^sachets?(\(s\))?/i, "sachet"],
  [/^paquets?(\(s\))?/i, "paquet"],
  [/^bouquets?(\(s\))?/i, "bouquet"],
  [/^bottes?(\(s\))?/i, "botte"],
  [/^branches?(\(s\))?/i, "branche"],
  [/^brins?(\(s\))?/i, "brin"],
  [/^feuilles?(\(s\))?/i, "feuilles"],
  [/^verres?(\(s\))?/i, "verre"],
  [/^tasses?(\(s\))?/i, "tasse"],
  [/^pots?(\(s\))?/i, "pot"],
  [/^briques?(\(s\))?/i, "brique"],
  [/^rouleaux?(\(s\))?|^rouleau/i, "rouleau"],
  [/^poign[ée]es?(\(s\))?/i, "poignée"],
  [/^t[eê]tes?(\(s\))?/i, "tête"],
  [/^filets?(\(s\))?(?=\s+d)/i, "filet"],
  [/^noix(?=\s+de\s+beurre)/i, "noix"],
  [/^morceaux?(\(s\))?|^morceau/i, "morceau"],
];

/** Titres de section que certains sites glissent dans la liste. */
const SECTION_HEADERS = /^(pr[ée]paration|ingr[ée]dients?|pour la .+|pour le .+|pour les .+|garniture|sauce|p[aâ]te)\s*:?$/i;

const SIZE_WORDS = /^(petite?s?|grande?s?|grosse?s?|gros|beaux?|belles?|bonne?s?)\s+/i;

function parseQuantity(s: string): { value: number | null; rest: string } {
  const m = s.match(/^(\d+(?:[.,]\d+)?)?\s*([½¼¾⅓⅔])|^(\d+)\s*\/\s*(\d+)|^(\d+(?:[.,]\d+)?)(?:\s*(?:à|-)\s*\d+(?:[.,]\d+)?)?/);
  if (!m) return { value: null, rest: s };
  let value: number;
  if (m[2]) value = Number((m[1] ?? "0").replace(",", ".")) + FRACTIONS[m[2]];
  else if (m[3]) value = Number(m[3]) / Number(m[4]);
  else value = Number(m[5].replace(",", "."));
  return { value: Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null, rest: s.slice(m[0].length).trim() };
}

function tidyName(name: string): string {
  const n = name
    .replace(/\(s\)/gi, "")
    .replace(/\([^)]*\)/g, "") // précisions entre parenthèses : « (coupés) », « (facultatif) »
    .replace(/^(de |d'|d’|du |des |de la |de l')\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s,;.]+$/, "")
    .trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export function parseIngredientLine(raw: string): ImportedIngredient | null {
  const line = raw.replace(/\s+/g, " ").trim();
  if (!line || line.length > 200 || SECTION_HEADERS.test(line)) return null;

  const { value, rest } = parseQuantity(line);
  let remaining = rest.replace(SIZE_WORDS, "");
  let unit = "";
  if (value != null || /^(pinc[ée]e|gousse|tranche|bo[iî]te|sachet|paquet|bouquet|botte|branche|brin)/i.test(remaining)) {
    for (const [re, label] of UNITS) {
      const m = remaining.match(re);
      if (m) {
        unit = label;
        remaining = remaining.slice(m[0].length).trim();
        break;
      }
    }
  }

  const name = tidyName(remaining) || tidyName(line);
  if (!name) return null;
  // « 1 sel » n'a pas de sens : une quantité sans unité reste une pièce.
  return { name, quantity: value, unit, aisle: guessAisle(name) };
}

// ─── Rayon deviné à partir du nom ─────────────────────────────────────

/** Le premier mot-clé trouvé gagne : les expressions précises d'abord. */
const AISLE_KEYWORDS: [AisleId, string[]][] = [
  ["epicerie", ["lait de coco", "creme de marron", "pate de curry"]],
  ["surgeles", ["surgele", "glace", "sorbet"]],
  ["cremerie", ["pate brisee", "pate feuilletee", "pate sablee", "pate a pizza", "creme fraiche", "creme liquide", "creme epaisse", "lait", "beurre", "oeuf", "fromage", "gruyere", "emmental", "comte", "parmesan", "mozzarella", "chevre", "feta", "ricotta", "mascarpone", "yaourt", "yogourt", "creme", "raclette", "reblochon", "camembert", "roquefort", "cheddar"]],
  ["boucherie", ["chair a saucisse", "saucisse", "lardon", "jambon", "bacon", "chorizo", "boeuf", "veau", "porc", "poulet", "dinde", "agneau", "canard", "lapin", "viande", "steak", "escalope", "roti", "paleron", "macreuse", "gigot", "cote", "filet mignon", "merguez", "blanquette", "bourguignon", "os a moelle", "volaille", "pintade", "magret", "foie"]],
  ["poissonnerie", ["saumon", "cabillaud", "colin", "merlu", "thon frais", "crevette", "moule", "noix de saint", "poisson", "dorade", "bar", "truite", "sardine fraiche", "calamar", "seiche", "lotte", "haddock"]],
  ["boulangerie", ["pain", "baguette", "brioche", "croissant"]],
  ["boissons", ["vin", "biere", "cidre", "champagne", "jus", "eau de vie", "rhum", "cognac", "porto", "whisky", "vodka", "calvados", "kirsch", "soda", "limonade"]],
  ["fruits_legumes", ["pomme de terre", "patate", "tomate", "oignon", "echalote", "ail", "carotte", "courgette", "aubergine", "poivron", "champignon", "salade", "laitue", "epinard", "poireau", "navet", "celeri", "chou", "brocoli", "haricot vert", "petit pois", "concombre", "radis", "betterave", "potiron", "courge", "butternut", "citron", "orange", "pomme", "poire", "banane", "fraise", "framboise", "abricot", "peche", "cerise", "raisin", "mangue", "ananas", "kiwi", "avocat", "persil", "basilic", "thym", "romarin", "laurier", "ciboulette", "coriandre", "menthe", "estragon", "aneth", "cerfeuil", "bouquet garni", "gingembre", "fenouil", "artichaut", "asperge", "endive", "mache", "roquette", "patate douce", "panais", "citron vert"]],
  ["epicerie", ["farine", "sucre", "sel", "poivre", "huile", "vinaigre", "riz", "pate", "spaghetti", "tagliatelle", "lasagne", "penne", "coquillette", "semoule", "quinoa", "lentille", "pois chiche", "haricot", "bouillon", "moutarde", "ketchup", "mayonnaise", "chocolat", "cacao", "levure", "maizena", "fecule", "chapelure", "coulis", "concentre", "sauce", "miel", "confiture", "epice", "cumin", "curry", "paprika", "muscade", "cannelle", "vanille", "herbes de provence", "olive", "capre", "cornichon", "thon", "sardine", "noix", "amande", "noisette", "pignon", "raisin sec", "cafe", "the", "biscuit", "cereale", "conserve", "lait de coco", "soja", "nuoc", "tabasco", "gelatine", "agar"]],
];

export function guessAisle(name: string): AisleId {
  // normalizeName retire accents, pluriels et ponctuation : « Pommes de terre » → « pomme de terre »
  // Comparaison mot à mot : « vinaigre » ne doit pas être pris pour du « vin ».
  const n = ` ${normalizeName(name)} `;
  for (const [aisle, keywords] of AISLE_KEYWORDS) {
    if (keywords.some((k) => n.includes(` ${normalizeName(k)} `))) return aisle;
  }
  return "autre";
}
