import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/data";
import { RecipeForm } from "@/components/recipes/RecipeForm";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const recipe = await getRecipe(id);
  if (!recipe) notFound();
  return (
    <>
      <h1 className="mb-5 text-3xl font-extrabold">Modifier la recette</h1>
      <RecipeForm recipe={recipe} />
    </>
  );
}
