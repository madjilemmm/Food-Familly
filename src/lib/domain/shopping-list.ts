import { isAisle, type AisleId } from "./aisles";

export type Ingredient = {
  name: string;
  quantity: number | null;
  unit: string;
  aisle: string;
};

export type MergedItem = {
  /** Clé de fusion : sert aussi à conserver les cases cochées à la régénération. */
  key: string;
  name: string;
  quantity: number | null;
  unit: string;
  aisle: AisleId;
  forRecipes: string[];
};

/** Unités convertibles : on additionne en unité de base (g, ml). */
const CONVERSIONS: Record<string, { base: string; factor: number }> = {
  g: { base: "g", factor: 1 },
  gr: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  cl: { base: "ml", factor: 10 },
  dl: { base: "ml", factor: 100 },
  l: { base: "ml", factor: 1000 },
};

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** "Oignons " → "oignon", "Œufs" → "oeuf" : sert uniquement à comparer. */
export function normalizeName(name: string): string {
  return stripAccents(name.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae"))
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 ? word.replace(/[sx]$/, "") : word))
    .join(" ");
}

export function normalizeUnit(unit: string): string {
  const u = stripAccents(unit.trim().toLowerCase()).replace(/\.$/, "");
  if (u === "piece" || u === "pieces" || u === "pc" || u === "pcs") return "";
  return u.length > 3 ? u.replace(/[sx]$/, "") : u;
}

/**
 * Additionne les ingrédients de plusieurs plats : un par nom et par unité. Avec `arrondir`, la somme est arrondie une seule
 * fois, comme on l'écrirait sur une liste (3 plats qui demandent un quart d'oignon : un oignon, pas trois).
 */
