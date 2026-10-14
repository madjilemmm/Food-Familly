import { requireProfile, requireUser } from "@/lib/auth";
import { getCurrentTrip } from "@/lib/data";
import { redirect } from "next/navigation";
import { FamilyLayout } from "@/components/FamilyLayout";
import { doitVoirNouvellesCartes } from "@/lib/domain/foods";

export default async function FunLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); // cookie seulement : les requêtes partent ensemble
  const [me, trip] = await Promise.all([requireProfile("fun"), getCurrentTrip(user.familyId)]);
  // Jamais vu le questionnaire de goûts (profils déjà là avant lui compris) : une fois, maintenant.
  if (!me.tastes_seen_at) redirect("/profil/gouts");
  // Questionnaire rempli avant les nouvelles cartes : seulement celles-là, une fois.
  if (doitVoirNouvellesCartes(me.tastes_done_at)) redirect("/profil/gouts?nouvelles=1");
  return (
    <FamilyLayout me={me} coursesBadge={Boolean(trip && trip.created_by !== me.id)}>
      {children}
    </FamilyLayout>
  );
}
