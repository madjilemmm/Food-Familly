import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { forFamily, getClassiques, getFamilyEnvies, getFamilySwipes, getProfiles, getRecipes, getRepasAchetes } from "@/lib/data";
import { platsDuMenu, synchroniserMenu } from "@/lib/menu";
import { listeDeNoms } from "@/lib/domain/convives";
import { CarteInviter } from "@/components/Envies";
import { BandeauScene, EtatVide, IconeLivre } from "@/components/ui";
import { CeSoir } from "@/components/courses/CeSoir";
import { PlatsDuMenu } from "@/components/PlatsDuMenu";
import { CeSoirCarte } from "@/components/CeSoirCarte";

export const metadata = { title: "Le Menu — Kaddie" };

/** « Aussi envie » : au plus ce nombre de plats, à ajouter d'un appui. */
const AUTRES_MAX = 6;
/** Menu vide : au moins ce nombre de plats que la famille aime sont proposés, à ajouter d'un appui. */
const PROPOSES_MIN = 3;

/**
 * Le Menu : ce que la famille va manger. Un plat qui plaît (un match ; seul, une envie)
 * y entre de lui-même, et ses ingrédients sont sur la liste (lib/menu.ts).
 * Au-dessus, ce qui est déjà acheté et reste à cuisiner.
 */
export default async function Menu({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const me = await requireProfile();
  const [{ trip }, profiles, recipes, envies, repas, classiques, avis, params] = await Promise.all([
    synchroniserMenu(me.family_id),
    getProfiles(me.family_id),
    getRecipes(me.family_id),
    getFamilyEnvies(me.family_id),
    getRepasAchetes(me.family_id),
    getClassiques(me.family_id),
    getFamilySwipes(me.family_id),
    searchParams,
  ]);
  const seul = profiles.length === 1;
  const noms = new Map(profiles.map((p) => [p.id, p.name]));
  const parId = new Map(recipes.map((r) => [r.id, r]));
  const auMenu = new Set(platsDuMenu(trip));
  const achetes = new Set((repas?.plats ?? []).filter((p) => !p.fait).map((p) => p.id));
  const qui = (id: string) => (envies.get(id) ?? []).flatMap((p) => noms.get(p) ?? []);
  const foisClassique = new Map(classiques.map((c) => [c.recipeId, c.fois]));
  const infos = (id: string, aime = false) => {
    const r = parId.get(id);
    const envie = qui(id);
    const aimePar = aime ? [...(avis.get(id) ?? [])].filter(([, a]) => a.likedAt != null).flatMap(([p]) => noms.get(p) ?? []) : [];
    return [
      foisClassique.has(id) ? `Classique · ${foisClassique.get(id)} fois` : null,
      envie.length ? `Envie de ${listeDeNoms(envie, me.name).replace(/^Toi\b/, "toi")}` : aimePar.length ? `Aimé par ${listeDeNoms(aimePar, me.name).replace(/^Toi\b/, "toi")}` : null,
      r?.total_minutes ? `${r.total_minutes} min` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };
  const plats = [...auMenu].flatMap((id) => (parId.has(id) ? [{ ...parId.get(id)!, infos: infos(id) }] : []));
  // D'autres envies (y compris un plat retiré du Menu), les plus partagées d'abord, puis les classiques du foyer.
  const dejaLa = new Set([...auMenu, ...achetes]);
  const candidats = [
    ...[...envies.keys()].sort((a, b) => (envies.get(b)?.length ?? 0) - (envies.get(a)?.length ?? 0)),
    ...classiques.map((c) => c.recipeId),
  ].filter((id, i, tous) => !dejaLa.has(id) && tous.indexOf(id) === i);
  let autres = (await forFamily(me.family_id, candidats.flatMap((id) => parId.get(id) ?? [])))
    .slice(0, AUTRES_MAX)
    .map((r) => ({ ...r, infos: infos(r.id) }));
  // Le Menu est vide et il y a peu à proposer : des plats que la famille aime déjà, à ajouter d'un appui.
  let titreAutres = "Aussi envie";
  if (plats.length === 0 && autres.length < PROPOSES_MIN) {
    const dejaProposes = new Set([...dejaLa, ...autres.map((r) => r.id)]);
    const aimes = [...avis]
      .filter(([id, parMembre]) => !dejaProposes.has(id) && [...parMembre.values()].some((a) => a.likedAt != null))
      .sort((a, b) => [...b[1].values()].filter((x) => x.likedAt != null).length - [...a[1].values()].filter((x) => x.likedAt != null).length)
      .flatMap(([id]) => parId.get(id) ?? []);
    const complement = (await forFamily(me.family_id, aimes)).slice(0, PROPOSES_MIN - autres.length).map((r) => ({ ...r, infos: infos(r.id, true) }));
    autres = [...autres, ...complement];
    if (autres.length > 0 && autres.every((r) => !qui(r.id).length && !foisClassique.has(r.id))) titreAutres = "Pour remplir le Menu";
  }
  const i = Math.max(0, Number(params.i) || 0);

  return (
    <>
      <BandeauScene
        compact
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
      <CeSoirCarte me={me} i={i} />
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
        <PlatsDuMenu menu={plats} autres={autres} titreAutres={titreAutres} />
      )}
    </>
  );
}
