import { requireProfile, requireUser } from "@/lib/auth";
import { getTripOverview } from "@/lib/views";
import { CoursesScreen } from "@/components/courses/CoursesScreen";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";

export default async function Courses({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const user = await requireUser();
  void getTripOverview(user.familyId, user.profileId); // préchargé pendant qu'on lit le profil
  const [me, { vue }] = await Promise.all([requireProfile(), searchParams]);
  return <CoursesScreen me={me} vue={vue} notifications={<NotificationsCard variant="icone" />} />;
}
