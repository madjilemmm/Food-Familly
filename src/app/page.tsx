import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCurrentTrip } from "@/lib/data";
import { ROUTES } from "@/lib/routes";

/** « Je pars faire les courses » : pendant quelques heures, Kaddie s'ouvre sur la liste. */
const EN_COURSE_MS = 6 * 60 * 60 * 1000;

/**
 * Kaddie s'ouvre là où il y a quelque chose à faire : sur le caddie si je suis parti faire
 * les courses ; sinon sur « Ce soir », la réponse à « on mange quoi ? ».
 */
export default async function Accueil() {
  const user = await requireUser();
  const trip = await getCurrentTrip(user.familyId);
  if (trip?.created_by === user.profileId && Date.now() - Date.parse(trip.departs_at) < EN_COURSE_MS) redirect(ROUTES.courses);
  redirect(ROUTES.ceSoir);
}
