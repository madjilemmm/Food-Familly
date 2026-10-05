import { RecipeForm } from "@/components/recipes/RecipeForm";

export const metadata = { title: "Nouvelle recette — À table !" };

export default function NewRecipePage() {
  return (
    <>
      <h1 className="mb-5 text-3xl font-extrabold">Nouvelle recette</h1>
      <RecipeForm />
    </>
  );
}
