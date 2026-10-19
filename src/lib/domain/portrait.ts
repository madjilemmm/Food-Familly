import { STYLES } from "./envies";
import { DIETS, INGREDIENTS, type TasteLevel } from "./foods";

/*
 * « Ton portrait gourmand » : ce que Kaddie a compris d'une personne, en phrases simples.
 * Seulement des faits tirés de ses swipes et de ses goûts ; rien n'est affirmé sur trop peu
 * d'indices. Les goûts déclarés (j'adore, j'aime pas) se corrigent d'un appui.
 */

export const PORTRAIT = { SWIPES_MIN: 10, STYLE_MIN: 3, PART_STYLE: 0.3, PART_REFUS: 0.6 } as const;

export type Trait = { id: string; texte: string; /** Le goût déclaré à retirer avec « Pas vraiment ». */ gout?: string };

export type Indices = {
  /** Style de chaque plat aimé, et de chaque plat refusé (null : style inconnu). */
  aimes: { style: string | null; minutes: number | null }[];
  refuses: { style: string | null }[];
  gouts: Record<string, TasteLevel>;
};

const labelStyle = (k: string) => STYLES.find((s) => s.key === k)?.label ?? k;
const labelAliment = (k: string) => INGREDIENTS.find((f) => f.key === k)?.label ?? DIETS.find((d) => d.key === k)?.label ?? k.replace(/^autre:/, "");
const minuscule = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const compter = (styles: (string | null)[]) => {
  const n = new Map<string, number>();
  for (const s of styles) if (s) n.set(s, (n.get(s) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]);
};

export function portrait({ aimes, refuses, gouts }: Indices): { traits: Trait[]; aSwiper: number } {
  const traits: Trait[] = [];
  const total = aimes.length + refuses.length;

  // Les styles qui reviennent dans ce qu'on aime.
  for (const [style, n] of compter(aimes.map((a) => a.style)).slice(0, 2)) {
    if (n >= PORTRAIT.STYLE_MIN && n / aimes.length >= PORTRAIT.PART_STYLE) traits.push({ id: `style:${style}`, texte: `Team ${minuscule(labelStyle(style))}` });
  }
  // Ce qu'on refuse presque toujours.
  const tousStyles = new Map(compter([...aimes, ...refuses].map((a) => a.style)));
  for (const [style, n] of compter(refuses.map((r) => r.style)).slice(0, 2)) {
    if (n >= PORTRAIT.STYLE_MIN && n / (tousStyles.get(style) ?? n) >= PORTRAIT.PART_REFUS) {
      traits.push({ id: `non:${style}`, texte: `Tu dis souvent non : ${minuscule(labelStyle(style))}` });
    }
  }
  // Le temps de cuisine des plats aimés.
  const minutes = aimes.flatMap((a) => (a.minutes ? [a.minutes] : [])).sort((a, b) => a - b);
  if (minutes.length >= PORTRAIT.STYLE_MIN) {
    const median = minutes[Math.floor(minutes.length / 2)];
    if (median <= 30) traits.push({ id: "rapide", texte: "Plutôt des plats rapides" });
    else if (median >= 60) traits.push({ id: "mijote", texte: "Tu aimes les plats qui mijotent" });
  }
  // Les goûts déclarés, un par un : on peut les corriger.
  for (const [food, level] of Object.entries(gouts)) {
    if (level === "adore") traits.push({ id: `adore:${food}`, texte: `Tu adores : ${minuscule(labelAliment(food))}`, gout: food });
    if (level === "pas_fan") traits.push({ id: `pasfan:${food}`, texte: `Tu n'aimes pas : ${minuscule(labelAliment(food))}`, gout: food });
  }
  return { traits, aSwiper: Math.max(0, PORTRAIT.SWIPES_MIN - total) };
}
