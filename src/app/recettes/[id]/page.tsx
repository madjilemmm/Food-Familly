import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile, requireUser } from "@/lib/auth";
import { getFamilyTastes, getRecipe } from "@/lib/data";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import { IconeRetour } from "@/components/ui";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser();
  const [, recipe, { members }] = await Promise.all([requireProfile(), getRecipe(user.familyId, id), getFamilyTastes(user.familyId)]);
  if (!recipe) notFound();
  return (
    <>
      <div className="pt-safe">
        <Link href="/recettes" className="-ml-2 inline-flex min-h-14 items-center gap-1 font-semibold text-violet">
          <IconeRetour className="size-6" /> Les recettes
        </Link>
      </div>
      <h1 className="kd-titre-1 mb-6 text-aubergine">Modifier la recette</h1>
      <RecipeForm recipe={recipe} gouts={members} />
    </>
  );
}
