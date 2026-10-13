import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { CoursesScreen } from "@/components/courses/CoursesScreen";

export default async function FunCourses() {
  const me = await requireProfile("fun");
  return (
    <>
      <PageHeader title="Les courses" />
      <CoursesScreen me={me} />
    </>
  );
}
