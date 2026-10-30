import { CLASSIQUE_MIN, type RepasCuisine } from "./classiques";
import { listeDeNoms, phraseEnvie } from "./convives";
import { estPourLaRecette } from "./shopping-list";

/*
 * La mémoire de la maison : ce que la famille a mangé, dit en une phrase datée sous le plat de ce soir.
 *
 * - Un dîner décidé (« Ce sera ça ») dont les courses sont faites compte comme mangé, sans « C'est fait » :
 *   la course terminée avec ce plat, au plus 10 jours avant ce soir-là ou jusqu'au lendemain (ou, pour les deux derniers
 *   jours, la liste cochée). Le dîner d'aujourd'hui n'est jamais compté : il n'est pas fini.
 * - Sous le plat, UNE seule raison, la plus vraie : acheté, envie de quelqu'un, classique du jour, adoré il y a…,
 *   classique, aimé, pas fait depuis… ou, à défaut, une idée de Kaddie. Une phrase datée n'est dite que si la date est connue.
 * - Un plat aimé et déjà mangé passe devant une idée neuve (mais jamais devant une envie ni un plat acheté).
 */

const JOUR = 86_400_000;

/** Les courses faites avant ce soir-là comptent jusqu'à ce nombre de jours (comme « acheté aux dernières courses »). */
export const COURSES_AVANT_JOURS = 10;
/** Des courses faites le lendemain comptent encore : on décide le soir, on fait les courses au matin. */
export const COURSES_APRES_JOURS = 1;
/** « Pas fait depuis N jours » ne se dit qu'à partir de ce délai. */
export const PAS_FAIT_JOURS = 10;
/** Un plat à refaire n'a pas été mangé depuis au moins ce nombre de jours (pas deux fois la même semaine). */
export const REFAIT_APRES_JOURS = 7;
/** Au plus, ce nombre de plats à refaire dans la proposition du soir. */
export const REFAIT_MAX = 3;

// ─── Les raisons ──────────────────────────────────────────────────────

/** Les raisons affichées sous le plat. La décision en garde une (ce_soir_choix.raison) : jamais un texte libre. */
export const RAISONS = ["achete", "envie", "classique_jour", "adore", "classique", "aime", "pas_fait", "idee"] as const;
export type RaisonSoir = (typeof RAISONS)[number];

/** Une raison reçue du téléphone : la connue, ou rien. */
export const raisonValide = (x: unknown): RaisonSoir | null => RAISONS.find((r) => r === x) ?? null;

