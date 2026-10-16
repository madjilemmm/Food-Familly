import Link from "next/link";
import { requireProfile, requireUser } from "@/lib/auth";
import { getMatches } from "@/lib/data";
import { getTripOverview } from "@/lib/views";
import { BandeauScene, EtatVide } from "@/components/ui";
import { MatchCards } from "@/components/MatchCards";
import { RecipeChecklist } from "@/components/courses/RecipeChecklist";

export default async function SimpleMatches() {
  const user = await requireUser();
  const [, overview, matches] = await Promise.all([
    requireProfile("simple"),
    getTripOverview(user.familyId, user.profileId),
    getMatches(user.familyId),
  ]);

  return (
    <>
      <BandeauScene
        illustration="table"
        etiquette={`${matches.length} plat${matches.length > 1 ? "s" : ""} aimé${matches.length > 1 ? "s" : ""}`}
        titre="Les plats préférés"
      />

      {matches.length === 0 ? (
        <EtatVide phrase="Pas encore de plat aimé par la majorité. Chacun swipe sur son téléphone.">
          <Link href="/simple/swipe" className="kd-btn kd-btn--secondaire kd-btn--large">
            Aller swiper
          </Link>
        </EtatVide>
      ) : overview?.iAmShopper ? (
        <>
          <p className="kd-petit mb-3">Garde les plats qui partent dans le caddie.</p>
          <RecipeChecklist recipes={overview.candidates.filter((c) => c.isMatch)} />
        </>
      ) : (
        <>
          <MatchCards matches={matches} />
          {!overview && (
            <Link href="/simple" className="kd-btn kd-btn--large mt-6">
              Lancer les courses
            </Link>
          )}
        </>
      )}

      <Link href="/recettes" className="mt-8 flex min-h-14 items-center justify-center text-encre-douce underline underline-offset-4">
        Gérer mes recettes
      </Link>
    </>
  );
}
