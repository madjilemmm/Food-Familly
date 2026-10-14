/**
 * Dans l'ordre du parcours d'un supermarché classique, de l'entrée à la caisse.
 * Les surgelés à la fin, pour qu'ils restent froids jusqu'à la maison.
 */
export const AISLES = [
  { id: "fruits_legumes", label: "Fruits et légumes", emoji: "🥬" },
  { id: "boulangerie", label: "Boulangerie", emoji: "🥖" },
  { id: "boucherie", label: "Boucherie, charcuterie", emoji: "🥩" },
  { id: "poissonnerie", label: "Poissonnerie", emoji: "🐟" },
  { id: "cremerie", label: "Crèmerie, œufs, frais", emoji: "🧈" },
  { id: "epicerie", label: "Épicerie", emoji: "🥫" },
  { id: "boissons", label: "Boissons", emoji: "🧃" },
  { id: "hygiene", label: "Hygiène, maison", emoji: "🧴" },
  { id: "surgeles", label: "Surgelés", emoji: "🧊" },
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

/** Regroupe des éléments par rayon, dans l'ordre du parcours en magasin. */
export function groupByAisle<T extends { aisle: string }>(items: T[]) {
  return AISLES.map((aisle) => ({
    ...aisle,
    items: items.filter((i) => (isAisle(i.aisle) ? i.aisle : "autre") === aisle.id),
  })).filter((group) => group.items.length > 0);
}
