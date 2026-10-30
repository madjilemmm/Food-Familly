import { requireUser } from "@/lib/auth";
import { CoursesScreen } from "@/components/courses/CoursesScreen";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";

export default async function Courses() {
  const user = await requireUser(); // cookie seulement : l'écran charge le profil avec le reste
  return <CoursesScreen familyId={user.familyId} notifications={<NotificationsCard variant="icone" />} />;
}
