import "server-only";
import { cache } from "react";
import {
  conflictsOf,
  getAppris,
  getCoursesPassees,
  getCurrentTrip,
  getFamilyEnvies,
  getFamilySwipes,
  getHistorique,
  getRecipesWithIngredients,
  getTasteContext,
  getProfiles,
  getRecipes,
  signauxDe,
  type Profile,
  type Recipe,
  type Trip,
  type TripRequest,
} from "@/lib/data";
import { isPastDeadline } from "@/lib/domain/trip";
import type { Convives } from "@/lib/domain/convives";
import { cleMaison } from "@/lib/domain/maison";
import { aAjouter, type Suggestion } from "@/lib/domain/habitudes";
import { cleProduit } from "@/lib/domain/reconnaissance";
import { nAimePas } from "@/lib/domain/foods";
import { listeDeNoms } from "@/lib/domain/convives";
import { lireEnvies } from "@/lib/domain/envies";
import { classerPlats, compatibilite, oubliParMembre, scoreIndividuel, type CandidatCourse, type PlatClasse } from "@/lib/domain/reco";

/** Au plus, Kaddie retient d'elle-même ce nombre de plats. */
export const MAX_PROPOSES = 5;
/** Idées tirées des goûts durables (plats aimés), en plus des demandes et des envies. */
export const IDEES_MAX = 6;
/** Un plat retenu il y a moins de 2 semaines n'est pas reproposé comme idée. */
const IDEE_PAS_AVANT_JOURS = 14;
const JOUR = 86_400_000;

export type PlatDeLaCourse = {
  id: string;
  /** Gardé pour cette course (choix enregistré, sinon la proposition de Kaddie). */
  checked: boolean;
  /** Proposé d'office par Kaddie : demandé, ou envie de plusieurs personnes. */
  propose: boolean;
  /** Qui le mange (profils), et le libellé « pour qui ». */
  eaters: string[];
  convives: Convives;
  /** Pourquoi il est là : demandé par…, envie de…, aimé par…, pour toute la famille. */
  raison: PlatClasse["raison"];
  /** Choisi malgré un interdit ou un « j'aime pas » (mode strict) : « Interdit pour Madji ». */
  attention: string | null;
};

/**
 * Les plats d'une course, classés par le moteur (classerPlats, lib/domain/reco.ts) :
 * demandes, envies du moment (de tout le monde, y compris la personne qui fait les
 * courses), choix déjà faits, et quelques idées tirées des plats aimés.
 * Sert à l'écran de préparation ET au calcul de la liste : les deux voient la même chose.
 */
export async function platsDeLaCourse(familyId: string, trip: Trip): Promise<PlatDeLaCourse[]> {
  const [members, envies, avis, hist, recipes, tastes] = await Promise.all([
    getProfiles(familyId),
    getFamilyEnvies(familyId),
    getFamilySwipes(familyId),
    getHistorique(familyId),
    getRecipes(familyId),
    getTasteContext(familyId),
  ]);
  const now = Date.now();
  const ids = members.map((m) => m.id);
  const noms = new Map(members.map((m) => [m.id, m.name]));
  const enviesDe = new Map(members.map((m) => [m.id, lireEnvies(m.envies)]));
  const recettes = new Map(recipes.map((r) => [r.id, r]));
  const explicites = new Map(trip.trip_recipes.map((r) => [r.recipe_id, r]));
  const demandes = new Map<string, string[]>();
  for (const r of trip.trip_requests) {
    if (r.profile_id === trip.created_by) continue;
    for (const id of r.recipe_ids) demandes.set(id, [...(demandes.get(id) ?? []), r.profile_id]);
  }
  const conflits = new Map<string, ReturnType<typeof conflictsOf>>();
  const conflitsDe = (r: Recipe) => conflits.get(r.id) ?? conflits.set(r.id, conflictsOf(tastes, r)).get(r.id)!;
  const goutsDe = (r: Recipe) =>
    new Map(
      ids.map((id) => [
        id,
        scoreIndividuel(signauxDe(id, r, conflitsDe(r), enviesDe.get(id)!, tastes.texts.get(r.id) ?? [r.title], avis.get(r.id)?.get(id)), now),
      ]),
    );
  const aimePar = (id: string) => [...(avis.get(id) ?? [])].filter(([, a]) => a.likedAt != null).map(([m]) => m);
  const joursDepuisRetenu = (id: string) => (hist.retenus.has(id) ? (now - hist.retenus.get(id)!) / JOUR : null);

  // Idées : des plats aimés par quelqu'un, pas retenus récemment, les plus compatibles d'abord.
  const base = new Set([...demandes.keys(), ...envies.keys(), ...explicites.keys()]);
  const idees = recipes
    .filter((r) => !base.has(r.id) && aimePar(r.id).length > 0 && !conflitsDe(r).familleCache)
    .filter((r) => (joursDepuisRetenu(r.id) ?? Infinity) >= IDEE_PAS_AVANT_JOURS)
    .map((r) => {
      const gouts = goutsDe(r);
      return { id: r.id, note: compatibilite(aimePar(r.id).map((m) => gouts.get(m) ?? null)) };
    })
    .sort((a, b) => b.note - a.note)
    .slice(0, IDEES_MAX)
    .map((x) => x.id);

  const candidats: CandidatCourse[] = [...base, ...idees].flatMap((id) => {
    const r = recettes.get(id);
    if (!r) return [];
    const choix = explicites.get(id);
    return [
      {
        id,
        demandePar: demandes.get(id) ?? [],
        enviePar: envies.get(id) ?? [],
        aimePar: aimePar(id),
        choix: choix && { selected: choix.selected, people: choix.people ?? null, eaters: choix.eaters ?? null },
        exclu: conflitsDe(r).familleCache,
        gouts: goutsDe(r),
        joursDepuisRetenu: joursDepuisRetenu(id),
        ecarte: hist.ecartes.has(id),
      },
    ];
  });

  // Qui swipe vraiment (30 derniers jours) : seul·e, une envie suffit pour être proposée.
  const actifs = new Set<string>();
  for (const parMembre of avis.values()) for (const [m, a] of parMembre) if (now - a.swipedAt < 30 * JOUR) actifs.add(m);

  return classerPlats(candidats, {
    membres: ids,
    actifs: actifs.size,
    oubli: oubliParMembre(hist.courses, ids),
    ouverte: trip.status !== "validated",
    max: MAX_PROPOSES,
  }).map((p) => ({
    id: p.id,
    checked: p.checked,
    propose: p.propose,
    eaters: p.eaters,
    raison: p.raison,
    attention: p.attention ? attentionPour(conflits.get(p.id)) : null,
    convives: {
      noms: p.eaters.length >= ids.length ? "famille" : p.eaters.flatMap((id) => noms.get(id) ?? []),
      n: p.people,
      corrige: explicites.get(p.id)?.people != null,
    },
  }));
}

