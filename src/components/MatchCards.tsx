import { LigneRecette } from "@/components/LigneRecette";
import { listeDeNoms } from "@/lib/domain/convives";
import type { Match } from "@/lib/data";

/** Les envies en commun, en liste comme les recettes : qui en a envie, et le temps. */
export function MatchCards({ matches, moi }: { matches: Match[]; moi: string }) {
  return (
    <ul className="kd-liste border-t-2 border-trait">
      {matches.map((m) => (
        <LigneRecette
          key={m.id}
          recipe={m}
          infos={[`Envie de ${listeDeNoms(m.avec, moi).replace(/^Toi\b/, "toi")}`, m.total_minutes && `${m.total_minutes} min`].filter(Boolean).join(" · ")}
        />
      ))}
    </ul>
  );
}
