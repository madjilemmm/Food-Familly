import Link from "next/link";
import { CarteRecette } from "@/design-system/components/Kaddie";
import { daysLeft } from "@/lib/domain/swipe-deck";
import type { Match } from "@/lib/data";

/** Les plats matchés, en cartes blanches sur fond lilas ; on touche pour voir la recette. */
export function MatchCards({ matches }: { matches: Match[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {matches.map((m) => (
        <li key={m.id}>
          <Link
            href={`/recettes/${m.id}`}
            aria-label={`La recette : ${m.title}`}
            className="block h-full rounded-carte active:scale-[0.98]"
          >
            <CarteRecette
              className="h-full [&_.kd-carte__corps]:gap-1 [&_.kd-carte__corps]:p-3 [&_.kd-carte__titre]:text-bouton"
              titre={m.title}
              photo={m.photo_url}
              infos={[
                m.total_minutes && `${m.total_minutes} min`,
                `${m.like_count} j'aime`,
                `encore ${daysLeft(m.expires_at)} j`,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
