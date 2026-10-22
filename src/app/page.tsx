import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCurrentTrip, getRepasAchetes } from "@/lib/data";
import { ROUTES } from "@/lib/routes";
import { heureAParis } from "@/lib/domain/heure";


/** « Je pars faire les courses » : pendant quelques heures, Kaddie s'ouvre sur la liste. */
const EN_COURSE_MS = 6 * 60 * 60 * 1000;

/**
 * Kaddie s'ouvre là où il y a quelque chose à faire : sur la liste si je suis parti faire
 * les courses ; en fin de journée, sur « Ce soir » (une réponse à « on mange quoi ? »)
 * s'il reste des plats achetés à cuisiner ; sinon sur les envies.
 */
export default async function Accueil() {
  const user = await requireUser();
  const trip = await getCurrentTrip(user.familyId);
  if (trip?.created_by === user.profileId && Date.now() - Date.parse(trip.departs_at) < EN_COURSE_MS) redirect(ROUTES.courses);
  const h = heureAParis();
  if (h >= 16 && h < 21) {
    const repas = await getRepasAchetes(user.familyId);
    if (repas?.plats.some((p) => !p.fait)) redirect(ROUTES.ceSoir);
  }
  redirect(ROUTES.envies);
}