const NOMS_JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const JOURS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Le jour de la semaine à Paris : 0 dimanche … 6 samedi. */
export function jourDeSemaine(ms: number): number {
  return JOURS_EN.indexOf(new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Paris" }).format(new Date(ms)));
}

/** Une durée comme on la dirait : « 12 jours », « 3 semaines », « 2 mois ». */
export function duree(jours: number): string {
  const n = Math.max(1, Math.round(jours));
  if (n < 14) return `${n} jour${n > 1 ? "s" : ""}`;
  if (n < 56) return `${Math.round(n / 7)} semaines`;
  return `${Math.round(n / 30)} mois`;
}

/** « hier », « il y a 5 jours », « il y a 3 semaines ». */
export const ilYa = (jours: number) => (jours < 1.5 ? "hier" : `il y a ${duree(jours)}`);

// ─── Ce qui a été mangé ───────────────────────────────────────────────

export type Histoire = {
  /** Combien de fois il a été mangé. */
  fois: number;
  /** La dernière fois (ms). */
  dernier: number;
  /** Combien de fois, par jour de la semaine (0 dimanche … 6 samedi). */
  parJour: number[];
};

/** Pour chaque plat : combien de fois, la dernière fois, et les jours de la semaine. */
export function histoireDesRepas(repas: RepasCuisine[]): Map<string, Histoire> {
  const histoires = new Map<string, Histoire>();
  for (const r of repas) {
    const h = histoires.get(r.recipeId) ?? { fois: 0, dernier: 0, parJour: Array(7).fill(0) as number[] };
    h.fois += 1;
    h.dernier = Math.max(h.dernier, r.faitLe);
    h.parJour[jourDeSemaine(r.faitLe)] += 1;
    histoires.set(r.recipeId, h);
  }
  return histoires;
}

/** Le jour où la maison mange d'habitude ce plat : au moins 3 fois ce jour-là, et 60 % des fois. Sinon rien. */
export function jourHabituel(h: Histoire): number | null {
  if (h.fois < CLASSIQUE_MIN) return null;
  const max = Math.max(...h.parJour);
  return max >= 3 && max / h.fois >= 0.6 ? h.parJour.indexOf(max) : null;
}

/** Un dîner décidé : le plat et le jour (« 2026-10-28 », à Paris). */
export type Decision = { recipeId: string; jour: string };
/** Des courses faites (ou une liste cochée) : quand, et les plats qu'elles couvraient. */
export type CourseFaite = { le: number; recettes: string[] };

/** Des courses finies à `le` couvrent-elles le dîner de ce jour-là ? Avant ce soir-là (10 jours au plus) ou jusqu'au lendemain. */
export function courseCouvreLeDiner(jour: string, le: number): boolean {
  const debutDuJour = Date.parse(`${jour}T00:00:00Z`);
  return le >= debutDuJour - COURSES_AVANT_JOURS * JOUR && le < debutDuJour + (1 + COURSES_APRES_JOURS) * JOUR;
}

/**
 * Les dîners décidés dont les courses sont faites : mangés, sans « C'est fait ». Le dîner d'aujourd'hui n'est pas compté.
 * Un dîner déjà marqué « C'est fait » à deux jours près n'est pas compté deux fois.
 */
export function mangesDeduits(decisions: Decision[], courses: CourseFaite[], explicites: RepasCuisine[], aujourdhui: string): RepasCuisine[] {
  return decisions.flatMap((d) => {
    if (d.jour >= aujourdhui) return [];
    const faitLe = Date.parse(`${d.jour}T20:00:00Z`);
    const faite = courses.some((c) => c.recettes.includes(d.recipeId) && courseCouvreLeDiner(d.jour, c.le));
    const dejaDit = explicites.some((e) => e.recipeId === d.recipeId && Math.abs(e.faitLe - faitLe) <= 2 * JOUR);
    return faite && !dejaDit ? [{ recipeId: d.recipeId, faitLe }] : [];
  });
}

/**
 * Les plats de la course en cours dont toute la liste est cochée (tous les articles « pour » ce plat sont dans le caddie).
 * Sert à la carte « C'était bon ? » le lendemain, quand « J'ai fini les courses » n'a pas été touché.
 */
export function platsCoches(menu: { id: string; titre: string }[], articles: { for_recipes?: string | null; source: string; checked: boolean }[]): string[] {
  return menu
    .filter((p) => {
      const siens = articles.filter((a) => a.source === "recipe" && estPourLaRecette(a.for_recipes, p.titre, menu.map((m) => m.titre)));
      return siens.length > 0 && siens.every((a) => a.checked);
    })
    .map((p) => p.id);
}

// ─── La phrase sous le plat ───────────────────────────────────────────

export type PlatDuSoir = {
  /** Déjà acheté aux dernières courses. */
  achete: boolean;
  /** Les prénoms de celles et ceux qui en ont envie en ce moment. */
  qui: string[];
  /** Ce que la maison en a mangé, si elle l'a mangé. */
  histoire?: Histoire;
  /** J'ai aimé ce plat (un « Miam »). */
  aime: boolean;
  /** J'ai dit « Miam » après l'avoir mangé : adoré. */
  adore: boolean;
};

/** La raison de proposer ce plat ce soir, en une phrase, et sa clé (gardée avec la décision). La plus vraie d'abord. */
export function raisonDuSoir(p: PlatDuSoir, { moi, now }: { moi: string; now: number }): { texte: string; raison: RaisonSoir } {
  if (p.achete) return { texte: "Déjà acheté aux dernières courses", raison: "achete" };
  if (p.qui.length) return { texte: phraseEnvie(p.qui, moi), raison: "envie" };
  const h = p.histoire;
  const depuis = h ? (now - h.dernier) / JOUR : 0;
  const habituel = h ? jourHabituel(h) : null;
  if (h && habituel != null && habituel === jourDeSemaine(now)) return { texte: `Votre classique du ${NOMS_JOURS[habituel]}`, raison: "classique_jour" };
  if (h && p.adore) return { texte: `Adoré ${ilYa(depuis)}`, raison: "adore" };
  if (h && h.fois >= CLASSIQUE_MIN) {
    return depuis >= PAS_FAIT_JOURS ? { texte: `Pas fait depuis ${duree(depuis)}`, raison: "pas_fait" } : { texte: `Un classique : ${h.fois} fois`, raison: "classique" };
  }
  if (p.aime) return { texte: "Tu l'avais aimé", raison: "aime" };
  if (h && depuis >= PAS_FAIT_JOURS) return { texte: `Pas fait depuis ${duree(depuis)}`, raison: "pas_fait" };
  return { texte: "Une idée de Kaddie", raison: "idee" };
}

/**
 * Les plats à refaire : aimés (ou classiques) et déjà mangés, pas depuis une semaine. Les plus anciens d'abord : la maison tourne.
 * Un plat que j'ai écarté (« Bof ») n'en fait jamais partie.
 */
export function platsARefaire(
  histoires: Map<string, Histoire>,
  { aimes, ecartes, now, max = REFAIT_MAX }: { aimes: Set<string>; ecartes: Set<string>; now: number; max?: number },
): { recipeId: string; jours: number }[] {
  return [...histoires]
    .filter(([id, h]) => !ecartes.has(id) && (aimes.has(id) || h.fois >= CLASSIQUE_MIN))
    .map(([recipeId, h]) => ({ recipeId, jours: (now - h.dernier) / JOUR }))
    .filter((x) => x.jours >= REFAIT_APRES_JOURS)
    .sort((a, b) => b.jours - a.jours || a.recipeId.localeCompare(b.recipeId))
    .slice(0, max);
}

/** « comme Karin le voulait », « comme Karin et Léo le voulaient » ; rien si personne d'autre que moi n'en avait envie. */
export function commeVoulu(noms: string[]): string | null {
  return noms.length ? `comme ${listeDeNoms(noms)} ${noms.length > 1 ? "le voulaient" : "le voulait"}` : null;
}
