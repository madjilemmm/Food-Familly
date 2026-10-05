import Link from "next/link";
import { getRecipes } from "@/lib/data";
import { RecipeVisual } from "@/components/RecipeVisual";

export const metadata = { title: "Recettes — À table !" };

export default async function RecipesPage() {
  const recipes = await getRecipes();
  return (
    <>
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
