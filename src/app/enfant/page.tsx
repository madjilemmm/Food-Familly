import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getCurrentTrip, getDeck, getTripRequests } from "@/lib/data";
import { isPastDeadline } from "@/lib/domain/trip";
import { PageHeader } from "@/components/PageHeader";
import { Countdown } from "@/components/Countdown";
import { SwipeDeck } from "@/components/child/SwipeDeck";

export default async function ChildSwipe() {
  const me = await requireProfile("child");
  const [deck, trip] = await Promise.all([getDeck(me.id), getCurrentTrip()]);
  const answered = trip ? (await getTripRequests(trip.id)).some((r) => r.profile_id === me.id) : false;

  return (
    <div className="h-screen-tabbar flex min-h-[34rem] flex-col">
      <PageHeader title={`Salut ${me.name} ${me.emoji}`} />
      {trip && !answered && trip.status === "open" && (
        <Link
          href="/enfant/courses"
          className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 to-fuchsia-500 px-4 py-3 font-semibold text-white shadow-lg active:scale-[0.98]"
        >
          <span className="text-3xl">🛒</span>
          <span className="flex-1">
            {isPastDeadline(trip.deadline_at) ? (
              "Maman fait les courses : dis-lui vite ce que tu veux !"
            ) : (
              <>
                Maman part dans <Countdown deadline={trip.deadline_at} /> : dis-lui ce que tu veux !
              </>
            )}
          </span>
          <span className="text-2xl">›</span>
        </Link>
      )}
      <SwipeDeck initialDeck={deck} />
    </div>
  );
}
