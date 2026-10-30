/**
 * Le moteur de recommandation de Kaddie : des règles explicites, déterministes,
 * sans hasard ni IA. Tout se calcule à partir de ce que la famille a déjà fait.
 *
 * Trois notions qu'on ne confond jamais :
 * - GOÛT durable : « j'aime ce plat » (dernier like, liked_at) ou « pas pour moi »
 *   (« Bof » sans l'avoir jamais aimé), plus les goûts du questionnaire. S'estompe
 *   doucement avec le temps : les goûts changent.
 * - ENVIE ponctuelle : un like récent (ENVIE_JOURS) pas encore « mangé »
 *   (le plat n'a pas été acheté depuis). « Bof » sur un plat aimé = pas envie
 *   maintenant, sans oublier qu'on l'aime.
 * - REPAS RETENU : un plat gardé pour une course (trip_recipes), avec qui le mange.
 *
 * Un match = au moins 2 personnes ont envie du même plat : une compatibilité entre
 * ces personnes, pas un repas décidé. Personne d'autre n'entre dans le calcul :
 * ne pas avoir voté n'est jamais un refus.
 *
 * Sécurité : un interdit (régime, allergie) exclut le plat, aucun score ne le rattrape.
 */

/** Tous les réglages du moteur, au même endroit. Les durées sont en jours. */
export const REGLAGES = {
  /** Une envie dure deux cycles de courses hebdomadaires. */
  ENVIE_JOURS: 14,
  /** Un plat aimé revient dans le paquet après 3 semaines : on retrouve ses favoris sans qu'ils tournent en boucle. */
  RETOUR_AIME_JOURS: 21,
  /** Un plat refusé (« Bof », jamais aimé) revient après 3 mois : les goûts changent, lentement. Avant, 6 semaines. */
  RETOUR_REFUSE_JOURS: 90,
  /** Dans le paquet, un plat déjà vu revient au plus une carte sur 5 (le reste : des découvertes). */
  RYTHME_RETOUR: 5,

  // ─── Score individuel (de −1 à 1 ; null = on ne sait rien) ───
  AIME: 0.6,
  REFUSE: -0.5,
  INGREDIENT_ADORE: 0.4,
  INGREDIENT_PAS_FAN: -0.6,
  STYLE_VOULU: 0.2,
  TROP_LONG: -0.2,
  /** Un avis compte moitié moins au bout de 90 jours. */
  DEMI_VIE_GOUT_JOURS: 90,
  /** Un « non » sur un plat s'efface plus vite (« pas ce soir ») : moitié moins au bout de 30 jours. */
  DEMI_VIE_REFUS_JOURS: 30,
  /** Note prédite par les caractéristiques (style, aliments, temps), pour un plat jamais swipé. */
  PREDICTION: 0.5,

  // ─── Compatibilité d'un groupe ───
  /** Pénalité appliquée au pire avis négatif du groupe (un désaccord pèse). */
  DESACCORD: 0.5,

  // ─── Contexte ───
  /** Paquet : un autre membre l'aimerait probablement (prédiction) — viser les matchs. */
  MATCH_PROBABLE: 0.3,
  /** Paquet : ce style a déjà été retenu cette semaine — il recule (par fois, au plus 2). */
  LASSITUDE: 0.15,
  /** Paquet du moment (soir de semaine) : un plat rapide avance, un plat long recule. */
  MOMENT_RAPIDE: 0.35,
  MOMENT_LONG: -0.35,
  /** « Rapide » : 30 min ou moins ; « long » : plus de 45 min. */
  RAPIDE_MINUTES: 30,
  LONG_MINUTES: 45,
  /** Pour une course : part du groupe qui en a envie maintenant. */
  ENVIE: 0.5,
  /** Demandé pour cette course : la plus forte des envies. */
  DEMANDE: 1,
  /** Retenu récemment : pénalité qui s'efface (demi-vie 10 jours). */
  DEJA_RETENU: -0.8,
  DEMI_VIE_REPETITION_JOURS: 10,
  /** Proposé puis retiré à une course récente. */
  ECARTE: -0.2,
  /** Équité : par course récente (3 au plus) sans aucun plat pour cette personne. */
  OUBLIE: 0.15,
  OUBLIE_MAX: 3,
  /** Paquet : d'autres en ont envie (aide les matchs à naître). Une vraie envie passe avant une prédiction. */
  ENVIE_DES_AUTRES: 0.6,
  /** Paquet : au plus ce nombre de plats « Ta voix fait le match » passent en tête. */
  VOIX_MANQUANTE_MAX: 3,
  /** Un membre qui a swipé moins de plats que ça est « nouveau » : il voit d'abord ce dont la famille a envie. */
  NOUVEAU_SWIPES: 8,
  NOUVEAU_MAX: 5,
  /** Paquet : personne de la famille ne l'a encore vu. */
  DECOUVERTE: 0.1,
  /** Paquet : un autre membre n'aime pas un ingrédient (hors mode strict). */
  AUTRE_PAS_FAN: -1,
} as const;

