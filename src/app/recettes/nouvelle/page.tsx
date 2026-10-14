import Link from "next/link";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import { IconeRetour } from "@/components/ui";

export const metadata = { title: "Nouvelle recette — Kaddie" };

export default function NewRecipePage() {
  return (
    <>
      <div className="pt-safe">
        <Link href="/recettes" className="-ml-2 inline-flex min-h-14 items-center gap-1 font-semibold text-violet">
          <IconeRetour className="size-6" /> Les recettes
        </Link>
      </div>
      <h1 className="kd-titre-1 mb-6 text-aubergine">Nouvelle recette</h1>
      <RecipeForm />
    </>
  );
}
