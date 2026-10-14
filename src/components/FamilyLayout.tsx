import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { TabBar, type Tab } from "@/components/TabBar";
import { IconeAssiette, IconeCoeur, IconeListe, IconeLivre, IconePanier, IconeSwipe } from "@/components/ui";
import type { Profile } from "@/lib/data";

const TABS: Record<Profile["style"], Tab[]> = {
  simple: [
    { href: "/simple", label: "Courses", icon: <IconePanier /> },
    { href: "/simple/plats", label: "Plats", icon: <IconeAssiette /> },
    { href: "/simple/liste", label: "Liste", icon: <IconeListe /> },
    { href: "/simple/swipe", label: "Swipe", icon: <IconeSwipe /> },
  ],
  fun: [
    { href: "/fun", label: "Swipe", icon: <IconeSwipe /> },
    { href: "/fun/matchs", label: "Matchs", icon: <IconeCoeur /> },
    { href: "/fun/courses", label: "Courses", icon: <IconePanier /> },
    { href: "/recettes", label: "Recettes", icon: <IconeLivre /> },
  ],
};

/** Barre d'onglets et rafraîchissement en direct, selon le style choisi. */
export function FamilyLayout({ me, coursesBadge, children }: { me: Profile; coursesBadge?: boolean; children: React.ReactNode }) {
  const tabs = TABS[me.style].map((t) => (t.label === "Courses" && coursesBadge ? { ...t, badge: 1 } : t));
  return (
    <>
      <RealtimeRefresher familyId={me.family_id} />
      <main className="pb-tabbar mx-auto max-w-xl overflow-x-clip px-5">{children}</main>
      <TabBar tabs={tabs} />
    </>
  );
}
