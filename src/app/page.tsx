import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCurrentTrip, getRepasAchetes } from "@/lib/data";
import { ROUTES } from "@/lib/routes";

/** L'heure à Paris (0-23). */
const heure = () => Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).format(new Date()));

/**
 * Kaddie s'ouvre là où il y a quelque chose à faire : sur les courses si je les fais
 * ou si je n'ai pas encore dit ce que je veux ; en fin de journée, sur « Ce soir, on mange
 * quoi ? » s'il reste des plats achetés à cuisiner ; sinon sur les envies.
 */
export default async function Accueil() {
  const user = await requireUser();
  const trip = await getCurrentTrip(user.familyId);
  const aFaire = trip && (trip.created_by === user.profileId || !trip.trip_requests.some((r) => r.profile_id === user.profileId));
  if (aFaire) redirect(ROUTES.courses);
  const h = heure();
  if (!trip && h >= 16 && h < 21) {
    const repas = await getRepasAchetes(user.familyId);
    if (repas?.plats.some((p) => !p.fait)) redirect(ROUTES.courses);
  }
  redirect(ROUTES.envies);
}