const JOUR = 86_400_000;
const demiVie = (ageJours: number, demiVieJours: number) => Math.pow(0.5, Math.max(0, ageJours) / demiVieJours);
const borne = (x: number) => Math.max(-1, Math.min(1, x));

/** Le dernier swipe d'une personne sur un plat (dates en ms). */
export type Avis = { liked: boolean; swipedAt: number; likedAt: number | null };

/** Ce qu'on sait d'une personne face à un plat. */
export type Signaux = {
  avis?: Avis;
  /** Questionnaire : un ingrédient « j'adore » / « j'aime pas ». */
  adore?: boolean;
  pasFan?: boolean;
  /** Ses envies : le plat est dans ses styles / plus long que son temps. */
  style?: boolean;
  tropLong?: boolean;
  /** Note prédite par ses goûts sur les caractéristiques du plat (profil-gouts.ts), −1 à 1. */
  prediction?: number | null;
};

/** Goût durable d'une personne pour un plat, de −1 à 1. null : aucune information (jamais un refus). */
export function scoreIndividuel(s: Signaux, now: number): number | null {
  let score = 0;
  let connu = false;
  if (s.avis) {
    connu = true;
    if (s.avis.likedAt != null) score += REGLAGES.AIME * demiVie((now - s.avis.likedAt) / JOUR, REGLAGES.DEMI_VIE_GOUT_JOURS);
    else if (!s.avis.liked) score += REGLAGES.REFUSE * demiVie((now - s.avis.swipedAt) / JOUR, REGLAGES.DEMI_VIE_REFUS_JOURS);
  }
  if (s.prediction != null) (score += REGLAGES.PREDICTION * s.prediction), (connu = true);
  if (s.adore) (score += REGLAGES.INGREDIENT_ADORE), (connu = true);
  if (s.pasFan) (score += REGLAGES.INGREDIENT_PAS_FAN), (connu = true);
  if (s.style) (score += REGLAGES.STYLE_VOULU), (connu = true);
  if (s.tropLong) (score += REGLAGES.TROP_LONG), (connu = true);
  return connu ? borne(score) : null;
}

/** Envie active : un like récent, et le plat n'a pas été acheté depuis. */
export function estEnvie(avis: Avis | undefined, dernierAchat: number | null, now: number): boolean {
  return Boolean(
    avis?.liked && now - avis.swipedAt < REGLAGES.ENVIE_JOURS * JOUR && (dernierAchat == null || dernierAchat < avis.swipedAt),
  );
}

/**
 * Compatibilité d'un plat pour un groupe : la moyenne des goûts (inconnu = neutre),
 * moins une part du pire désaccord. Chaque personne compte pour une voix, qu'elle
 * swipe beaucoup ou peu.
 */
export function compatibilite(scores: (number | null)[]): number {
  if (scores.length === 0) return 0;
  const connus = scores.filter((s): s is number => s != null);
  const moyenne = connus.reduce((a, b) => a + b, 0) / scores.length;
  const pire = connus.length ? Math.min(...connus) : 0;
  return moyenne - REGLAGES.DESACCORD * Math.max(0, -pire);
}

// ─── Matchs ────────────────────────────────────────────────────────────

export type MatchCalcule = { recipeId: string; likers: string[]; matchedAt: number; expiresAt: number };

