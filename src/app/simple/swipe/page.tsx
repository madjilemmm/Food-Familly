import { requireProfile } from "@/lib/auth";
import { getDeck } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { SwipeDeck } from "@/components/SwipeDeck";

export default async function SimpleSwipe() {
  const me = await requireProfile("simple");
  const deck = await getDeck(me.family_id, me.id);
  return (
    <div className="h-screen-tabbar flex flex-col">
      <PageHeader title="J'aime ou pas ?" subtitle="Touchez ♥ ou ✕ pour chaque plat" />
      <SwipeDeck initialDeck={deck} />
    </div>
  );
}
