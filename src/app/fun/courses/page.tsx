import { requireProfile, requireUser } from "@/lib/auth";
import { getTripOverview } from "@/lib/views";
import { CoursesScreen } from "@/components/courses/CoursesScreen";

export default async function FunCourses() {
  const user = await requireUser();
  void getTripOverview(user.familyId, user.profileId); // préchargé pendant qu'on lit le profil
  const me = await requireProfile("fun");
  return <CoursesScreen me={me} />;
}
