import { requireProfile } from "@/lib/auth";
import { FamilyLayout } from "@/components/FamilyLayout";

/** Les recettes s'affichent avec la barre d'onglets, comme le reste de l'appli. */
export default async function RecipesLayout({ children }: { children: React.ReactNode }) {
  const me = await requireProfile();
  return <FamilyLayout me={me}>{children}</FamilyLayout>;
}
