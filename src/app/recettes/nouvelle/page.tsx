import Link from "next/link";
import { RecipeForm } from "@/components/recipes/RecipeForm";

export const metadata = { title: "Nouvelle recette — Kaddie" };

export default function NewRecipePage() {
  return (
    <>
      <div className="pt-safe">
        <Link href="/recettes" className="inline-flex min-h-11 items-center font-semibold text-tomato-600">
          ‹ Les recettes
        </Link>
      </div>
      <h1 className="mb-5 text-3xl font-extrabold">Nouvelle recette</h1>
      <RecipeForm />
    </>
  );
}
