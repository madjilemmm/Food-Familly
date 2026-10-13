import { requireProfile } from "@/lib/auth";
import { getCurrentTrip } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { CoursesScreen } from "@/components/courses/CoursesScreen";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";

export default async function SimpleHome() {
  const me = await requireProfile("simple");
  const trip = await getCurrentTrip(me.family_id);
  return (
    <>
      <PageHeader title={trip ? "Les courses" : `Bonjour ${me.name} 👋`} big={!trip} />
      <NotificationsCard variant="banner" />
      <CoursesScreen me={me} />
    </>
  );
}
