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
  children: Profile[];
  responses: { child: Profile; request: TripRequest | null; recipes: Recipe[] }[];
  candidates: CandidateRecipe[];
  pastDeadline: boolean;
  nobodyAnswered: boolean;
};

/**
 * Tout ce dont l'écran de maman a besoin pour une session de courses :
 * les réponses des fils et les plats proposés (demandés, matchés ou déjà
 * cochés). Le "dépassement de l'heure limite" est calculé ici, à l'affichage.
 */
export async function getTripOverview(): Promise<TripOverview | null> {
  const trip = await getCurrentTrip();
  if (!trip) return null;

  const [profiles, requests, selection, matches, recipes] = await Promise.all([
    getProfiles(),
    getTripRequests(trip.id),
    getTripSelection(trip.id),
    getMatches(),
    getRecipes(),
  ]);
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const children = profiles.filter((p) => p.role === "child");

  const responses = children.map((child) => {
    const request = requests.find((r) => r.profile_id === child.id) ?? null;
    return {
      child,
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
      wantedBy: responses.filter((r) => r.request?.recipe_ids.includes(recipe.id)).map((r) => r.child.name),
    }))
    // Les plats demandés d'abord, puis les matchs, puis le reste
    .sort((a, b) => b.wantedBy.length - a.wantedBy.length || Number(b.isMatch) - Number(a.isMatch) || a.title.localeCompare(b.title, "fr"));

  return {
    trip,
    children,
    responses,
    candidates,
    pastDeadline: isPastDeadline(trip.deadline_at),
    nobodyAnswered: requests.length === 0,
  };
}
