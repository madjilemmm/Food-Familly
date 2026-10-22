import { requireProfile } from "@/lib/auth";
import { CoursesScreen } from "@/components/courses/CoursesScreen";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";

export default async function Courses() {
  const me = await requireProfile();
  return <CoursesScreen me={me} notifications={<NotificationsCard variant="icone" />} />;
}
