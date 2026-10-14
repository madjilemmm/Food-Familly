import { requireProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FamilyLayout } from "@/components/FamilyLayout";

export default async function SimpleLayout({ children }: { children: React.ReactNode }) {
  const me = await requireProfile("simple");
  // Jamais vu le questionnaire de goûts (profils déjà là avant lui compris) : une fois, maintenant.
  if (!me.tastes_seen_at) redirect("/profil/gouts");
  return <FamilyLayout me={me}>{children}</FamilyLayout>;
}
