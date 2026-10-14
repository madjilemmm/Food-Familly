import { requireProfile, requireUser } from "@/lib/auth";
import { getCurrentTrip } from "@/lib/data";
import { FamilyLayout } from "@/components/FamilyLayout";

export default async function FunLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); // cookie seulement : les requêtes partent ensemble
  const [me, trip] = await Promise.all([requireProfile("fun"), getCurrentTrip(user.familyId)]);
  return (
    <FamilyLayout me={me} coursesBadge={Boolean(trip && trip.created_by !== me.id)}>
      {children}
    </FamilyLayout>
  );
}
