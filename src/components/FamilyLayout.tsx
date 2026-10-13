import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { TabBar, type Tab } from "@/components/TabBar";
import type { Profile } from "@/lib/data";

const TABS: Record<Profile["style"], Tab[]> = {
  simple: [
    { href: "/simple", label: "Courses", icon: "🛒" },
    { href: "/simple/plats", label: "Plats", icon: "❤️" },
    { href: "/simple/liste", label: "Liste", icon: "📝" },
    { href: "/simple/swipe", label: "J'aime", icon: "👍" },
  ],
  fun: [
    { href: "/fun", label: "Swipe", icon: "🔥" },
    { href: "/fun/matchs", label: "Matchs", icon: "💞" },
    { href: "/fun/courses", label: "Courses", icon: "🛒" },
    { href: "/recettes", label: "Recettes", icon: "📖" },
  ],
};

/** Barre d'onglets et rafraîchissement en direct, selon le style choisi. */
export function FamilyLayout({ me, coursesBadge, children }: { me: Profile; coursesBadge?: boolean; children: React.ReactNode }) {
  const tabs = TABS[me.style].map((t) => (t.label === "Courses" && coursesBadge ? { ...t, badge: 1 } : t));
  return me.style === "simple" ? (
    <>
      <RealtimeRefresher familyId={me.family_id} />
      <main className="mx-auto max-w-xl px-5 pb-36 text-lg">{children}</main>
      <TabBar variant="parent" tabs={tabs} />
    </>
  ) : (
    <div className="min-h-dvh bg-gradient-to-b from-fuchsia-50 via-orange-50 to-amber-50">
      <RealtimeRefresher familyId={me.family_id} />
      <main className="pb-tabbar mx-auto max-w-xl px-4">{children}</main>
      <TabBar variant="child" tabs={tabs} />
    </div>
  );
}
