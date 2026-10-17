import Link from "next/link";
import { after } from "next/server";
import { requireProfile, requireUser } from "@/lib/auth";
import { remplirSiBesoin } from "@/lib/marmiton";
import { getCurrentTrip, getDeck, getMatches, getProfiles } from "@/lib/data";
import { isPastDeadline } from "@/lib/domain/trip";
import { Countdown } from "@/components/Countdown";
import { SwipeDeck } from "@/components/SwipeDeck";
import { BandeauScene, IconePanier } from "@/components/ui";
import { BoutonMatchs, CarteGouts } from "@/components/Envies";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";

// Laisse le temps à l'import Marmiton (lancé après l'affichage) de finir.
export const maxDuration = 60;

export default async function Envies() {
  const user = await requireUser();
  // Profil, paquet, course en cours, membres et matchs : tout part en même temps.
  const [me, deck, trip, members, matches] = await Promise.all([
    requireProfile(),
    getDeck(user.familyId, user.profileId),
    getCurrentTrip(user.familyId),
    getProfiles(user.familyId),
    getMatches(user.familyId),
  ]);
  const iAmShopper = trip?.created_by === me.id;
  const answered = trip?.trip_requests.some((r) => r.profile_id === me.id) ?? false;
  const shopper = members.find((m) => m.id === trip?.created_by) ?? null;
  const who = shopper?.name ?? "Quelqu'un";
  const bandeauCourse = Boolean(trip && (iAmShopper || (!answered && trip.status === "open")));

  // Presque plus rien à découvrir : de nouvelles recettes arrivent de Marmiton, sans rien faire.
  after(() => remplirSiBesoin(user.familyId, deck.length));

  return (
    // Comme Recettes : le bandeau illustré, puis la pile de cartes sur le lilas, jusqu'aux onglets.
    <div className="ecran-envies">
      <BandeauScene
        illustration="table"
        etiquette="Ce soir"
        titre="Ça te dit ?"
        titreSous
        actions={
          <>
            <NotificationsCard variant="icone" />
            <BoutonMatchs matchs={matches.length} />
          </>
        }
      />
      {/* Un seul bandeau à la fois : la course en cours d'abord, sinon le questionnaire. */}
      {bandeauCourse && trip && (
        <Link
          href="/courses"
          className="mb-4 flex min-h-14 items-center gap-3 rounded-bouton bg-blanc px-4 py-2 text-petit leading-snug font-semibold text-aubergine active:scale-[0.98]"
        >
          <IconePanier className="size-6 shrink-0 text-violet" />
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
      {!bandeauCourse && !me.tastes_done_at && <CarteGouts retour="/envies" />}
      <SwipeDeck initialDeck={deck} />
    </div>
  );
}
