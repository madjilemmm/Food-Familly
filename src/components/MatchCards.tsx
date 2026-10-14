import { CarteRecette } from "@/design-system/components/Kaddie";
import { daysLeft } from "@/lib/domain/swipe-deck";
import type { Match } from "@/lib/data";

/** Les plats matchés, en cartes blanches sur fond lilas. */
export function MatchCards({ matches }: { matches: Match[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
      {matches.map((m) => (
        <li key={m.id}>
          <CarteRecette
            className="h-full [&_.kd-carte__corps]:p-4 [&_.kd-carte__titre]:text-titre-3"
            titre={m.title}
            photo={m.photo_url}
            infos={`${m.like_count} j'aime · encore ${daysLeft(m.expires_at)} j`}
          />
        </li>
      ))}
    </ul>
  );
}
