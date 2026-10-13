import "server-only";
import {
  getCurrentTrip,
  getMatches,
  getProfiles,
  getRecipes,
  getTripRequests,
  getTripSelection,
  type Profile,
  type Recipe,
  type Trip,
  type TripRequest,
} from "@/lib/data";
import { isPastDeadline } from "@/lib/domain/trip";

export type CandidateRecipe = Recipe & {
  checked: boolean;
  isMatch: boolean;
  wantedBy: string[];
};

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
export async function getTripOverview(familyId: string, myProfileId: string): Promise<TripOverview | null> {
  const trip = await getCurrentTrip(familyId);
  if (!trip) return null;

  const [members, requests, selection, matches, recipes] = await Promise.all([
    getProfiles(familyId),
    getTripRequests(trip.id),
    getTripSelection(trip.id),
    getMatches(familyId),
    getRecipes(familyId),
  ]);
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
  const ids = new Set<string>([
    ...responses.flatMap((r) => r.recipes.map((x) => x.id)),
    ...matches.map((m) => m.id),
    ...selection.keys(),
  ]);

  const candidates: CandidateRecipe[] = [...ids]
    .flatMap((id) => recipeById.get(id) ?? [])
    .map((recipe) => ({
      ...recipe,
      checked: selection.get(recipe.id) === true,
      isMatch: matchIds.has(recipe.id),
      wantedBy: responses.filter((r) => r.request?.recipe_ids.includes(recipe.id)).map((r) => r.member.name),
    }))
    // Les plats demandés d'abord, puis les matchs, puis le reste
    .sort(
      (a, b) =>
        b.wantedBy.length - a.wantedBy.length ||
        Number(b.isMatch) - Number(a.isMatch) ||
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
}
