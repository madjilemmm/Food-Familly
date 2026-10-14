import Link from "next/link";
import { requireProfile, requireUser } from "@/lib/auth";
import { getCurrentTrip, getDeck, getProfiles } from "@/lib/data";
import { isPastDeadline } from "@/lib/domain/trip";
import { PageHeader } from "@/components/PageHeader";
import { Countdown } from "@/components/Countdown";
import { SwipeDeck } from "@/components/SwipeDeck";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";

export default async function FunSwipe() {
  const user = await requireUser();
  // Profil, paquet, course en cours et membres : tout part en même temps.
  const [me, deck, trip, members] = await Promise.all([
    requireProfile("fun"),
    getDeck(user.familyId, user.profileId),
    getCurrentTrip(user.familyId),
    getProfiles(user.familyId),
  ]);
  const iAmShopper = trip?.created_by === me.id;
  const answered = trip?.trip_requests.some((r) => r.profile_id === me.id) ?? false;
  const shopper = members.find((m) => m.id === trip?.created_by) ?? null;
  const who = shopper?.name ?? "Quelqu'un";

  return (
    <div className="h-screen-tabbar flex flex-col">
      <PageHeader title={`Salut ${me.name} ${me.emoji}`} />
      {trip && (iAmShopper || (!answered && trip.status === "open")) && (
        <Link
          href="/fun/courses"
          className="mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 to-fuchsia-500 px-4 py-2.5 leading-snug font-semibold text-white shadow-lg active:scale-[0.98]"
        >
          <span className="text-3xl">🛒</span>
          <span className="flex-1">
            {iAmShopper ? (
              "Tu fais les courses : regarde ce que la famille veut !"
            ) : isPastDeadline(trip.deadline_at) ? (
              `${who} fait les courses : dis-lui vite ce que tu veux !`
            ) : (
              <>
                {who} part dans <Countdown deadline={trip.deadline_at} /> : dis-lui ce que tu veux !
              </>
            )}
          </span>
          <span className="text-2xl">›</span>
        </Link>
      )}
      <NotificationsCard variant="pill" />
      <SwipeDeck initialDeck={deck} />
    </div>
  );
}
