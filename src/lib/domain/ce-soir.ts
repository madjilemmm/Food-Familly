import type { Avis } from "./reco";

/*
 * « Ce soir » : UNE réponse à « on mange quoi ? », pas une liste.
 * D'abord ce qui est déjà acheté (le plus ancien d'abord : il ne doit pas se perdre),
 * puis ce dont quelqu'un a envie ; un soir de semaine, le plus rapide avance.
 * Un plat à acheter n'arrive qu'à défaut de plat déjà acheté.
 */

export const CE_SOIR = {
  ACHETE: 2,
  PAR_ENVIE: 0.5,
  RAPIDE: 0.5,
  LONG: -0.5,
  /** Acheté depuis longtemps : il passe devant (0,1 par jour, au plus 0,5). */
  PAR_JOUR: 0.1,
  ANCIENNETE_MAX: 0.5,
} as const;

export type CandidatSoir = {
  id: string;
  /** Déjà acheté (dernière course), et depuis combien de jours. */
  achete: boolean;
  joursDepuisAchat: number;
  /** Qui en a envie en ce moment. */
  envies: number;
  minutes: number | null;
};

/** « Autre idée » : un plat écarté ne revient pas en premier pendant ce nombre de jours. */
export const PAS_CE_SOIR_JOURS = 2;

export function choisirCeSoir<C extends CandidatSoir>(
  candidats: C[],
  { semaine, pasCeSoir = new Set() }: { semaine: boolean; pasCeSoir?: Set<string> },
): C[] {
  const note = (c: C) =>
    (c.achete ? CE_SOIR.ACHETE + Math.min(CE_SOIR.ANCIENNETE_MAX, CE_SOIR.PAR_JOUR * c.joursDepuisAchat) : 0) +
    CE_SOIR.PAR_ENVIE * c.envies +
    (semaine && c.minutes ? (c.minutes <= 30 ? CE_SOIR.RAPIDE : c.minutes > 60 ? CE_SOIR.LONG : 0) : 0);
  // Un plat écarté (« Autre idée ») passe après les autres, sans disparaître.
  return [...candidats].sort((a, b) => Number(pasCeSoir.has(a.id)) - Number(pasCeSoir.has(b.id)) || note(b) - note(a) || a.id.localeCompare(b.id));
}

/**
 * « C'était bon ? » : le plat que j'ai mangé hier ou avant-hier, si je n'en ai rien dit depuis.
 * Il passe en tête du paquet ; « Miam », c'est « on le refait », « Bof », c'est un vrai avis.
 */
export function aRedemander(
  cuisines: { recipeId: string; faitLe: number; mangeurs: string[] | null }[],
  profileId: string,
  monAvis: (recipeId: string) => Avis | undefined,
): string | null {
  const pourMoi = cuisines
    .filter((c) => !c.mangeurs || c.mangeurs.includes(profileId))
    .filter((c) => {
      const a = monAvis(c.recipeId);
      return !a || Math.max(a.swipedAt, a.likedAt ?? 0) < c.faitLe;
    })
    .sort((a, b) => b.faitLe - a.faitLe);
  return pourMoi[0]?.recipeId ?? null;
}
