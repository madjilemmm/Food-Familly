import Link from "next/link";
import type { Profile } from "@/lib/data";
import { forFamily, getFamilyEnvies, getPasCeSoir, getProfiles, getRecipes, getRepasAchetes } from "@/lib/data";
import { choisirCeSoir } from "@/lib/domain/ce-soir";
import { listeDeNoms } from "@/lib/domain/convives";
import { RecipeVisual } from "@/components/RecipeVisual";
import { AppelerATable } from "@/components/ATable";
import { autreIdee } from "@/app/actions/ce-soir";

const JOUR = 86_400_000;
const enSemaine = () =>
  ["lun.", "mar.", "mer.", "jeu."].includes(new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "Europe/Paris" }).format(new Date()));

/**
 * La réponse du soir, en tête du Menu : UNE idée (règles : domain/ce-soir.ts), un appui pour cuisiner,
 * « Autre idée » pour la suivante (le plat écarté attend deux jours). Rien s'il n'y a ni plat acheté ni envie.
 */
export async function CeSoirCarte({ me, i = 0 }: { me: Profile; i?: number }) {
  const [repas, envies, recipes, profiles, pasCeSoir] = await Promise.all([
    getRepasAchetes(me.family_id),
    getFamilyEnvies(me.family_id),
    getRecipes(me.family_id),
    getProfiles(me.family_id),
    getPasCeSoir(me.family_id),
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
    { semaine: enSemaine(), pasCeSoir },
  );
  const idx = Math.max(0, i || 0);
  const plat = choix.length ? choix[idx % choix.length] : null;
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

  if (!plat) return null;
  return (
    <section className="kd-monte mb-8 flex flex-col gap-4" key={plat.id}>
      <Link href={`/recettes/${plat.id}?depuis=/menu&cuisine=1`} className="active:opacity-90">
        <RecipeVisual recipe={plat} className="aspect-[4/3] w-full rounded-carte" />
      </Link>
      <div>
        <h2 className="kd-titre-1 text-aubergine">{plat.title}</h2>
        <p className="kd-etiquette mt-2">{raison}</p>
      </div>
      <Link href={`/recettes/${plat.id}?depuis=/menu&cuisine=1`} className="kd-btn kd-btn--large">
        Je cuisine
      </Link>
      {choix.length > 1 && (
        <form action={autreIdee.bind(null, plat.id, idx)}>
          <button type="submit" className="kd-btn kd-btn--secondaire kd-btn--large w-full">
            Autre idée
          </button>
        </form>
      )}
      <AppelerATable titre={plat.title} />
    </section>
  );
}