/**
 * Les matchs : au moins 2 personnes ont envie du même plat. Les plus partagés d'abord,
 * puis les plus récents. Personne d'autre n'entre dans le calcul.
 */
export function calculerMatchs(
  avisParRecette: Map<string, Map<string, Avis>>,
  dernierAchat: (recipeId: string) => number | null,
  now: number,
  exclu: (recipeId: string) => boolean = () => false,
): MatchCalcule[] {
  const matchs: MatchCalcule[] = [];
  for (const [recipeId, avis] of avisParRecette) {
    if (exclu(recipeId)) continue;
    const achat = dernierAchat(recipeId);
    const envies = [...avis].filter(([, a]) => estEnvie(a, achat, now)).sort(([, a], [, b]) => a.swipedAt - b.swipedAt);
    if (envies.length < 2) continue;
    const dates = envies.map(([, a]) => a.swipedAt).sort((a, b) => b - a);
    matchs.push({
      recipeId,
      likers: envies.map(([id]) => id),
      matchedAt: dates[0],
      // Le match tombe quand il ne reste plus 2 envies : à l'expiration de la 2e plus récente.
      expiresAt: dates[1] + REGLAGES.ENVIE_JOURS * JOUR,
    });
  }
  return matchs.sort((a, b) => b.likers.length - a.likers.length || b.matchedAt - a.matchedAt);
}

// ─── Paquet de swipe ───────────────────────────────────────────────────

export type CartePaquet = {
  id: string;
  created_at: string;
  /** Exclu : interdit dans la famille, ou je n'aime pas un ingrédient, ou mode strict. */
  cache: boolean;
  /** Un autre membre n'aime pas un ingrédient (hors mode strict) : en fin de paquet. */
  fin: boolean;
  /** Mon dernier swipe. */
  avis?: Avis;
  /** Mes signaux (questionnaire, envies). */
  signaux: Signaux;
  /** Combien d'autres personnes en ont envie en ce moment. */
  enviesDesAutres: number;
  /** Quelqu'un de la famille l'a-t-il déjà swipé ? */
  vuParLaFamille: boolean;
  /** Style du plat (pour varier), null si inconnu. */
  style: string | null;
  /** Durée totale (minutes), si connue : sert au paquet du moment. */
  minutes?: number | null;
  /** Chance qu'un autre membre en ait envie (sa note prédite, 0 à 1). */
  matchProbable?: number;
  /** Combien de plats de ce style ont été retenus cette semaine. */
  lassitude?: number;
};

/** Le moment : un soir de semaine, on a peu de temps ; le reste du temps, on a le temps de découvrir. */
export type Moment = "rapide" | null;

/** Revoir à la demande : ses plats aimés ou ses plats refusés. */
export type Revoir = "aimes" | "refuses" | null;

