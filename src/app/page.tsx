import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCurrentTrip } from "@/lib/data";
import { ROUTES } from "@/lib/routes";

/**
 * Kaddie s'ouvre là où il y a quelque chose à faire : sur les courses si je les fais
 * ou si je n'ai pas encore dit ce que je veux, sinon sur les envies.
 */
export default async function Accueil() {
  const user = await requireUser();
  const trip = await getCurrentTrip(user.familyId);
  const aFaire = trip && (trip.created_by === user.profileId || !trip.trip_requests.some((r) => r.profile_id === user.profileId));
  redirect(aFaire ? ROUTES.courses : ROUTES.envies);
}
