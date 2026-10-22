import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { forFamily, getFamilyEnvies, getProfiles, getRecipes, getRepasAchetes } from "@/lib/data";
import { platsDuMenu, synchroniserMenu } from "@/lib/menu";
import { listeDeNoms } from "@/lib/domain/convives";
import { CarteInviter } from "@/components/Envies";
import { BandeauScene, EtatVide, IconeLivre } from "@/components/ui";
import { CeSoir } from "@/components/courses/CeSoir";
import { PlatsDuMenu } from "@/components/PlatsDuMenu";

export const metadata = { title: "Le Menu — Kaddie" };

/** « Aussi envie » : au plus ce nombre de plats, à ajouter d'un appui. */
const AUTRES_MAX = 6;

/**
 * Le Menu : ce que la famille va manger. Un plat qui plaît (un match ; seul, une envie)
 * y entre de lui-même, et ses ingrédients sont sur la liste (lib/menu.ts).
 * Au-dessus, ce qui est déjà acheté et reste à cuisiner.
 */
export default async function Menu() {
  const me = await requireProfile();
  const [{ trip }, profiles, recipes, envies, repas] = await Promise.all([
    synchroniserMenu(me.family_id),
    getProfiles(me.family_id),
    getRecipes(me.family_id),
    getFamilyEnvies(me.family_id),
    getRepasAchetes(me.family_id),
  ]);
  const seul = profiles.length === 1;
  const noms = new Map(profiles.map((p) => [p.id, p.name]));
  const parId = new Map(recipes.map((r) => [r.id, r]));
  const auMenu = new Set(platsDuMenu(trip));
  const achetes = new Set((repas?.plats ?? []).filter((p) => !p.fait).map((p) => p.id));
  const qui = (id: string) => (envies.get(id) ?? []).flatMap((p) => noms.get(p) ?? []);
  const infos = (id: string) => {
    const r = parId.get(id);
    const envie = qui(id);
    return [envie.length ? `Envie de ${listeDeNoms(envie, me.name).replace(/^Toi\b/, "toi")}` : null, r?.total_minutes ? `${r.total_minutes} min` : null]
      .filter(Boolean)
      .join(" · ");
  };
  const plats = [...auMenu].flatMap((id) => (parId.has(id) ? [{ ...parId.get(id)!, infos: infos(id) }] : []));
  // D'autres envies (y compris un plat retiré du Menu), les plus partagées d'abord.
  const autres = (
    await forFamily(
      me.family_id,
      [...envies.keys()]
        .filter((id) => !auMenu.has(id) && !achetes.has(id))
        .sort((a, b) => (envies.get(b)?.length ?? 0) - (envies.get(a)?.length ?? 0))
        .flatMap((id) => parId.get(id) ?? []),
    )
  )
    .slice(0, AUTRES_MAX)
    .map((r) => ({ ...r, infos: infos(r.id) }));

  return (
    <>
      <BandeauScene
        illustration="table"
        etiquette={plats.length ? `${plats.length} plat${plats.length > 1 ? "s" : ""} au Menu` : "Ce qu'on mange"}
        titre="Le Menu"
        actions={
          <Link href="/recettes" aria-label="Toutes les recettes" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-blanc text-aubergine active:scale-95">
            <IconeLivre />
          </Link>
        }
      />
      {seul && <CarteInviter />}
      {repas && <CeSoir tripId={repas.tripId} plats={repas.plats} moi={me.name} />}

      {plats.length === 0 && autres.length === 0 ? (
        <EtatVide
          phrase={
            seul
              ? "Swipe des plats : ce qui te fait envie arrive ici, et ses ingrédients vont tout seuls sur la liste."
              : "Swipe des plats : quand vous êtes au moins deux à dire « Miam », le plat arrive ici et ses ingrédients vont tout seuls sur la liste."
          }
        >
          <Link href="/envies" className="kd-btn kd-btn--secondaire min-h-12 px-5">
            Swiper des plats
          </Link>
        </EtatVide>
      ) : (
        <PlatsDuMenu menu={plats} autres={autres} />
      )}
    </>
  );
}
