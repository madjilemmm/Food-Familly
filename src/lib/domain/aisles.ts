/**
 * Dans l'ordre du parcours d'un supermarché classique, de l'entrée à la caisse.
 * Les surgelés à la fin, pour qu'ils restent froids jusqu'à la maison.
 */
export const AISLES = [
  { id: "fruits_legumes", label: "Fruits et légumes" },
  { id: "boulangerie", label: "Boulangerie" },
  { id: "boucherie", label: "Boucherie, charcuterie" },
  { id: "poissonnerie", label: "Poissonnerie" },
  { id: "cremerie", label: "Crèmerie, œufs, frais" },
  { id: "epicerie", label: "Épicerie" },
  { id: "boissons", label: "Boissons" },
  { id: "hygiene", label: "Hygiène, maison" },
  { id: "surgeles", label: "Surgelés" },
  { id: "autre", label: "Autre" },
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
