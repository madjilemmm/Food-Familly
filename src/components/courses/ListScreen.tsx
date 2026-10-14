import Link from "next/link";
import type { Profile } from "@/lib/data";
import { getCurrentTrip, getProfiles } from "@/lib/data";
import { ROUTES } from "@/lib/routes";
import { BandeauScene, EtatVide } from "@/components/ui";
import { ShoppingList } from "./ShoppingList";

const jour = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "Europe/Paris" }).format(new Date(iso));

/** La liste de la course en cours, que tout le monde peut consulter et compléter. */
export async function ListScreen({ me }: { me: Profile }) {
  // Course, réponses et articles arrivent en une seule requête, en parallèle des membres.
  const [trip, profiles] = await Promise.all([getCurrentTrip(me.family_id), getProfiles(me.family_id)]);

  if (!trip) {
    return (
      <>
        <BandeauScene illustration="courses" titre="Ta liste" />
        <EtatVide seed={12} phrase="Pas de liste pour l'instant. Elle se remplit quand quelqu'un part en courses.">
          <Link href={ROUTES[me.style].courses} className="kd-btn kd-btn--secondaire kd-btn--large">
            Lancer les courses
          </Link>
        </EtatVide>
      </>
    );
  }

  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const shopper = trip.created_by ? names.get(trip.created_by) : null;
  const plats = trip.trip_recipes.filter((r) => r.selected).length;
  const textRequests = trip.trip_requests
    .filter((r) => r.free_text)
    .map((r) => ({ id: r.id, from: names.get(r.profile_id) ?? "", text: r.free_text! }));

  return (
    <>
      <BandeauScene
        illustration="courses"
        etiquette={`${jour(trip.created_at)} · ${plats} plat${plats > 1 ? "s" : ""}`}
        titre={trip.created_by === me.id ? "Ta liste" : `La liste de ${shopper ?? "la famille"}`}
      />
      {trip.created_by !== me.id && shopper && (
        <p className="mb-5 text-encre-douce">
          C&apos;est <strong className="text-encre">{shopper}</strong> qui fait ces courses. Tu peux ajouter des articles ou cocher ce qui
          est déjà pris.
        </p>
      )}
      <ShoppingList items={trip.shopping_list_items} requests={textRequests} />
    </>
  );
}
