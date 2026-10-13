import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getRecipe } from "@/lib/data";
import { RecipeForm } from "@/components/recipes/RecipeForm";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await requireProfile();
  const recipe = await getRecipe(me.family_id, id);
  if (!recipe) notFound();
  return (
    <>
      <h1 className="mb-5 text-3xl font-extrabold">Modifier la recette</h1>
      <RecipeForm recipe={recipe} />
    </>
  );
}
