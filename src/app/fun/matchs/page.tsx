import Link from "next/link";
import { requireProfile, requireUser } from "@/lib/auth";
import { getMatches } from "@/lib/data";
import { BandeauScene, EtatVide } from "@/components/ui";
import { MatchCards } from "@/components/MatchCards";

export default async function FunMatches() {
  const user = await requireUser();
  const [, matches] = await Promise.all([requireProfile("fun"), getMatches(user.familyId)]);
  return (
    <>
      <BandeauScene
        illustration="table"
        etiquette={`${matches.length} match${matches.length > 1 ? "s" : ""}`}
        titre="Les matchs de la famille"
      />
      {matches.length === 0 ? (
        <EtatVide phrase="Pas encore de match. Quand la majorité like le même plat, il arrive ici.">
          <Link href="/fun" className="kd-btn kd-btn--secondaire kd-btn--large">
            Aller swiper
          </Link>
        </EtatVide>
      ) : (
        <MatchCards matches={matches} />
      )}
    </>
  );
}
