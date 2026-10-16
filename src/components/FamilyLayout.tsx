import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { TabBar, type Tab } from "@/components/TabBar";
import { AnnulerProvider } from "@/components/Annuler";
import { IconeLivre, IconePanier, IconeSwipe } from "@/components/ui";
import type { Profile } from "@/lib/data";

// Trois onglets, les mêmes pour tout le monde : choisir (Envies), acheter (Courses), cuisiner (Recettes).
// Les matchs s'ouvrent depuis la pastille de l'écran Envies.
const TABS: Tab[] = [
  { href: "/envies", label: "Envies", icon: <IconeSwipe /> },
  { href: "/courses", label: "Courses", icon: <IconePanier /> },
  { href: "/recettes", label: "Recettes", icon: <IconeLivre /> },
];

/** Barre d'onglets et rafraîchissement en direct. */
export function FamilyLayout({ me, coursesBadge, children }: { me: Profile; coursesBadge?: boolean; children: React.ReactNode }) {
  const tabs = TABS.map((t) => (t.label === "Courses" && coursesBadge ? { ...t, badge: 1 } : t));
  return (
    <AnnulerProvider>
      <RealtimeRefresher familyId={me.family_id} />
      <main className="pb-tabbar mx-auto max-w-xl overflow-x-clip px-5">{children}</main>
      <TabBar tabs={tabs} />
    </AnnulerProvider>
  );
}
