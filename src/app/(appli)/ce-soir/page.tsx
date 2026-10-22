import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { forFamily, getFamilyEnvies, getProfiles, getRecipes, getRepasAchetes } from "@/lib/data";
import { choisirCeSoir } from "@/lib/domain/ce-soir";
import { listeDeNoms } from "@/lib/domain/convives";
import { BandeauScene, EtatVide } from "@/components/ui";
import { RecipeVisual } from "@/components/RecipeVisual";
import { AppelerATable } from "@/components/ATable";

export const metadata = { title: "Ce soir — Kaddie" };
export const dynamic = "force-dynamic";

const JOUR = 86_400_000;
const enSemaine = () =>
  ["lun.", "mar.", "mer.", "jeu."].includes(
    new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      timeZone: "Europe/Paris",
    }).format(new Date()),
  );

/**
 * « Ce soir » : une seule réponse à « on mange quoi ? » (règles : domain/ce-soir.ts).
 * Un appui pour cuisiner ; « Autre idée » pour la suivante.
 */
export default async function CeSoir({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const me = await requireProfile();
  const [repas, envies, recipes, profiles, params] = await Promise.all([
    getRepasAchetes(me.family_id),
    getFamilyEnvies(me.family_id),
    getRecipes(me.family_id),
    getProfiles(me.family_id),
    searchParams,
  ]);
  const noms = new Map(profiles.map((p) => [p.id, p.name]));
  const parId = new Map(recipes.map((r) => [r.id, r]));
  const achetes = (repas?.plats ?? []).filter((p) => !p.fait);
  const dejaAchetes = new Set(achetes.map((p) => p.id));
  const aAcheter = await forFamily(
    me.family_id,
    [...envies.keys()].filter((id) => !dejaAchetes.has(id)).flatMap((id) => parId.get(id) ?? []),
  );
  const jours = repas ? Math.max(0, (Date.now() - repas.le) / JOUR) : 0;
  const choix = choisirCeSoir(
    [
      ...achetes.map((r) => ({
        ...r,
        achete: true,
        joursDepuisAchat: jours,
        envies: envies.get(r.id)?.length ?? 0,
        minutes: r.total_minutes,
      })),
      ...aAcheter.map((r) => ({
        ...r,
        achete: false,
        joursDepuisAchat: 0,
        envies: envies.get(r.id)?.length ?? 0,
        minutes: r.total_minutes,
      })),
    ],
    { semaine: enSemaine() },
  );
  const i = Math.max(0, Number(params.i) || 0);
  const plat = choix.length ? choix[i % choix.length] : null;
  const qui = plat ? (envies.get(plat.id) ?? []).flatMap((id) => noms.get(id) ?? []) : [];
  const raison = plat
    ? [
        plat.achete ? "Déjà acheté" : "À acheter",
        qui.length ? `envie de ${listeDeNoms(qui, me.name).replace(/^Toi\b/, "toi")}` : null,
        plat.minutes ? `${plat.minutes} min` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <>
      <BandeauScene illustration="table" etiquette="Ce soir" titre="On mange quoi ?" />
      {plat ? (
        <section className="kd-monte flex flex-col gap-4" key={plat.id}>
          <Link href={`/recettes/${plat.id}?depuis=/ce-soir&cuisine=1`} className="active:opacity-90">
            <RecipeVisual recipe={plat} className="aspect-[4/3] w-full rounded-carte" />
          </Link>
          <div>
            <h2 className="kd-titre-1 text-aubergine">{plat.title}</h2>
            <p className="kd-etiquette mt-2">{raison}</p>
          </div>
          <Link href={`/recettes/${plat.id}?depuis=/ce-soir&cuisine=1`} className="kd-btn kd-btn--large">
            Je cuisine
          </Link>
          {choix.length > 1 && (
            <Link href={`/ce-soir?i=${i + 1}`} className="kd-btn kd-btn--secondaire kd-btn--large">
              Autre idée
            </Link>
          )}
          <AppelerATable titre={plat.title} />
        </section>
      ) : (
        <EtatVide phrase="Rien d'acheté ni d'envie en ce moment. Swipe quelques plats : Kaddie aura une réponse ce soir.">
          <Link href="/envies" className="kd-btn kd-btn--secondaire min-h-12 px-5">
            Swiper des plats
          </Link>
        </EtatVide>
      )}
    </>
  );
}
