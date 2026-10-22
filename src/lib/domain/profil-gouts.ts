import { styleDe } from "./envies";
import { INGREDIENTS, foodsIn } from "./foods";
import type { Avis } from "./reco";

/*
 * Apprendre les goûts par caractéristiques, pas plat par plat.
 * Chaque recette reçoit des étiquettes (style, aliments, temps de cuisine) ; pour chaque
 * membre, on compte ses « oui » et ses « non » par étiquette. Une recette jamais vue
 * reçoit ainsi une note prédite : aimer les tacos au poulet dit quelque chose des fajitas.
 *
 * - Un « non » pèse moitié moins qu'un « oui » : seul, il veut souvent dire « pas ce soir » ;
 *   répété sur une même étiquette, il devient un vrai goût.
 * - Un lissage évite de conclure sur deux swipes.
 * - Les avis anciens comptent moins (demi-vie de 90 jours).
 */

export const PROFIL = {
  POIDS_OUI: 1,
  POIDS_NON: 0.5,
  LISSAGE: 2,
  DEMI_VIE_JOURS: 90,
  /** En dessous de ce poids total, une étiquette ne dit encore rien. */
  POIDS_MIN: 0.9,
} as const;

const JOUR = 86_400_000;
const CLES_ALIMENTS = INGREDIENTS.map((f) => f.key);

/** Les étiquettes d'une recette : son style, ses aliments repérés, son temps (rapide / long). */
export function etiquettesDe(texts: string[], minutes: number | null): string[] {
  const style = styleDe(texts);
  const tags = [...(style ? [`style:${style}`] : []), ...[...foodsIn(texts, CLES_ALIMENTS)].map((k) => `aliment:${k}`)];
  if (minutes) {
    if (minutes <= 30) tags.push("temps:rapide");
    else if (minutes > 60) tags.push("temps:long");
  }
  return tags;
}

/** Le goût d'une personne pour chaque étiquette, de −1 à 1. */
export type ProfilGouts = Map<string, number>;

/** Le profil d'une personne à partir de ses swipes (recette → son dernier avis). */
export function profilDe(avis: Iterable<[string, Avis]>, etiquettes: Map<string, string[]>, now: number): ProfilGouts {
  const oui = new Map<string, number>();
  const non = new Map<string, number>();
  for (const [recipeId, a] of avis) {
    const tags = etiquettes.get(recipeId);
    if (!tags?.length) continue;
    const aime = a.likedAt != null;
    if (!aime && a.liked) continue;
    const quand = aime ? a.likedAt! : a.swipedAt;
    const poids = Math.pow(0.5, Math.max(0, now - quand) / JOUR / PROFIL.DEMI_VIE_JOURS) * (aime ? PROFIL.POIDS_OUI : PROFIL.POIDS_NON);
    const cible = aime ? oui : non;
    for (const t of tags) cible.set(t, (cible.get(t) ?? 0) + poids);
  }
  const profil: ProfilGouts = new Map();
  for (const t of new Set([...oui.keys(), ...non.keys()])) {
    const o = oui.get(t) ?? 0;
    const n = non.get(t) ?? 0;
    if (o + n < PROFIL.POIDS_MIN) continue;
    profil.set(t, (o - n) / (o + n + PROFIL.LISSAGE));
  }
  return profil;
}

/** La note prédite d'une recette pour une personne (−1 à 1) ; null si son profil n'en dit rien. */
export function prediction(profil: ProfilGouts, tags: string[]): number | null {
  const connus = tags.flatMap((t) => (profil.has(t) ? [profil.get(t)!] : []));
  return connus.length ? connus.reduce((a, b) => a + b, 0) / connus.length : null;
}

/** Les étiquettes les plus aimées d'une famille (somme des profils), les meilleures d'abord. */
export function etiquettesPreferees(profils: ProfilGouts[], prefixe: string, n: number): string[] {
  const total = new Map<string, number>();
  for (const p of profils) for (const [t, v] of p) if (t.startsWith(prefixe)) total.set(t, (total.get(t) ?? 0) + v);
  return [...total]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([t]) => t.slice(prefixe.length));
}
