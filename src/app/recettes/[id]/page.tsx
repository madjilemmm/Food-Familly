import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile, requireUser } from "@/lib/auth";
import { getRecipe } from "@/lib/data";
import { RecipeForm } from "@/components/recipes/RecipeForm";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser();
  const [, recipe] = await Promise.all([requireProfile(), getRecipe(user.familyId, id)]);
  if (!recipe) notFound();
  return (
    <>
      <div className="pt-safe">
        <Link href="/recettes" className="inline-flex min-h-11 items-center font-semibold text-tomato-600">
          ‹ Les recettes
        </Link>
      </div>
      <h1 className="mb-5 text-3xl font-extrabold">Modifier la recette</h1>
      <RecipeForm recipe={recipe} />
    </>
  );
}
