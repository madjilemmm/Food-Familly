import "server-only";
import { cache } from "react";
import {
  conflictsOf,
  getCurrentTrip,
  getMatches,
  getMyLikes,
  getTasteContext,
  getProfiles,
  getRecipes,
  type Profile,
  type Recipe,
  type Trip,
  type TripRequest,
} from "@/lib/data";
import { isPastDeadline } from "@/lib/domain/trip";
import { convivesDe, type Convives } from "@/lib/domain/convives";

export type CandidateRecipe = Recipe & {
  checked: boolean;
  isMatch: boolean;
  wantedBy: string[];
  /** Une envie (un like) de la personne qui fait les courses. */
  envieDuShopper: boolean;
  /** Pour qui est ce plat, et pour combien. */
  convives: Convives;
};

/**
 * Pour qui est chaque plat de la course (voir convivesDe) : sert à l'affichage
 * et au calcul des quantités de la liste.
 */
export function convivesDesPlats(
  trip: Trip,
  members: Profile[],
  matchIds: Set<string>,
  likesDuShopper: Set<string>,
): (recipeId: string) => Convives {
  const noms = new Map(members.map((m) => [m.id, m.name]));
  const shopper = (trip.created_by && noms.get(trip.created_by)) || "";
  const corrections = new Map(trip.trip_recipes.map((r) => [r.recipe_id, r.people ?? null]));
  return (recipeId) =>
    convivesDe({
      isMatch: matchIds.has(recipeId),
      demandePar: trip.trip_requests
        .filter((r) => r.profile_id !== trip.created_by && r.recipe_ids.includes(recipeId))
        .flatMap((r) => noms.get(r.profile_id) ?? []),
      envieDuShopper: likesDuShopper.has(recipeId),
      shopper,
      famille: trip.people ?? Math.max(1, members.length),
      corrige: corrections.get(recipeId),
    });
}

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
};

/**
 * Tout ce qu'il faut pour une session de courses : qui la fait, les réponses
 * des autres et les plats proposés (demandés, matchés ou déjà cochés).
 * Le dépassement de l'heure limite est calculé ici, à l'affichage.
 */
export const getTripOverview = cache(async function getTripOverview(
  familyId: string,
  myProfileId: string,
): Promise<TripOverview | null> {
  // Tout part en même temps : un seul aller-retour vers la base.
  const [trip, members, matches, recipes, tastes] = await Promise.all([
    getCurrentTrip(familyId),
    getProfiles(familyId),
    getMatches(familyId),
    getRecipes(familyId),
    getTasteContext(familyId),
  ]);
  if (!trip) return null;
  const likes = trip.created_by ? await getMyLikes(familyId, trip.created_by) : [];
  const requests = trip.trip_requests;
  const selection = new Map(trip.trip_recipes.map((r) => [r.recipe_id, r.selected]));
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

  const matchIds = new Set(matches.map((m) => m.id));
  const likeIds = new Set(likes.map((r) => r.id));
  const pourQui = convivesDesPlats(trip, members, matchIds, likeIds);
  // Demandes, matchs, déjà cochés, et les envies à elle de la personne qui fait les courses.
  const ids = new Set<string>([
    ...responses.flatMap((r) => r.recipes.map((x) => x.id)),
    ...matches.map((m) => m.id),
    ...selection.keys(),
    ...likeIds,
  ]);

  const candidates: CandidateRecipe[] = [...ids]
    .flatMap((id) => recipeById.get(id) ?? [])
    // Ce qu'un membre ne peut pas manger n'est jamais proposé (ni ce qu'il n'aime pas, en mode strict).
    .filter((recipe) => !conflictsOf(tastes, recipe).familleCache)
    .map((recipe) => ({
      ...recipe,
      checked: selection.get(recipe.id) === true,
      isMatch: matchIds.has(recipe.id),
      wantedBy: responses.filter((r) => r.request?.recipe_ids.includes(recipe.id)).map((r) => r.member.name),
      envieDuShopper: likeIds.has(recipe.id),
      convives: pourQui(recipe.id),
    }))
    // Les plats demandés d'abord, puis les matchs, puis ses envies à soi, puis le reste
    .sort(
      (a, b) =>
        b.wantedBy.length - a.wantedBy.length ||
        Number(b.isMatch) - Number(a.isMatch) ||
        Number(b.envieDuShopper) - Number(a.envieDuShopper) ||
        a.title.localeCompare(b.title, "fr"),
    );

  return {
    trip,
    shopper,
    iAmShopper: trip.created_by === myProfileId,
    members,
    responses,
    candidates,
    pastDeadline: isPastDeadline(trip.deadline_at),
    nobodyAnswered: requests.length === 0,
  };
});
