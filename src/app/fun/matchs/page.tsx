import { requireProfile } from "@/lib/auth";
import { getMatches } from "@/lib/data";
import { daysLeft } from "@/lib/domain/swipe-deck";
import { PageHeader } from "@/components/PageHeader";
import { RecipeVisual } from "@/components/RecipeVisual";

export default async function FunMatches() {
  const me = await requireProfile("fun");
  const matches = await getMatches(me.family_id);
  return (
    <>
      <PageHeader title="Les matchs 💞" subtitle="Les plats que la majorité de la famille aime" />
      {matches.length === 0 ? (
        <div className="rounded-[2rem] bg-white/80 p-8 text-center">
          <p className="text-6xl">🤝</p>
          <p className="mt-4 text-lg text-stone-600">Pas encore de match. Quand la majorité de la famille like le même plat, il arrive ici.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {matches.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <RecipeVisual recipe={m} className="aspect-square w-full" emojiClassName="text-6xl" />
              <div className="px-3 py-2">
                <p className="leading-tight font-bold">{m.title}</p>
                <p className="text-sm text-stone-500">❤️ {m.like_count} · encore {daysLeft(m.expires_at)} j</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
