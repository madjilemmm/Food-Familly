import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { FileAttente } from "@/components/FileAttente";
import { TabBar, type Tab } from "@/components/TabBar";
import { AnnulerProvider } from "@/components/Annuler";
import { IconeAssiette, IconePanier, IconeSwipe } from "@/components/ui";
import { BandeauATable } from "@/components/ATable";
import type { ATable, Profile } from "@/lib/data";

// Trois entrées, les mêmes pour tout le monde : « Ce soir » (la réponse du soir et la semaine), « Idées »
// (les cartes à swiper, à la demande) et le « Caddie » (la liste, avec ce qu'il reste à prendre).
// Les recettes s'ouvrent depuis chaque plat ; la famille et les réglages, depuis le rond de la table.
const TABS: Tab[] = [
  { href: "/envies", label: "Idées", icon: <IconeSwipe /> },
  { href: "/menu", label: "Ce soir", icon: <IconeAssiette /> },
  { href: "/courses", label: "Caddie", icon: <IconePanier /> },
];

/** Barre d'onglets et rafraîchissement en direct. */
export function FamilyLayout({
  me,
  caddie = 0,
  aTable,
  children,
}: {
  me: Profile;
  /** Ce qu'il reste à prendre dans le caddie. */
  caddie?: number;
  /** Un appel « À table ! » en cours : le bandeau s'affiche par-dessus l'écran. */
  aTable?: ATable | null;
  children: React.ReactNode;
}) {
  const tabs = TABS.map((t) => (t.label === "Caddie" && caddie > 0 ? { ...t, badge: Math.min(caddie, 99) } : t));
  return (
    <AnnulerProvider>
      <RealtimeRefresher familyId={me.family_id} />
      <FileAttente />
      {aTable && <BandeauATable key={aTable.id} appel={aTable} moi={me.id} />}
      <main className="ecran-famille pb-tabbar mx-auto max-w-xl overflow-x-clip px-5">{children}</main>
      <TabBar tabs={tabs} />
    </AnnulerProvider>
  );
}
