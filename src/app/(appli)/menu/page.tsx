import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { forFamily, getCeSoirChoisi, getClassiques, getFamilyEnvies, getFamilySwipes, getProfiles, getRecipes, getRepasAchetes } from "@/lib/data";
import { platsDuMenu, synchroniserMenu } from "@/lib/menu";
import { listeDeNoms, phraseEnvie } from "@/lib/domain/convives";
import { BandeauScene, EtatVide } from "@/components/ui";
import { CeSoir } from "@/components/courses/CeSoir";
import { PlatsDuMenu } from "@/components/PlatsDuMenu";
import { CeSoirAccueil } from "@/components/CeSoirAccueil";
import { DerniereDemande } from "@/components/courses/DerniereDemande";
import { aPreparer } from "@/lib/views";

export const metadata = { title: "Ce soir — Kaddie" };

/** « D'autres envies » : au plus ce nombre de plats, à ajouter d'un appui. */
const AUTRES_MAX = 6;
/** Menu vide : au moins ce nombre de plats que la famille aime sont proposés, à ajouter d'un appui. */
const PROPOSES_MIN = 3;

/**
 * Ce soir : la réponse à « on mange quoi ? » (components/CeSoirAccueil.tsx), puis « Cette semaine » :
 * ce que la famille va manger. Un plat qui plaît (un match ; seul, une envie)
 * y entre de lui-même, et ses ingrédients sont sur la liste (lib/menu.ts).
 * Au-dessus, ce qui est déjà acheté et reste à cuisiner.
 */
export default async function Menu({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const me = await requireProfile();
  const [{ trip }, profiles, recipes, envies, repas, classiques, avis, choisi, params] = await Promise.all([
    synchroniserMenu(me.family_id),
    getProfiles(me.family_id),
    getRecipes(me.family_id),
    getFamilyEnvies(me.family_id),
    getRepasAchetes(me.family_id),
    getClassiques(me.family_id),
    getFamilySwipes(me.family_id),
    getCeSoirChoisi(me.family_id),
    searchParams,
  ]);
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
      envie.length ? phraseEnvie(envie, me.name) : aimePar.length ? `Aimé par ${listeDeNoms(aimePar, me.name).replace(/^Toi\b/, "toi")}` : null,
      r?.total_minutes ? `${r.total_minutes} min` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };
  // Le plat de ce soir a sa place en haut : il n'est pas répété dans « Cette semaine ».
  const plats = [...auMenu].filter((id) => id !== choisi?.recipeId).flatMap((id) => (parId.has(id) ? [{ ...parId.get(id)!, infos: infos(id) }] : []));
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
  let titreAutres = "D'autres envies";
  if (plats.length === 0 && autres.length < PROPOSES_MIN) {
    const dejaProposes = new Set([...dejaLa, ...autres.map((r) => r.id)]);
    const aimes = [...avis]
      .filter(([id, parMembre]) => !dejaProposes.has(id) && [...parMembre.values()].some((a) => a.likedAt != null))
      .sort((a, b) => [...b[1].values()].filter((x) => x.likedAt != null).length - [...a[1].values()].filter((x) => x.likedAt != null).length)
      .flatMap(([id]) => parId.get(id) ?? []);
    const complement = (await forFamily(me.family_id, aimes)).slice(0, PROPOSES_MIN - autres.length).map((r) => ({ ...r, infos: infos(r.id, true) }));
    autres = [...autres, ...complement];
    if (autres.length > 0 && autres.every((r) => !qui(r.id).length && !foisClassique.has(r.id))) titreAutres = "Quelques idées";
  }
  const i = Math.max(0, Number(params.i) || 0);

  const { node: proposition, platId } = await CeSoirAccueil({ me, trip, i });
  // Le plat proposé n'est pas répété dans « D'autres envies » ; au Menu, il reste dans « Cette semaine » (c'est là qu'on le retire).
  const autresEnvies = autres.filter((p) => p.id !== platId);
  // Quelqu'un d'autre est parti faire les courses : une dernière demande, d'un appui.
  const parti = trip.created_by && trip.created_by !== me.id && Date.now() - Date.parse(trip.departs_at) < 6 * 60 * 60 * 1000 ? profiles.find((p) => p.id === trip.created_by) : undefined;
  const demandes = parti ? (({ reportes, habituels }) => [...reportes, ...habituels].slice(0, 4).map((s) => s.nom))(await aPreparer(me.family_id, trip)) : [];

  const decide = Boolean(choisi && parId.has(choisi.recipeId));
  const jour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date());

  return (
    <>
      {/* Le bandeau et la réponse du soir forment un seul écran : la photo mord sur le bandeau et prend la hauteur qui reste. */}
      <div className="ecran-soir">
        <BandeauScene
          chevauche
          fond="courses"
          illustration="courses"
          etiquette={jour.replace(/^./, (c) => c.toUpperCase())}
          titre={decide ? "Ce soir" : "Ce soir ?"}
          initiale={me.name}
        />
        {proposition}
      </div>
      {parti && <DerniereDemande qui={parti.name} choix={demandes} />}
      {repas && <CeSoir tripId={repas.tripId} plats={repas.plats.filter((p) => p.id !== choisi?.recipeId)} moi={me.name} />}

      {!proposition && plats.length === 0 && autresEnvies.length === 0 ? (
        <EtatVide phrase="Rien à proposer pour l'instant : swipe quelques plats, Kaddie s'en sert pour répondre à « on mange quoi ? ».">
          <Link href="/envies" className="kd-btn kd-btn--secondaire min-h-12 px-5">
            Explorer des plats
          </Link>
        </EtatVide>
      ) : (
        <PlatsDuMenu menu={plats} autres={autresEnvies} titreAutres={titreAutres} />
      )}
      <p className="mb-6">
        <Link href="/recettes" className="min-h-11 py-2.5 font-semibold text-violet underline underline-offset-4">
          Toutes les recettes
        </Link>
      </p>
    </>
  );
}
