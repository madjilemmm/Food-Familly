import { requireProfile, requireUser } from "@/lib/auth";
import { getATable, getCurrentTrip } from "@/lib/data";
import { redirect } from "next/navigation";
import { FamilyLayout } from "@/components/FamilyLayout";
import { NoterOuverture } from "@/components/NoterOuverture";
import { doitVoirNouvellesCartes } from "@/lib/domain/foods";

/** Ce soir, Idées, Caddie : les mêmes écrans pour tout le monde. */
export default async function AppliLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); // cookie seulement : les requêtes partent ensemble
  const [me, trip, appel] = await Promise.all([requireProfile(), getCurrentTrip(user.familyId), getATable(user.familyId)]);
  // La question d'allergie ne bloque plus l'entrée : elle se pose sur « Ce soir », en un appui.
  // Questionnaire rempli avant les nouvelles cartes : seulement celles-là, une fois.
  if (doitVoirNouvellesCartes(me.tastes_done_at)) redirect("/profil/gouts?nouvelles=1");
  // Questionnaire rempli avant l'écran « Tes envies » : seulement celui-là, une fois.
  if (me.tastes_done_at && !me.envies_done_at) redirect("/profil/gouts?envies=1");
  return (
    <FamilyLayout me={me} aTable={appel} caddie={trip?.shopping_list_items.filter((l) => !l.checked).length ?? 0}>
      <NoterOuverture />
      {children}
    </FamilyLayout>
  );
}
