import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getFamilyTastes } from "@/lib/data";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import { IconeRetour } from "@/components/ui";

export const metadata = { title: "Nouvelle recette — Kaddie" };

export default async function NewRecipePage() {
  const user = await requireUser();
  const { members } = await getFamilyTastes(user.familyId);
  return (
    <>
      <div className="pt-safe">
        <Link href="/recettes" className="-ml-2 inline-flex min-h-14 items-center gap-1 font-semibold text-violet">
          <IconeRetour className="size-6" /> Les recettes
        </Link>
      </div>
      <h1 className="kd-titre-1 mb-6 text-aubergine">Nouvelle recette</h1>
      <RecipeForm gouts={members} />
    </>
  );
}
