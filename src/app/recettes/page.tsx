import Link from "next/link";
import { requireProfile, requireUser } from "@/lib/auth";
import { conflictsOf, getRecipes, getTasteContext } from "@/lib/data";
import { nAimePas } from "@/lib/domain/foods";
import { RecipeVisual } from "@/components/RecipeVisual";
import { BandeauScene } from "@/components/ui";

export const metadata = { title: "Recettes — Kaddie" };

export default async function RecipesPage() {
  const user = await requireUser();
  const [me, all, tastes] = await Promise.all([requireProfile(), getRecipes(user.familyId), getTasteContext(user.familyId)]);
  // Les recettes de la famille d'abord, puis celles importées de Marmiton.
  const recipes = [...all.filter((r) => !r.source_url), ...all.filter((r) => r.source_url)];
  const auto = all.length - recipes.filter((r) => !r.source_url).length;
  return (
    <>
      <BandeauScene
        compact
        fond="courses"
        illustration="courses"
        etiquette={`${recipes.length} recette${recipes.length > 1 ? "s" : ""}`}
        titre="Les recettes"
        initiale={me.name}
      />
      <Link href="/recettes/nouvelle" className="kd-btn kd-btn--large mb-6">
        Ajouter une recette
      </Link>
      {auto > 0 && (
        <p className="kd-petit mb-4">
          Dont {auto} trouvée{auto > 1 ? "s" : ""} sur Marmiton, renouvelée{auto > 1 ? "s" : ""} toute{auto > 1 ? "s" : ""} seule{auto > 1 ? "s" : ""} pour le swipe.
        </p>
      )}
      {/* Une liste, pas une pile de cartes : photo, nom, et l'étiquette s'il y a lieu. */}
      <ul className="kd-liste border-t-2 border-trait">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link href={`/recettes/${r.id}`} className="flex items-center gap-4 border-b-2 border-trait py-2 active:bg-trait/40">
              <RecipeVisual recipe={r} taille="vignette" className="size-14 shrink-0 rounded-pastille" />
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <span className="font-semibold">{r.title}</span>
                <Etiquettes conflits={conflictsOf(tastes, r)} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** « Interdit pour Léo », « Madji n'aime pas » : tout reste listé, mais on sait pourquoi. */
function Etiquettes({ conflits }: { conflits: ReturnType<typeof conflictsOf> }) {
  if (!conflits.interditPar.length && !conflits.pasFanDe.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {conflits.interditPar.length > 0 && (
        <span className="kd-pastille bg-aubergine text-blanc">Interdit pour {conflits.interditPar.join(", ")}</span>
      )}
      {conflits.pasFanDe.length > 0 && <span className="kd-pastille">{nAimePas(conflits.pasFanDe)}</span>}
    </span>
  );
}
