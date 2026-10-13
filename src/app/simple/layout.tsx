import { requireProfile } from "@/lib/auth";
import { FamilyLayout } from "@/components/FamilyLayout";

export default async function SimpleLayout({ children }: { children: React.ReactNode }) {
  const me = await requireProfile("simple");
  return <FamilyLayout me={me}>{children}</FamilyLayout>;
}
