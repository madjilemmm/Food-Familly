import Link from "next/link";
import { after } from "next/server";
import { requireProfile, requireUser } from "@/lib/auth";
import { remplirSiBesoin } from "@/lib/marmiton";
import { getCurrentTrip, getDeck, getMatches, getProfiles } from "@/lib/data";
import { isPastDeadline } from "@/lib/domain/trip";
import { Scene } from "@/design-system/components/Kaddie";
import { Countdown } from "@/components/Countdown";
import { SwipeDeck } from "@/components/SwipeDeck";
import { IconePanier } from "@/components/ui";
import { SwipeHeader } from "@/components/SwipeHeader";

// Laisse le temps à l'import Marmiton (lancé après l'affichage) de finir.
export const maxDuration = 60;

export default async function FunSwipe() {
  const user = await requireUser();
  // Profil, paquet, course en cours, membres et matchs : tout part en même temps.
  const [me, deck, trip, members, matches] = await Promise.all([
    requireProfile("fun"),
    getDeck(user.familyId, user.profileId),
    getCurrentTrip(user.familyId),
    getProfiles(user.familyId),
    getMatches(user.familyId),
  ]);
  const iAmShopper = trip?.created_by === me.id;
  const answered = trip?.trip_requests.some((r) => r.profile_id === me.id) ?? false;
  const shopper = members.find((m) => m.id === trip?.created_by) ?? null;
  const who = shopper?.name ?? "Quelqu'un";

  // Presque plus rien à découvrir : de nouvelles recettes arrivent de Marmiton, sans rien faire.
  after(() => remplirSiBesoin(user.familyId, deck.length));

  return (
    <Scene duo="aubergine" seed={21} className="ecran-scene gap-4">
      <SwipeHeader matchs={matches.length} />
      {trip && (iAmShopper || (!answered && trip.status === "open")) && (
        <Link
          href="/fun/courses"
          className="flex min-h-14 items-center gap-3 rounded-bouton bg-blanc px-4 py-2 leading-snug font-semibold text-aubergine active:scale-[0.98]"
        >
          <IconePanier className="size-7 shrink-0 text-violet" />
          <span className="flex-1">
            {iAmShopper ? (
              "Tu fais les courses : regarde ce que la famille veut."
            ) : isPastDeadline(trip.deadline_at) ? (
              `${who} fait les courses : dis-lui vite ce que tu veux.`
            ) : (
              <>
                {who} part dans <Countdown deadline={trip.deadline_at} /> : dis-lui ce que tu veux.
              </>
            )}
          </span>
        </Link>
      )}
      <h1 className="kd-titre-2">Qu&apos;est-ce qui te fait envie ce soir&nbsp;?</h1>
      <SwipeDeck initialDeck={deck} />
    </Scene>
  );
}
