import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile, requireUser } from "@/lib/auth";
import { getCurrentTrip, getFamilyEnvies, getFamilySwipes, getProfiles, getRecipe, type RecipeWithIngredients } from "@/lib/data";
import { db } from "@/lib/supabase/server";
import { extractRecipe } from "@/lib/domain/recipe-import";
import { safeFetch } from "@/lib/safe-fetch";
import { RecipeVisual } from "@/components/RecipeVisual";
import { LienRetour } from "@/components/LienRetour";
import { IconeRetour } from "@/components/ui";
import { Ingredients } from "./Ingredients";
import { AvisRecette, type EtatAvis } from "./AvisRecette";

export const metadata = { title: "La recette — Kaddie" };

/** Recette Marmiton importée avant qu'on garde les étapes : on les récupère une fois. */
async function completer(recipe: RecipeWithIngredients): Promise<RecipeWithIngredients> {
  if (!recipe.source_url || recipe.steps?.length) return recipe;
  try {
    const page = await safeFetch(recipe.source_url, { maxBytes: 3 * 1024 * 1024, accept: "text/html", timeoutMs: 6000 });
    const r = extractRecipe(page.body.toString("utf8"));
    if (!r?.steps?.length) return recipe;
    const maj = { steps: r.steps, servings: r.servingsCount ?? recipe.servings, total_minutes: r.totalMinutes ?? recipe.total_minutes };
    await db().from("recipes").update(maj).eq("id", recipe.id);
    return { ...recipe, ...maj };
  } catch {
    return recipe;
  }
}

const duree = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, "0")}` : ""}`);

/** Le retour ramène à l'écran d'où l'on vient (Matchs, Courses…), sinon aux recettes. */
const RETOURS: Record<string, string> = { "/matchs": "Les matchs", "/courses": "Les courses", "/envies": "Les envies" };

export default async function RecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ depuis?: string }>;
}) {
  const [{ id }, { depuis }] = await Promise.all([params, searchParams]);
  const retour = depuis && RETOURS[depuis] ? { href: depuis, label: RETOURS[depuis] } : { href: "/recettes", label: "Les recettes" };
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser();
  const [, found, members, trip, swipes, envies] = await Promise.all([
    requireProfile(),
    getRecipe(user.familyId, id),
    getProfiles(user.familyId),
    getCurrentTrip(user.familyId),
    getFamilySwipes(user.familyId),
    getFamilyEnvies(user.familyId),
  ]);
  if (!found) notFound();
  const recipe = await completer(found);
  const people = trip?.people ?? Math.max(1, members.length);
  const monAvis = swipes.get(id)?.get(user.profileId);
  const etat: EtatAvis = envies.get(id)?.includes(user.profileId) ? "envie" : monAvis?.likedAt != null ? "aime" : monAvis ? "refuse" : null;
  const infos = [recipe.total_minutes && duree(recipe.total_minutes), recipe.servings && `prévue pour ${recipe.servings}`].filter(Boolean);

  return (
    <article className="pt-safe pb-6">
      <div className="flex items-center justify-between">
        <LienRetour href={retour.href} className="-ml-2 inline-flex min-h-14 items-center gap-1 font-semibold text-violet">
          <IconeRetour className="size-6" /> {retour.label}
        </LienRetour>
        <Link href={`/recettes/${recipe.id}/modifier`} className="kd-btn kd-btn--secondaire min-h-12 px-4 text-bouton">
          Modifier
        </Link>
      </div>

      <RecipeVisual recipe={recipe} className="mt-2 aspect-[4/3] w-full rounded-carte" />
      <h1 className="kd-titre-1 mt-5 text-aubergine">{recipe.title}</h1>
      {infos.length > 0 && <p className="kd-etiquette mt-2">{infos.join(" · ")}</p>}

      <AvisRecette key={etat ?? "aucun"} recipeId={recipe.id} etat={etat} />

      <Ingredients ingredients={recipe.recipe_ingredients} servings={recipe.servings} people={people} />

      <section className="mt-8">
        <h2 className="kd-titre-2 mb-4 text-aubergine">Les étapes</h2>
        {recipe.steps?.length ? (
          <ol className="flex flex-col gap-4">
            {recipe.steps.map((etape, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-pastille bg-accent font-display text-on-accent">
                  {i + 1}
                </span>
                <p className="pt-1">{etape}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-encre-douce">Pas encore d&apos;étapes pour cette recette. Tu peux les ajouter en la modifiant.</p>
        )}
      </section>

      {recipe.source_url && (
        <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="mt-8 flex min-h-14 items-center justify-center text-encre-douce underline underline-offset-4">
          Voir la recette sur Marmiton
        </a>
      )}
    </article>
  );
}
