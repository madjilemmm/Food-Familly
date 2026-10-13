import { requireProfile } from "@/lib/auth";
import { getCurrentTrip } from "@/lib/data";
import { FamilyLayout } from "@/components/FamilyLayout";

export default async function FunLayout({ children }: { children: React.ReactNode }) {
  const me = await requireProfile("fun");
  const trip = await getCurrentTrip(me.family_id);
  return (
    <FamilyLayout me={me} coursesBadge={Boolean(trip && trip.created_by !== me.id)}>
      {children}
    </FamilyLayout>
  );
}
