import Link from "next/link";
import { requireProfile, requireUser } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getRecipes } from "@/lib/data";
import { RecipeVisual } from "@/components/RecipeVisual";

export const metadata = { title: "Recettes — Kaddie" };

export default async function RecipesPage() {
  const user = await requireUser();
  const [me, recipes] = await Promise.all([requireProfile(), getRecipes(user.familyId)]);
  return (
    <>
      {/* En style simple, les recettes ne sont pas un onglet : on garde un retour vers les plats. */}
      {me.style === "simple" ? (
        <div className="pt-safe">
          <Link href={ROUTES.simple.matchs} className="inline-flex min-h-11 items-center font-semibold text-tomato-600">
            ‹ Les plats
          </Link>
        </div>
      ) : (
        <div className="pt-safe" />
      )}
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Les recettes</h1>
        <Link href="/recettes/nouvelle" className="rounded-full bg-tomato-500 px-5 py-3 text-lg font-bold text-white shadow active:scale-95">
          + Ajouter
        </Link>
      </div>
      <ul className="space-y-3">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link href={`/recettes/${r.id}`} className="flex items-center gap-4 rounded-3xl bg-white p-3 shadow-sm active:scale-[0.99]">
              <RecipeVisual recipe={r} className="size-16 shrink-0 rounded-2xl" emojiClassName="text-3xl" />
              <span className="flex-1 text-xl font-bold">{r.title}</span>
              <span className="pr-2 text-2xl text-stone-300">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
