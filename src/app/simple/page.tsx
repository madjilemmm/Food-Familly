import { requireProfile, requireUser } from "@/lib/auth";
import { getTripOverview } from "@/lib/views";
import { CoursesScreen } from "@/components/courses/CoursesScreen";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";

export default async function SimpleHome() {
  const user = await requireUser();
  void getTripOverview(user.familyId, user.profileId); // préchargé pendant qu'on lit le profil
  const me = await requireProfile("simple");
  return <CoursesScreen me={me} notifications={<NotificationsCard variant="icone" />} />;
}
