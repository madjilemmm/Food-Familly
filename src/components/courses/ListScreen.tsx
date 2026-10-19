import Link from "next/link";
import type { Profile } from "@/lib/data";
import { getAppris, getCurrentTrip, getProfiles } from "@/lib/data";
import { BandeauScene, IconeRetour } from "@/components/ui";
import { ShoppingList } from "./ShoppingList";

const jour = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "Europe/Paris" }).format(new Date(iso));

/**
 * La liste de la course en cours. Pour la personne qui fait les courses, c'est
 * l'écran du magasin : rien d'autre que la liste. Les autres peuvent la compléter.
 */
export async function ListScreen({ me, retour }: { me: Profile; retour: { href: string; label: string } }) {
  // Course, réponses et articles arrivent en une seule requête, en parallèle des membres.
  const [trip, profiles, appris] = await Promise.all([getCurrentTrip(me.family_id), getProfiles(me.family_id), getAppris(me.family_id)]);
  if (!trip) return null;

  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const shopper = trip.created_by ? names.get(trip.created_by) : null;
  const plats = trip.trip_recipes.filter((r) => r.selected).length;
  const textRequests = trip.trip_requests
    .filter((r) => r.free_text)
    .map((r) => ({ id: r.id, from: names.get(r.profile_id) ?? "", text: r.free_text! }));

  return (
    <>
      <BandeauScene
        fond="courses"
        illustration="courses"
        etiquette={`${jour(trip.created_at)} · ${plats} plat${plats > 1 ? "s" : ""}`}
        titre={trip.created_by === me.id ? "Ta liste" : `La liste de ${shopper ?? "la famille"}`}
      />
      <Link href={retour.href} className="-mt-2 mb-4 -ml-2 inline-flex min-h-12 items-center gap-1 font-semibold text-violet">
        <IconeRetour className="size-5" /> {retour.label}
      </Link>
      {trip.created_by !== me.id && shopper && (
        <p className="mb-5 text-encre-douce">
          C&apos;est <strong className="text-encre">{shopper}</strong> qui fait ces courses. Tu peux ajouter des articles ou cocher ce qui
          est déjà pris.
        </p>
      )}
      <ShoppingList tripId={trip.id} items={trip.shopping_list_items} requests={textRequests} appris={appris} />
    </>
  );
}
