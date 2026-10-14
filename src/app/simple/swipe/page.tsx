import { requireProfile, requireUser } from "@/lib/auth";
import { getDeck } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { SwipeDeck } from "@/components/SwipeDeck";

export default async function SimpleSwipe() {
  const user = await requireUser();
  const [, deck] = await Promise.all([requireProfile("simple"), getDeck(user.familyId, user.profileId)]);
  return (
    <div className="h-screen-tabbar flex flex-col">
      <PageHeader title="J'aime ou pas ?" subtitle="Touchez ♥ ou ✕ pour chaque plat" />
      <SwipeDeck initialDeck={deck} />
    </div>
  );
}
