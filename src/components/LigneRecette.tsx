import Link from "next/link";
import { RecipeVisual } from "@/components/RecipeVisual";

/**
 * Une ligne de recette, sur le modèle de l'écran Recettes : vignette, nom en gras,
 * une ligne d'information en petit, filet en dessous. On touche pour ouvrir la recette.
 */
export function LigneRecette({
  recipe,
  infos,
  depuis,
}: {
  recipe: { id: string; title: string; photo_url: string | null };
  infos?: string;
  /** L'écran d'où l'on vient : le retour de la recette y ramène. */
  depuis?: string;
}) {
  return (
    <li>
      <Link href={`/recettes/${recipe.id}${depuis ? `?depuis=${encodeURIComponent(depuis)}` : ""}`} className="flex items-center gap-4 border-b-2 border-trait py-2 active:bg-trait/40">
        <RecipeVisual recipe={recipe} taille="vignette" className="size-14 shrink-0 rounded-pastille" />
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className="font-semibold">{recipe.title}</span>
          {infos && <span className="kd-petit">{infos}</span>}
        </span>
      </Link>
    </li>
  );
}
