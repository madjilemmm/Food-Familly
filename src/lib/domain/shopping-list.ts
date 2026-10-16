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

export function mergeIngredients(
  entries: { recipeTitle: string; ingredients: Ingredient[] }[],
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
    return { ...item, quantity, unit };
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

/** "1,5 kg", "3", "2 gousses", "" si pas de quantité. */
export function formatQuantity(quantity: number | null, unit: string): string {
  if (quantity == null) return unit;
  const n = quantity.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  return unit ? `${n} ${unit}` : n;
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
const ENTIERES = new Set(["", "gousse", "tranche", "boite", "sachet", "paquet", "brin", "feuille", "botte", "pot", "bocal", "tablette", "rouleau", "pate", "boule", "barquette", "conserve", "cube", "branche", "verre", "bol", "tasse"]);
const CUILLERES = /cuill|c a s|c a c|cas|cac|cs|cc/;

/**
 * Quantité pour `factor` fois la recette (ex. pour 3 au lieu de 6 → 0,5),
 * arrondie comme on l'écrirait sur une liste : 3 œufs, 250 g, 1,5 c. à soupe.
 */
export function scaleQuantity(quantity: number | null, unit: string, factor: number): number | null {
  if (quantity == null || !Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.01) return quantity;
  const u = normalizeUnit(unit).replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (FIXES.has(u)) return quantity;
  const q = quantity * factor;
  if (ENTIERES.has(u) || ENTIERES.has(u.replace(/[sx]$/, ""))) return Math.max(1, Math.round(q));
  if (CUILLERES.test(u)) return Math.max(0.5, Math.round(q * 2) / 2);
  if (u === "g" || u === "ml") return q >= 50 ? Math.round(q / 10) * 10 : Math.max(1, Math.round(q / 5) * 5 || Math.round(q));
  if (u === "cl") return Math.max(1, Math.round(q));
  if (u === "kg" || u === "l") return Math.round(q * 100) / 100;
  return Math.round(q * 10) / 10;
}

/** Les ingrédients d'une recette prévue pour `servings` personnes, pour `people` personnes. */
export function scaleIngredients<T extends { quantity: number | null; unit: string }>(
  ingredients: T[],
  servings: number | null | undefined,
  people: number,
): T[] {
  if (!servings || servings <= 0 || people <= 0 || servings === people) return ingredients;
  return ingredients.map((i) => ({ ...i, quantity: scaleQuantity(i.quantity, i.unit, people / servings) }));
}
