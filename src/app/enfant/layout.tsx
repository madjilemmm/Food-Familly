import { requireProfile } from "@/lib/auth";
import { getCurrentTrip } from "@/lib/data";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { TabBar } from "@/components/TabBar";

export default async function ChildLayout({ children }: { children: React.ReactNode }) {
  const [, trip] = await Promise.all([requireProfile("child"), getCurrentTrip()]);
  return (
    <div className="min-h-dvh bg-gradient-to-b from-fuchsia-50 via-orange-50 to-amber-50">
      <RealtimeRefresher />
      <main className="mx-auto max-w-xl pb-tabbar px-4">{children}</main>
      <TabBar
        variant="child"
        tabs={[
          { href: "/enfant", label: "Swipe", icon: "🔥" },
          { href: "/enfant/matchs", label: "Matchs", icon: "💞" },
          { href: "/enfant/courses", label: "Courses", icon: "🛒", badge: trip ? 1 : undefined },
          { href: "/recettes", label: "Recettes", icon: "📖" },
        ]}
      />
    </div>
  );
}
