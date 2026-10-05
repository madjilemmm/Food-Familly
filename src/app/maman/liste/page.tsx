import Link from "next/link";
import { getCurrentTrip, getListItems, getProfiles, getTripRequests } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { ShoppingList } from "@/components/parent/ShoppingList";

export default async function ParentList() {
  const trip = await getCurrentTrip();

  if (!trip) {
    return (
      <>
        <PageHeader title="Ma liste" />
        <div className="rounded-3xl bg-white p-6 text-center">
          <p className="text-5xl">📝</p>
          <p className="mt-3 text-xl text-stone-600">Pas de liste pour l&apos;instant.</p>
          <Link href="/maman" className="mt-5 block rounded-2xl bg-tomato-500 py-4 text-xl font-bold text-white">
            🛒 Lancer les courses
          </Link>
        </div>
      </>
    );
  }

  const [items, requests, profiles] = await Promise.all([
    getListItems(trip.id),
    getTripRequests(trip.id),
    getProfiles(),
  ]);
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const textRequests = requests
    .filter((r) => r.free_text)
    .map((r) => ({ id: r.id, from: names.get(r.profile_id) ?? "", text: r.free_text! }));

  return (
    <>
      <PageHeader title="Ma liste" />
      <ShoppingList items={items} requests={textRequests} />
    </>
  );
}
