import { requireProfile, requireUser } from "@/lib/auth";
import { getCurrentTrip, getProfiles } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { ListScreen } from "@/components/courses/ListScreen";

export default async function FunList() {
  const user = await requireUser();
  void getCurrentTrip(user.familyId); // préchargé pendant qu'on lit le profil
  void getProfiles(user.familyId);
  const me = await requireProfile("fun");
  return (
    <>
      <PageHeader title="La liste 📝" />
      <ListScreen me={me} />
    </>
  );
}
