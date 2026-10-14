import { after } from "next/server";
import { requireProfile, requireUser } from "@/lib/auth";
import { remplirSiBesoin } from "@/lib/marmiton";
import { getDeck, getMatches } from "@/lib/data";
import { Scene } from "@/design-system/components/Kaddie";
import { SwipeDeck } from "@/components/SwipeDeck";
import { CarteGouts, SwipeHeader } from "@/components/SwipeHeader";

// Laisse le temps à l'import Marmiton (lancé après l'affichage) de finir.
export const maxDuration = 60;

export default async function SimpleSwipe() {
  const user = await requireUser();
  const [me, deck, matches] = await Promise.all([
    requireProfile("simple"),
    getDeck(user.familyId, user.profileId),
    getMatches(user.familyId),
  ]);
  // Presque plus rien à découvrir : de nouvelles recettes arrivent de Marmiton, sans rien faire.
  after(() => remplirSiBesoin(user.familyId, deck.length));

  return (
    <Scene duo="aubergine" seed={21} className="ecran-scene gap-4">
      <SwipeHeader matchs={matches.length} />
      {!me.tastes_done_at && <CarteGouts retour="/simple/swipe" />}
      <h1 className="kd-titre-2">Qu&apos;est-ce qui te fait envie ce soir&nbsp;?</h1>
      <SwipeDeck initialDeck={deck} />
    </Scene>
  );
}
