import { requireProfile, requireUser } from "@/lib/auth";
import { getCurrentTrip } from "@/lib/data";
import { getTripOverview } from "@/lib/views";
import { PageHeader } from "@/components/PageHeader";
import { CoursesScreen } from "@/components/courses/CoursesScreen";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";

export default async function SimpleHome() {
  const user = await requireUser();
  void getTripOverview(user.familyId, user.profileId); // préchargé pendant qu'on lit le profil
  const [me, trip] = await Promise.all([requireProfile("simple"), getCurrentTrip(user.familyId)]);
  return (
    <>
      <PageHeader title={trip ? "Les courses" : `Bonjour ${me.name} 👋`} big={!trip} />
      <NotificationsCard variant="banner" />
      <CoursesScreen me={me} />
    </>
  );
}
