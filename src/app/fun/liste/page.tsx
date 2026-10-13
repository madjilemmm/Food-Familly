import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { ListScreen } from "@/components/courses/ListScreen";

export default async function FunList() {
  const me = await requireProfile("fun");
  return (
    <>
      <PageHeader title="La liste 📝" />
      <ListScreen me={me} />
    </>
  );
}