/** Lundi à jeudi, à partir de 15 h (heure de Paris) : le paquet favorise les plats rapides. */
export function momentDe(date: Date): Moment {
  const parts = new Intl.DateTimeFormat("fr-FR", { weekday: "short", hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).formatToParts(date);
  const jour = parts.find((p) => p.type === "weekday")?.value ?? "";
  const heure = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return ["lun.", "mar.", "mer.", "jeu."].includes(jour) && heure >= 15 ? "rapide" : null;
}

/**
 * Mon paquet : d'abord des plats jamais vus, les plus pertinents pour moi d'abord
 * (mes goûts, ce dont les autres ont envie, la découverte) ; un plat déjà vu et revenu
 * (aimé : 3 semaines, refusé : 6 semaines) toutes les RYTHME_RETOUR cartes ;
 * pas plus de deux plats du même style d'affilée quand on peut l'éviter ;
 * les plats qu'un autre n'aime pas à la fin. Quand il n'y a plus de nouveauté, le paquet est court, voire vide : l'écran le dit
 * (source épuisée ou en panne) et propose de revoir ses plats à la demande ; rien n'est rejoué automatiquement.
 */
export function ordonnerPaquet<C extends CartePaquet>(cartes: C[], now: number, moment: Moment = null, revoir: Revoir = null): C[] {
  // Revoir, à la demande : les plats aimés, ou ceux qu'on a refusés, du plus récent au plus ancien. Jamais mélangé aux nouveautés, jamais automatique.
  if (revoir) {
    const voulu = (c: C) => (revoir === "aimes" ? c.avis?.likedAt != null : c.avis != null && c.avis.likedAt == null && !c.avis.liked);
    return cartes.filter((c) => !c.cache && !c.fin && voulu(c)).sort((a, b) => b.avis!.swipedAt - a.avis!.swipedAt);
  }
  const disponible = (c: C) => {
    if (!c.avis) return true;
    const jours = c.avis.likedAt != null ? REGLAGES.RETOUR_AIME_JOURS : REGLAGES.RETOUR_REFUSE_JOURS;
    return now - c.avis.swipedAt >= jours * JOUR;
  };
  const score = (c: C) =>
    (scoreIndividuel(c.signaux, now) ?? 0) +
    REGLAGES.ENVIE_DES_AUTRES * Math.min(1, c.enviesDesAutres / 2) +
    (c.vuParLaFamille ? 0 : REGLAGES.DECOUVERTE) +
    (c.fin ? REGLAGES.AUTRE_PAS_FAN : 0) +
    REGLAGES.MATCH_PROBABLE * (c.matchProbable ?? 0) -
    REGLAGES.LASSITUDE * Math.min(2, c.lassitude ?? 0) +
    (moment === "rapide" && c.minutes
      ? c.minutes <= REGLAGES.RAPIDE_MINUTES
        ? REGLAGES.MOMENT_RAPIDE
        : c.minutes > REGLAGES.LONG_MINUTES
          ? REGLAGES.MOMENT_LONG
          : 0
      : 0);
  const scores = new Map(cartes.map((c) => [c.id, score(c)]));
  const parScore = (a: C, b: C) => scores.get(b.id)! - scores.get(a.id)! || b.created_at.localeCompare(a.created_at);

  const visibles = cartes.filter((c) => !c.cache && disponible(c));
  const finales = visibles.filter((c) => c.fin).sort(parScore);
  const nouvelles = visibles.filter((c) => !c.fin && !c.avis).sort(parScore);
  const retours = visibles
    .filter((c) => !c.fin && c.avis)
    .sort((a, b) => scores.get(b.id)! - scores.get(a.id)! || a.avis!.swipedAt - b.avis!.swipedAt);

  // Un retour toutes les RYTHME_RETOUR cartes, tant qu'il reste des nouveautés.
  const melange: C[] = [];
  let r = 0;
  for (const c of nouvelles) {
    if (r < retours.length && melange.length % REGLAGES.RYTHME_RETOUR === REGLAGES.RYTHME_RETOUR - 1) melange.push(retours[r++]);
    melange.push(c);
  }
  melange.push(...retours.slice(r));
  // Plus rien de nouveau : on ne remplit PAS la pile avec des plats refusés ou déjà vus pour cacher un manque de contenu. Les retours (aimés après
  // 3 semaines, refusés après 3 mois) restent au rythme prévu ; le reste se revoit à la demande (paramètre « revoir »).
  return [...varier(melange), ...finales];
}

/**
 * « Ta voix fait le match » : un plat dont une seule autre personne a envie devient un match
 * si j'en ai envie aussi. Ces plats passent en tête du paquet (au plus VOIX_MANQUANTE_MAX),
 * dans l'ordre du paquet ; seulement ceux qui y sont déjà (disponibles pour moi), et jamais
 * un plat qu'un autre membre n'aime pas (exclu).
 *
 * Un nouveau membre (moins de NOUVEAU_SWIPES swipes) voit d'abord ce dont la famille a déjà envie,
 * même à plusieurs, les plus voulus en premier (NOUVEAU_MAX au plus) : son premier « Miam »
 * fait un match tout de suite. Renvoie aussi, pour chaque plat avancé, qui en a envie.
 */
export function avancerLesVoixManquantes<C extends { id: string }>(
  paquet: C[],
  envies: Map<string, string[]>,
  moi: string,
  exclu: (id: string) => boolean = () => false,
  { nouveau = false }: { nouveau?: boolean } = {},
): { paquet: C[]; voix: Map<string, string[]> } {
  const voix = new Map<string, string[]>();
  const autres = (id: string) => (envies.get(id) ?? []).filter((p) => p !== moi);
  const max = nouveau ? REGLAGES.NOUVEAU_MAX : REGLAGES.VOIX_MANQUANTE_MAX;
  const candidats = paquet.filter((c) => {
    const qui = autres(c.id);
    return !exclu(c.id) && (nouveau ? qui.length >= 1 : qui.length === 1 && (envies.get(c.id) ?? []).length === 1);
  });
  // Nouveau : les plus voulus d'abord (le tri est stable : à égalité, l'ordre du paquet reste).
  const choisis = (nouveau ? [...candidats].sort((a, b) => autres(b.id).length - autres(a.id).length) : candidats).slice(0, max);
  for (const c of choisis) voix.set(c.id, autres(c.id));
  if (voix.size === 0) return { paquet, voix };
  return { paquet: [...choisis, ...paquet.filter((c) => !voix.has(c.id))], voix };
}

/** Évite trois plats du même style d'affilée, en avançant le suivant d'un autre style (fenêtre de 3). */
function varier<C extends { style: string | null }>(liste: C[]): C[] {
  const out = [...liste];
  for (let i = 2; i < out.length; i++) {
    const s = out[i].style;
    if (!s || out[i - 1].style !== s || out[i - 2].style !== s) continue;
    const j = out.findIndex((c, k) => k > i && k <= i + 3 && c.style !== s);
    if (j > 0) [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Plats d'une course ────────────────────────────────────────────────

export type CandidatCourse = {
  id: string;
  /** Qui l'a demandé pour cette course (profils). */
  demandePar: string[];
  /** Qui en a envie en ce moment. */
  enviePar: string[];
  /** Qui l'aime (goût durable), pour les idées. */
  aimePar: string[];
  /** Le choix déjà enregistré pour cette course, s'il y en a un. */
  choix?: { selected: boolean; people: number | null; eaters: string[] | null };
  /** Exclu : un interdit dans la famille (ou mode strict). Jamais rattrapé. */
  exclu: boolean;
  /** Goût de chaque membre pour ce plat (null = inconnu). */
  gouts: Map<string, number | null>;
  /** Jours depuis la dernière fois qu'il a été retenu (null = jamais récemment). */
  joursDepuisRetenu: number | null;
  /** Proposé puis retiré à une course récente. */
  ecarte: boolean;
};

export type PlatClasse = {
  id: string;
  /** Proposé d'office par Kaddie (demandé, ou envie de plusieurs). */
  propose: boolean;
  /** Gardé pour cette course (choix enregistré, sinon la proposition). */
  checked: boolean;
  /** Qui le mange (profils) et pour combien (invités compris). */
  eaters: string[];
  people: number;
  /** Pourquoi il est là, en clair. */
  raison: { type: "demande" | "envie" | "aime" | "famille"; qui: string[] };
  score: number;
  /** Choisi à la main alors qu'il contient un interdit (ou un « j'aime pas » en mode strict) : on prévient. */
  attention?: boolean;
};

/**
 * Classe les plats d'une course :
 * - qui le mange : ceux qui l'ont demandé ou en ont envie ; à défaut ceux qui l'aiment ;
 *   à défaut toute la famille (le choix enregistré l'emporte) ;
 * - score : compatibilité de ce groupe + contexte (demande, envies, répétition, équité) ;
 * - proposés d'office : demandés ou envie de plusieurs (MAX au plus), les mieux classés ;
 *   quand une seule personne swipe (seule dans la famille, ou les autres pas encore là),
 *   son envie suffit : Kaddie est utile dès le premier jour ;
 *   le reste (« autres idées ») passe à tour de rôle par personne, pour que personne
 *   ne soit oublié parce que ses goûts sont minoritaires ;
 * - une fois la liste faite (ouverte = false), plus rien n'est coché d'office.
 */
export function classerPlats(
  candidats: CandidatCourse[],
  {
    membres,
    oubli,
    ouverte,
    max,
    actifs = membres.length,
  }: {
    membres: string[];
    oubli: Map<string, number>;
    ouverte: boolean;
    max: number;
    /** Combien de membres swipent vraiment (récemment) ; par défaut, tous. */
    actifs?: number;
  },
): PlatClasse[] {
  // Un plat exclu par les goûts n'est jamais proposé… sauf s'il a été choisi à la main :
  // un choix ne disparaît jamais en silence (il est gardé, avec un avertissement).
  const plats = candidats
    .filter((c) => !c.exclu || c.choix?.selected)
    .map((c) => {
      const voulu = [...new Set([...c.demandePar, ...c.enviePar])];
      const derives = voulu.length ? voulu : c.aimePar.length ? c.aimePar : membres;
      const eaters = c.choix?.eaters?.length ? c.choix.eaters : derives;
      const type: PlatClasse["raison"]["type"] = c.demandePar.length
        ? "demande"
        : c.enviePar.length
          ? "envie"
          : c.aimePar.length
            ? "aime"
            : "famille";
      const qui = type === "demande" ? c.demandePar : type === "envie" ? c.enviePar : type === "aime" ? c.aimePar : [];
      const equite = Math.max(0, ...eaters.map((e) => Math.min(REGLAGES.OUBLIE_MAX, oubli.get(e) ?? 0)));
      const score =
        compatibilite(eaters.map((e) => c.gouts.get(e) ?? null)) +
        (c.demandePar.length ? REGLAGES.DEMANDE : 0) +
        REGLAGES.ENVIE * (c.enviePar.filter((e) => eaters.includes(e)).length / eaters.length) +
        (c.joursDepuisRetenu != null ? REGLAGES.DEJA_RETENU * demiVie(c.joursDepuisRetenu, REGLAGES.DEMI_VIE_REPETITION_JOURS) : 0) +
        (c.ecarte ? REGLAGES.ECARTE : 0) +
        REGLAGES.OUBLIE * equite;
      return {
        c,
        proposable: c.demandePar.length > 0 || c.enviePar.length >= Math.max(1, Math.min(2, actifs)),
        plat: { id: c.id, eaters, people: c.choix?.people ?? eaters.length, raison: { type, qui }, score, ...(c.exclu ? { attention: true } : {}) },
      };
    });

  const parScore = (a: (typeof plats)[number], b: (typeof plats)[number]) => b.plat.score - a.plat.score || a.c.id.localeCompare(b.c.id);
  const proposes = new Set(plats.filter((p) => p.proposable).sort(parScore).slice(0, max).map((p) => p.c.id));
  const classes: PlatClasse[] = plats.map((p) => {
    const propose = proposes.has(p.c.id);
    return { ...p.plat, propose, checked: p.c.choix ? p.c.choix.selected : ouverte && propose };
  });

  const gardes = classes.filter((p) => p.checked).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return [...gardes, ...aTourDeRole(classes.filter((p) => !p.checked), membres, oubli)];
}

/**
 * Les autres idées, à tour de rôle : à chaque tour, la meilleure idée de chaque personne
 * (les plus oubliées des dernières courses d'abord), puis on recommence.
 */
function aTourDeRole(idees: PlatClasse[], membres: string[], oubli: Map<string, number>): PlatClasse[] {
  const restantes = [...idees].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const ordre = [...membres].sort((a, b) => (oubli.get(b) ?? 0) - (oubli.get(a) ?? 0));
  const out: PlatClasse[] = [];
  while (restantes.length) {
    let pris = false;
    for (const m of ordre) {
      const i = restantes.findIndex((p) => p.raison.qui.includes(m));
      if (i >= 0) out.push(...restantes.splice(i, 1)), (pris = true);
    }
    if (!pris) out.push(...restantes.splice(0));
  }
  return out;
}

/** Équité : pour chaque membre, combien des dernières courses (les plus récentes d'abord) ne lui ont servi aucun plat. */
export function oubliParMembre(courses: { eaters: Set<string> | null }[], membres: string[]): Map<string, number> {
  const oubli = new Map<string, number>();
  for (const m of membres) {
    let n = 0;
    for (const c of courses.slice(0, REGLAGES.OUBLIE_MAX)) {
      if (!c.eaters) break; // course sans information : on ne suppose rien
      if (c.eaters.has(m)) break;
      n++;
    }
    oubli.set(m, n);
  }
  return oubli;
}
