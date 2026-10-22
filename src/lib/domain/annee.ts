import type { Avis } from "./reco";

/*
 * « Notre année à table » : le bilan d'une famille depuis le 1er janvier.
 * Que des chiffres qui racontent quelque chose d'ensemble : les dîners décidés,
 * le plat star, le duo qui tombe le plus souvent d'accord, qui a fait les courses.
 */

export type CourseDeLAnnee = { shopper: string | null; plats: string[] };

export type Annee = {
  /** Plats choisis ensemble (retenus aux courses). */
  diners: number;
  courses: number;
  swipes: number;
  /** Le plat le plus souvent retenu (au moins deux fois). */
  platStar: { id: string; fois: number } | null;
  /** Les deux personnes qui ont le plus d'envies en commun. */
  duo: { a: string; b: string; matchs: number } | null;
  /** Qui a fait le plus de courses. */
  champion: { id: string; fois: number } | null;
};

export function bilanAnnee(courses: CourseDeLAnnee[], avis: Map<string, Map<string, Avis>>, debut: number): Annee {
  const fois = new Map<string, number>();
  for (const c of courses) for (const p of c.plats) fois.set(p, (fois.get(p) ?? 0) + 1);
  const [star] = [...fois].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));

  const parCourses = new Map<string, number>();
  for (const c of courses) if (c.shopper) parCourses.set(c.shopper, (parCourses.get(c.shopper) ?? 0) + 1);
  const [champion] = [...parCourses].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));

  let swipes = 0;
  const duos = new Map<string, number>();
  for (const parMembre of avis.values()) {
    const fans: string[] = [];
    for (const [id, a] of parMembre) {
      if (a.swipedAt >= debut) swipes++;
      if (a.likedAt != null && a.likedAt >= debut) fans.push(id);
    }
    fans.sort();
    for (let i = 0; i < fans.length; i++) for (let j = i + 1; j < fans.length; j++) {
      const cle = `${fans[i]}|${fans[j]}`;
      duos.set(cle, (duos.get(cle) ?? 0) + 1);
    }
  }
  const [duo] = [...duos].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));

  return {
    diners: [...fois.values()].reduce((a, b) => a + b, 0),
    courses: courses.length,
    swipes,
    platStar: star && star[1] >= 2 ? { id: star[0], fois: star[1] } : null,
    duo: duo ? { a: duo[0].split("|")[0], b: duo[0].split("|")[1], matchs: duo[1] } : null,
    champion: champion ? { id: champion[0], fois: champion[1] } : null,
  };
}