export function mergeIngredients(
  entries: { recipeTitle: string; ingredients: Ingredient[] }[],
  options: { arrondir?: boolean } = {},
): MergedItem[] {
  const byKey = new Map<string, MergedItem & { baseQuantity: number | null; baseUnit: string }>();

  for (const { recipeTitle, ingredients } of entries) {
    for (const ing of ingredients) {
      const unit = normalizeUnit(ing.unit);
      const conv = CONVERSIONS[unit];
      const baseUnit = conv ? conv.base : unit;
      const baseQty = ing.quantity == null ? null : ing.quantity * (conv?.factor ?? 1);
      const key = `${normalizeName(ing.name)}|${baseUnit}`;

      const existing = byKey.get(key);
      if (existing) {
        if (baseQty != null) existing.baseQuantity = (existing.baseQuantity ?? 0) + baseQty;
        if (!existing.forRecipes.includes(recipeTitle)) existing.forRecipes.push(recipeTitle);
      } else {
        byKey.set(key, {
          key,
          name: ing.name.trim(),
          quantity: null,
          unit: ing.unit.trim(),
          aisle: isAisle(ing.aisle) ? ing.aisle : "autre",
          forRecipes: [recipeTitle],
          baseQuantity: baseQty,
          baseUnit,
        });
      }
    }
  }

  return [...byKey.values()].map(({ baseQuantity, baseUnit, ...item }) => {
    const { quantity, unit } = toReadableUnit(baseQuantity, baseUnit, item.unit);
    return { ...item, quantity: options.arrondir && quantity != null ? arrondirQuantite(quantity, unit) : quantity, unit };
  });
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** 1500 g → 1,5 kg ; 250 ml → 25 cl ; 1000 ml → 1 l. */
function toReadableUnit(qty: number | null, baseUnit: string, originalUnit: string) {
  if (qty == null) return { quantity: null, unit: originalUnit };
  if (baseUnit === "g") return qty >= 1000 ? { quantity: round(qty / 1000), unit: "kg" } : { quantity: round(qty), unit: "g" };
  if (baseUnit === "ml") {
    if (qty >= 1000) return { quantity: round(qty / 1000), unit: "l" };
    if (qty % 10 === 0) return { quantity: round(qty / 10), unit: "cl" };
    return { quantity: round(qty), unit: "ml" };
  }
  return { quantity: round(qty), unit: originalUnit };
}

/** Les unités qui se comptent, au singulier et au pluriel : « 1 gousse », « 2 gousses », « 2 boîtes ». */
const PLURIELS: Record<string, string> = {
  gousse: "gousses", tranche: "tranches", feuille: "feuilles", boîte: "boîtes", sachet: "sachets", paquet: "paquets",
  bouquet: "bouquets", botte: "bottes", branche: "branches", brin: "brins", verre: "verres", tasse: "tasses", pot: "pots",
  brique: "briques", rouleau: "rouleaux", poignée: "poignées", tête: "têtes", morceau: "morceaux", pincée: "pincées",
  cube: "cubes", tablette: "tablettes", boule: "boules", barquette: "barquettes", bocal: "bocaux", bol: "bols",
};
const SINGULIERS = new Map(Object.entries(PLURIELS).flatMap(([s, p]) => [[s, s], [p, s]] as [string, string][]));

/** L'unité accordée à la quantité : « 1 gousse », « 0,5 gousse », « 2 gousses ». Les autres unités (g, cl, c. à soupe) ne changent pas. */
export function uniteAccordee(quantity: number | null, unit: string): string {
  const singulier = SINGULIERS.get(unit.trim().toLowerCase());
  if (!singulier) return unit;
  return quantity != null && quantity > 1 ? PLURIELS[singulier] : singulier;
}

/** "1,5 kg", "3", "2 gousses", "" si pas de quantité. */
export function formatQuantity(quantity: number | null, unit: string): string {
  if (quantity == null) return unit;
  const n = quantity.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const u = uniteAccordee(quantity, unit);
  return u ? `${n} ${u}` : n;
}

/**
 * Les titres de recettes que porte un article (« pour A, B »), joints par une virgule. Un titre peut contenir une virgule
 * (« Gratin dauphinois, version crème ») : on lit avec les titres qu'on connaît, le plus long d'abord, au lieu de couper à
 * chaque virgule. Un titre inconnu (recette renommée ou supprimée depuis) est lu jusqu'à la virgule suivante.
 */
export function titresPourLesquels(forRecipes: string | null | undefined, connus: string[] = []): string[] {
  const texte = forRecipes ?? "";
  if (!texte) return [];
  const SEP = ", ";
  const longsDabord = [...new Set(connus.filter(Boolean))].sort((a, b) => b.length - a.length);
  const titres: string[] = [];
  let i = 0;
  while (i < texte.length) {
    const titre = longsDabord.find((t) => texte.startsWith(t, i) && (i + t.length === texte.length || texte.startsWith(SEP, i + t.length)));
    const suivante = texte.indexOf(SEP, i);
    const fin = titre ? i + titre.length : suivante === -1 ? texte.length : suivante;
    titres.push(titre ?? texte.slice(i, fin));
    i = fin + SEP.length;
  }
  return titres;
}

/** Cet article est-il pour cette recette ? (`connus` : les autres titres, pour bien lire ceux qui contiennent une virgule.) */
export function estPourLaRecette(forRecipes: string | null | undefined, titre: string, connus: string[] = []): boolean {
  return titresPourLesquels(forRecipes, [...connus, titre]).includes(titre);
}

/** Clé utilisée pour retrouver un article déjà présent dans la liste. */
export function itemKey(name: string, unit: string): string {
  const u = normalizeUnit(unit);
  return `${normalizeName(name)}|${CONVERSIONS[u]?.base ?? u}`;
}

// ─── Quantités selon le nombre de personnes ───────────────────────────

/** Unités qu'on ne multiplie pas (« 1 pincée » reste « 1 pincée »). */
const FIXES = new Set(["pincee", "filet", "trait", "zeste", "noisette", "soupcon"]);
/** Unités qui se comptent : arrondies à l'unité, jamais moins d'une. */
const ENTIERES = new Set(["", "gousse", "tranche", "boite", "sachet", "paquet", "brin", "feuille", "botte", "pot", "bocal", "tablette", "rouleau", "pate", "boule", "barquette", "conserve", "cube", "branche", "verre", "bol", "tasse", "tete", "bouquet", "brique", "morceau"]);
const CUILLERES = /cuill|c a s|c a c|cas|cac|cs|cc/;

/**
 * Quantité pour `factor` fois la recette (ex. pour 3 au lieu de 6 → 0,5),
 * arrondie comme on l'écrirait sur une liste : 3 œufs, 250 g, 1,5 c. à soupe.
 */
export function scaleQuantity(quantity: number | null, unit: string, factor: number): number | null {
  if (quantity == null || !Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.01) return quantity;
  const u = normalizeUnit(unit).replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (FIXES.has(u)) return quantity;
  return arrondirQuantite(quantity * factor, unit);
}

/**
 * La quantité pour `factor` fois la recette, sans arrondi : pour additionner plusieurs plats avant d'arrondir une seule fois
 * (un quart d'oignon dans trois plats fait trois quarts d'oignon, pas trois oignons).
 */
export function scaleQuantityBrut(quantity: number | null, unit: string, factor: number): number | null {
  if (quantity == null || !Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.01) return quantity;
  return FIXES.has(normalizeUnit(unit).replace(/\./g, "").replace(/\s+/g, " ").trim()) ? quantity : quantity * factor;
}

/** Une quantité écrite comme sur une liste : entière pour ce qui se compte (jamais moins d'une), au demi près pour les cuillères… */
export function arrondirQuantite(q: number, unit: string): number {
  const u = normalizeUnit(unit).replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (ENTIERES.has(u) || ENTIERES.has(u.replace(/[sx]$/, ""))) return Math.max(1, Math.round(q));
  if (CUILLERES.test(u)) return Math.max(0.5, Math.round(q * 2) / 2);
  if (u === "g" || u === "ml") return q >= 50 ? Math.round(q / 10) * 10 : Math.max(1, Math.round(q / 5) * 5 || Math.round(q));
  if (u === "cl") return Math.max(1, Math.round(q));
  if (u === "kg" || u === "l") return Math.round(q * 100) / 100;
  return Math.round(q * 10) / 10;
}

/** Une recette sans nombre de personnes écrit est lue pour 4 (le formulaire le propose), et on le dit. */
export const PORTIONS_PAR_DEFAUT = 4;

/**
 * Les ingrédients d'une recette prévue pour `servings` personnes, pour `people` personnes.
 * `brut` : sans arrondir (pour additionner plusieurs plats avant d'arrondir, voir mergeIngredients).
 */
export function scaleIngredients<T extends { quantity: number | null; unit: string }>(
  ingredients: T[],
  servings: number | null | undefined,
  people: number,
  brut = false,
): T[] {
  const base = servings && servings > 0 ? servings : PORTIONS_PAR_DEFAUT;
  if (people <= 0 || base === people) return ingredients;
  const echelle = brut ? scaleQuantityBrut : scaleQuantity;
  return ingredients.map((i) => ({ ...i, quantity: echelle(i.quantity, i.unit, people / base) }));
}
