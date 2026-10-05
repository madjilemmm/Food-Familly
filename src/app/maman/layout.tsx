import { requireProfile } from "@/lib/auth";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { TabBar } from "@/components/TabBar";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  await requireProfile("parent");
  return (
    <>
      <RealtimeRefresher />
      <main className="mx-auto max-w-xl px-5 pb-36 text-lg">{children}</main>
      <TabBar
        variant="parent"
        tabs={[
          { href: "/maman", label: "Courses", icon: "🛒" },
          { href: "/maman/plats", label: "Plats", icon: "❤️" },
          { href: "/maman/liste", label: "Liste", icon: "📝" },
        ]}
      />
    </>
  );
}
