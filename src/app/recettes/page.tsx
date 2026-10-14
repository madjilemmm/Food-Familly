import Link from "next/link";
import { requireProfile, requireUser } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getRecipes } from "@/lib/data";
import { RecipeVisual } from "@/components/RecipeVisual";
import { BandeauScene, IconeRetour } from "@/components/ui";

export const metadata = { title: "Recettes — Kaddie" };

export default async function RecipesPage() {
  const user = await requireUser();
  const [me, recipes] = await Promise.all([requireProfile(), getRecipes(user.familyId)]);
  return (
    <>
      <BandeauScene
        illustration="marche"
        etiquette={`${recipes.length} recette${recipes.length > 1 ? "s" : ""}`}
        titre="Les recettes"
      >
        {/* En style simple, les recettes ne sont pas un onglet : on garde un retour vers les plats. */}
        {me.style === "simple" && (
          <Link href={ROUTES.simple.matchs} className="-ml-2 mt-2 inline-flex min-h-14 items-center gap-1 font-semibold text-blanc">
            <IconeRetour className="size-6" /> Les plats
          </Link>
        )}
      </BandeauScene>
      <Link href="/recettes/nouvelle" className="kd-btn kd-btn--large mb-6">
        Ajouter une recette
      </Link>
      <ul className="flex flex-col gap-3">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link href={`/recettes/${r.id}`} className="kd-carte flex-row items-center gap-4 p-3 active:scale-[0.99]">
              <RecipeVisual recipe={r} className="size-16 shrink-0 rounded-pastille" />
              <span className="flex-1 font-display text-titre-3 text-aubergine">{r.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
