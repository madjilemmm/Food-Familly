export const AISLES = [
  { id: "fruits_legumes", label: "Fruits et légumes", emoji: "🥬" },
  { id: "boucherie", label: "Boucherie, charcuterie", emoji: "🥩" },
  { id: "poissonnerie", label: "Poissonnerie", emoji: "🐟" },
  { id: "cremerie", label: "Crèmerie, œufs, frais", emoji: "🧈" },
  { id: "boulangerie", label: "Boulangerie", emoji: "🥖" },
  { id: "epicerie", label: "Épicerie", emoji: "🥫" },
  { id: "surgeles", label: "Surgelés", emoji: "🧊" },
  { id: "boissons", label: "Boissons", emoji: "🧃" },
  { id: "hygiene", label: "Hygiène, maison", emoji: "🧴" },
  { id: "autre", label: "Autre", emoji: "🛒" },
] as const;

export type AisleId = (typeof AISLES)[number]["id"];

export const AISLE_IDS = AISLES.map((a) => a.id) as AisleId[];

export function isAisle(value: unknown): value is AisleId {
  return typeof value === "string" && (AISLE_IDS as string[]).includes(value);
}

export function aisleInfo(id: string) {
  return AISLES.find((a) => a.id === id) ?? AISLES[AISLES.length - 1];
}

/**
 * Un ordre de rayons complet et sans doublon, à partir de ce qui a été
 * enregistré (les rayons inconnus sautent, les oubliés vont à la fin).
 */
export function normalizeAisleOrder(order: unknown): AisleId[] {
  const saved = Array.isArray(order) ? order.filter(isAisle) : [];
  return [...new Set([...saved, ...AISLE_IDS])];
}

/** Regroupe des éléments par rayon, dans l'ordre du magasin (par défaut, l'ordre classique). */
export function groupByAisle<T extends { aisle: string }>(items: T[], order?: readonly string[]) {
  return normalizeAisleOrder(order)
    .map((id) => ({
      ...aisleInfo(id),
      items: items.filter((i) => (isAisle(i.aisle) ? i.aisle : "autre") === id),
    }))
    .filter((group) => group.items.length > 0);
}
