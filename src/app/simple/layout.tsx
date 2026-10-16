import { requireProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FamilyLayout } from "@/components/FamilyLayout";
import { doitVoirNouvellesCartes } from "@/lib/domain/foods";

export default async function SimpleLayout({ children }: { children: React.ReactNode }) {
  const me = await requireProfile("simple");
  // Jamais vu le questionnaire de goûts (profils déjà là avant lui compris) : une fois, maintenant.
  if (!me.tastes_seen_at) redirect("/profil/gouts");
  // Questionnaire rempli avant les nouvelles cartes : seulement celles-là, une fois.
  if (doitVoirNouvellesCartes(me.tastes_done_at)) redirect("/profil/gouts?nouvelles=1");
  // Questionnaire rempli avant l'écran « Tes envies » : seulement celui-là, une fois.
  if (me.tastes_done_at && !me.envies_done_at) redirect("/profil/gouts?envies=1");
  return <FamilyLayout me={me}>{children}</FamilyLayout>;
}
