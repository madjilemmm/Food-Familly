import Link from "next/link";
import { requireProfile, requireUser } from "@/lib/auth";
import { forFamily, getMatches, getMyLikes, getProfiles } from "@/lib/data";
import { CarteInviter } from "@/components/Envies";
import { BandeauScene, EtatVide } from "@/components/ui";
import { MatchCards } from "@/components/MatchCards";
import { LigneRecette } from "@/components/LigneRecette";

/**
 * Les envies en commun (au moins deux personnes), puis les miennes : de quoi retrouver
 * ce qu'on a swipé, et changer d'avis depuis la recette.
 */
export default async function Matchs() {
  const user = await requireUser();
  const [me, matches, mesEnvies, membres] = await Promise.all([
    requireProfile(),
    getMatches(user.familyId),
    getMyLikes(user.familyId, user.profileId),
    getProfiles(user.familyId),
  ]);
  const enCommun = new Set(matches.map((m) => m.id));
  const seules = await forFamily(user.familyId, mesEnvies.filter((r) => !enCommun.has(r.id)));

  // Seul·e dans la famille : pas de match possible, mais ses envies vont déjà dans les courses.
  if (membres.length === 1) {
    return (
      <>
        <BandeauScene illustration="table" etiquette={seules.length ? `${seules.length} envie${seules.length > 1 ? "s" : ""}` : undefined} titre="Tes envies" />
        <CarteInviter />
        {seules.length === 0 ? (
          <EtatVide phrase="Swipe des plats : ce qui te fait envie arrive ici, et Kaddie le propose quand tu fais les courses.">
            <Link href="/envies" className="kd-btn kd-btn--secondaire min-h-12 px-5">
              Swiper des plats
            </Link>
          </EtatVide>
        ) : (
          <>
            <p className="kd-petit mb-2">Kaddie les propose quand tu fais les courses. Touche un plat pour changer d&apos;avis.</p>
            <ul className="kd-liste border-t-2 border-trait">
              {seules.map((r) => (
                <LigneRecette key={r.id} recipe={r} depuis="/matchs" infos={r.total_minutes ? `${r.total_minutes} min` : undefined} />
              ))}
            </ul>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <BandeauScene
        illustration="table"
        etiquette={matches.length ? `${matches.length} match${matches.length > 1 ? "s" : ""}` : undefined}
        titre="Vos envies en commun"
      />
      {matches.length === 0 ? (
        <EtatVide phrase="Pas encore de match. Quand vous êtes au moins deux à avoir envie du même plat, il arrive ici.">
          <Link href="/envies" className="kd-btn kd-btn--secondaire min-h-12 px-5">
            Swiper des plats
          </Link>
        </EtatVide>
      ) : (
        <MatchCards matches={matches} moi={me.name} />
      )}

      {seules.length > 0 && (
        <section className="mt-8">
          <h2 className="kd-etiquette">Tes envies</h2>
          <p className="kd-petit mb-2">Elles arrivent toutes seules à la personne qui fait les courses. Touche un plat pour changer d&apos;avis.</p>
          <ul className="kd-liste border-t-2 border-trait">
            {seules.map((r) => (
              <LigneRecette key={r.id} recipe={r} depuis="/matchs" infos={r.total_minutes ? `${r.total_minutes} min` : undefined} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
