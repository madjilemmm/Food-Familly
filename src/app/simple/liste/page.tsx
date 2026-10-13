import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { ListScreen } from "@/components/courses/ListScreen";

export default async function SimpleList() {
  const me = await requireProfile("simple");
  return (
    <>
      <PageHeader title="La liste" />
      <ListScreen me={me} />
    </>
  );
}
