import { normalizeName } from "./shopping-list";

/**
 * « Sans doute déjà à la maison » : Kaddie ne voit pas les placards, elle le déduit
 * de ce que fait la personne qui fait les courses.
 * - un ingrédient retiré « déjà à la maison » à au moins 2 des 3 dernières courses
 *   où il est apparu est sans doute toujours là (sel, huile, poivre…) ;
 * - dès qu'il a été acheté à la dernière course où il est apparu, la supposition tombe.
 * Il n'est alors pas mis d'office sur la liste, mais montré « à vérifier avant de partir ».
 */
export const MAISON = { COURSES_REGARDEES: 3, RETIRE_AU_MOINS: 2 } as const;

/** Ce qui est arrivé à un ingrédient lors d'une course terminée. */
export type Passage = { retire: boolean; achete: boolean };

/** La clé d'un ingrédient pour cette règle : son nom, sans les unités (« Sel », « sel fin »… restent distincts). */
export const cleMaison = (nom: string) => normalizeName(nom);

/** Les ingrédients sans doute déjà à la maison, à partir de leurs passages (les plus récents d'abord). */
export function sansDouteALaMaison(passages: Map<string, Passage[]>): Set<string> {
  const resultat = new Set<string>();
  for (const [cle, liste] of passages) {
    const recents = liste.slice(0, MAISON.COURSES_REGARDEES);
    if (recents.length === 0 || recents[0].achete) continue;
    if (recents.filter((p) => p.retire).length >= MAISON.RETIRE_AU_MOINS) resultat.add(cle);
  }
  return resultat;
}

/**
 * Les passages de chaque ingrédient dans les courses terminées (les plus récentes d'abord) :
 * retiré (« déjà à la maison »), acheté (coché), ou ni l'un ni l'autre.
 */
export function passagesDesIngredients(
  courses: { items: { name: string; source: string; checked: boolean }[] }[],
): Map<string, Passage[]> {
  const passages = new Map<string, Passage[]>();
  for (const course of courses) {
    const ici = new Map<string, Passage>();
    for (const item of course.items) {
      // Un article ajouté à la main et pas acheté ne dit rien de la maison.
      if (item.source !== "recipe" && item.source !== "maison" && !item.checked) continue;
      const cle = cleMaison(item.name);
      const p = ici.get(cle) ?? { retire: false, achete: false };
      if (item.source === "maison") p.retire = true;
      if (item.checked && item.source !== "maison") p.achete = true;
      ici.set(cle, p);
    }
    for (const [cle, p] of ici) passages.set(cle, [...(passages.get(cle) ?? []), p]);
  }
  return passages;
}
