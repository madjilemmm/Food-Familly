import { requireProfile, requireUser } from "@/lib/auth";
import { getATable, getCurrentTrip } from "@/lib/data";
import { redirect } from "next/navigation";
import { FamilyLayout } from "@/components/FamilyLayout";
import { doitVoirNouvellesCartes } from "@/lib/domain/foods";

/** Envies, Courses, Matchs : les mêmes écrans pour tout le monde. */
export default async function AppliLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); // cookie seulement : les requêtes partent ensemble
  const [me, trip, appel] = await Promise.all([requireProfile(), getCurrentTrip(user.familyId), getATable(user.familyId)]);
  // Jamais vu le questionnaire de goûts (profils déjà là avant lui compris) : une fois, maintenant.
  if (!me.tastes_seen_at) redirect("/profil/gouts");
  // Questionnaire rempli avant les nouvelles cartes : seulement celles-là, une fois.
  if (doitVoirNouvellesCartes(me.tastes_done_at)) redirect("/profil/gouts?nouvelles=1");
  // Questionnaire rempli avant l'écran « Tes envies » : seulement celui-là, une fois.
  if (me.tastes_done_at && !me.envies_done_at) redirect("/profil/gouts?envies=1");
  return (
    <FamilyLayout me={me} aTable={appel} coursesBadge={Boolean(trip && (trip.created_by === me.id || !trip.trip_requests.some((r) => r.profile_id === me.id)))}>
      {children}
    </FamilyLayout>
  );
}