export type CandidateRecipe = Recipe & PlatDeLaCourse;

export type TripOverview = {
  trip: Trip;
  /** Celui ou celle qui fait les courses (null si son profil a été retiré). */
  shopper: Profile | null;
  /** Le profil connecté fait-il ces courses ? */
  iAmShopper: boolean;
  members: Profile[];
  /** Les réponses des autres membres. */
  responses: { member: Profile; request: TripRequest | null; recipes: Recipe[] }[];
  candidates: CandidateRecipe[];
  pastDeadline: boolean;
  nobodyAnswered: boolean;
  /** Ingrédients des plats gardés, sans doute déjà à la maison : à vérifier avant de partir. */
  aVerifier: string[];
  /** Pas pris la dernière fois, et achats habituels : à ajouter d'un geste (rien d'office). */
  reportes: Suggestion[];
  habituels: Suggestion[];
};

/**
 * Tout ce qu'il faut pour une session de courses : qui la fait, les réponses
 * des autres et les plats (voir platsDeLaCourse).
 * Le dépassement de l'heure limite est calculé ici, à l'affichage.
 */
export const getTripOverview = cache(async function getTripOverview(
  familyId: string,
  myProfileId: string,
): Promise<TripOverview | null> {
  // Tout part en même temps : un seul aller-retour vers la base.
  const [trip, members, recipes] = await Promise.all([getCurrentTrip(familyId), getProfiles(familyId), getRecipes(familyId)]);
  if (!trip) return null;
  const requests = trip.trip_requests;
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const shopper = members.find((m) => m.id === trip.created_by) ?? null;

  const responses = members
    .filter((m) => m.id !== trip.created_by)
    .map((member) => {
      const request = requests.find((r) => r.profile_id === member.id) ?? null;
      return {
        member,
        request,
        recipes: (request?.recipe_ids ?? []).flatMap((id) => recipeById.get(id) ?? []),
      };
    });

  const [plats, hist, passees, appris] = await Promise.all([
    platsDeLaCourse(familyId, trip),
    getHistorique(familyId),
    getCoursesPassees(familyId),
    getAppris(familyId),
  ]);
  const candidates = plats.flatMap((p) => {
    const recipe = recipeById.get(p.id);
    return recipe ? [{ ...recipe, ...p }] : [];
  });

  // Les ingrédients des plats gardés que la famille a sans doute déjà (et pas encore remis sur la liste).
  const gardes = candidates.filter((c) => c.checked).map((c) => c.id);
  const ingredients = hist.aLaMaison.size && gardes.length ? (await getRecipesWithIngredients(familyId, gardes)).flatMap((r) => r.recipe_ingredients) : [];
  const surLaListe = new Set(trip.shopping_list_items.filter((i) => i.source !== "maison").map((i) => cleMaison(i.name)));
  const vus = new Set<string>();
  const aVerifier = ingredients
    .filter((i) => {
      const cle = cleMaison(i.name);
      if (!hist.aLaMaison.has(cle) || surLaListe.has(cle) || vus.has(cle)) return false;
      vus.add(cle);
      return true;
    })
    .map((i) => i.name);

  return {
    trip,
    shopper,
    iAmShopper: trip.created_by === myProfileId,
    members,
    responses,
    candidates,
    pastDeadline: isPastDeadline(trip.deadline_at),
    nobodyAnswered: requests.length === 0,
    aVerifier,
    ...aAjouter(passees.courses, passees.reponses, {
      surLaListe: new Set(trip.shopping_list_items.filter((i) => i.source !== "maison").map((i) => cleProduit(i.name, appris))),
      repondusIci: passees.repondusIci,
      now: Date.now(),
    }),
  };
});

/** L'avertissement d'un plat choisi malgré les goûts de la famille. */
function attentionPour(c: ReturnType<typeof conflictsOf> | undefined): string {
  if (c?.interditPar.length) return `Attention : interdit pour ${listeDeNoms(c.interditPar)}`;
  if (c?.pasFanDe.length) return `Attention : ${nAimePas(c.pasFanDe)}`;
  return "Attention : écarté par les goûts de la famille";
}
