import Link from "next/link";
import type { Profile } from "@/lib/data";
import { getCurrentTrip, getListItems, getProfiles, getTripRequests } from "@/lib/data";
import { ROUTES } from "@/lib/routes";
import { ShoppingList } from "./ShoppingList";

/** La liste de la course en cours, que tout le monde peut consulter et compléter. */
export async function ListScreen({ me }: { me: Profile }) {
  const trip = await getCurrentTrip(me.family_id);

  if (!trip) {
    return (
      <div className="rounded-3xl bg-white p-6 text-center">
        <p className="text-5xl">📝</p>
        <p className="mt-3 text-xl text-stone-600">Pas de liste pour l&apos;instant.</p>
        <Link href={ROUTES[me.style].courses} className="mt-5 block rounded-2xl bg-tomato-500 py-4 text-xl font-bold text-white">
          🛒 Lancer les courses
        </Link>
      </div>
    );
  }

  const [items, requests, profiles] = await Promise.all([getListItems(trip.id), getTripRequests(trip.id), getProfiles(me.family_id)]);
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const shopper = trip.created_by ? names.get(trip.created_by) : null;
  const textRequests = requests
    .filter((r) => r.free_text)
    .map((r) => ({ id: r.id, from: names.get(r.profile_id) ?? "", text: r.free_text! }));

  return (
    <>
      {trip.created_by !== me.id && shopper && (
        <p className="mb-4 rounded-2xl bg-white/80 px-4 py-3 text-stone-600">
          🛒 C&apos;est <strong>{shopper}</strong> qui fait ces courses. Tu peux ajouter des articles ou cocher ce qui est déjà pris.
        </p>
      )}
      <ShoppingList items={items} requests={textRequests} />
    </>
  );
}
