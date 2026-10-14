import { requireProfile, requireUser } from "@/lib/auth";
import { getDeck, getMatches } from "@/lib/data";
import { Scene } from "@/design-system/components/Kaddie";
import { SwipeDeck } from "@/components/SwipeDeck";
import { SwipeHeader } from "@/components/SwipeHeader";

export default async function SimpleSwipe() {
  const user = await requireUser();
  const [, deck, matches] = await Promise.all([
    requireProfile("simple"),
    getDeck(user.familyId, user.profileId),
    getMatches(user.familyId),
  ]);
  return (
    <Scene duo="aubergine" seed={21} className="ecran-scene gap-4">
      <SwipeHeader matchs={matches.length} />
      <h1 className="kd-titre-2">Qu&apos;est-ce qui te fait envie ce soir&nbsp;?</h1>
      <SwipeDeck initialDeck={deck} />
    </Scene>
  );
}
