import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getAppris, getCeSoirChoisi, getCoursesPassees, getDerniereCourse, getFamily, getHistorique, getProfiles, getRecipes } from "@/lib/data";
import { aPreparer } from "@/lib/views";
import { platsDuMenu, synchroniserMenu } from "@/lib/menu";
import { listeDeNoms } from "@/lib/domain/convives";
import { ROUTES } from "@/lib/routes";
import { BandeauScene } from "@/components/ui";
import { InstallerKaddie } from "@/components/pwa/InstallerKaddie";
import { NoterEtape } from "@/components/NoterEtape";
import { BilanCourses } from "./BilanCourses";
import { AVerifier } from "./AVerifier";
import { DerniereDemande } from "./DerniereDemande";
import { JePars } from "./JePars";
import { JeNePartsPlus, PrendreLeRelais } from "./DepartCourses";
import { ShoppingList } from "./ShoppingList";

/** « Je pars faire les courses » reste affiché quelques heures, le temps des courses. */
const DEPART_VISIBLE_MS = 6 * 60 * 60 * 1000;

/**
 * Les courses : la liste, toujours prête. Les ingrédients des plats du Menu y sont déjà
 * (lib/menu.ts) ; chacun peut ajouter un article ou cocher. Personne n'a à lancer
 * de course : « Je pars faire les courses » prévient seulement la famille.
 */
export async function CoursesScreen({ familyId, notifications }: { familyId: string; notifications?: React.ReactNode }) {
  // Le profil se charge avec le reste (la famille vient du cookie) : une attente de moins.
  const [me, { trip }, profiles, appris, derniere, recipes, choisi, famille] = await Promise.all([
    requireProfile(),
    synchroniserMenu(familyId),
    getProfiles(familyId),
    getAppris(familyId),
    getDerniereCourse(familyId),
    getRecipes(familyId),
    getCeSoirChoisi(familyId),
    getFamily(familyId),
    // Ce que « Avant de partir » lira (aPreparer) : déjà en route, il n'attendra pas la course.
    getHistorique(familyId),
    getCoursesPassees(familyId),
  ]);
  const prep = await aPreparer(familyId, trip);
  const titres = new Map(recipes.map((r) => [r.id, r.title]));
  const menu = platsDuMenu(trip).flatMap((id) => titres.get(id) ?? []);
  const ceSoir = choisi ? titres.get(choisi.recipeId) : undefined;
  const enCourse = trip.created_by && Date.now() - Date.parse(trip.departs_at) < DEPART_VISIBLE_MS ? trip.created_by : null;
  const qui = enCourse && enCourse !== me.id ? (profiles.find((p) => p.id === enCourse)?.name ?? "Quelqu'un") : null;
  const seul = profiles.length === 1;

  return (
    <>
      <BandeauScene
        compact
        fond="courses"
        illustration="courses"
        etiquette={enCourse === me.id ? "Tu fais les courses" : qui ? `${qui} fait les courses` : `Salut ${me.name}`}
        titre="Le caddie"
        initiale={me.name}
        actions={notifications}
      />
      {derniere && <BilanCourses course={derniere} moi={{ id: me.id, name: me.name }} />}

      <p className="mb-4 text-encre-douce">
        {menu.length > 0 ? (
          <>
            {ceSoir ? "Pour ce soir" : "Pour ce qu'on mange"} : <strong className="text-encre">{ceSoir ?? listeDeNoms(menu)}</strong>.{" "}
          </>
        ) : (
          <>Rien à cuisiner pour l&apos;instant : {seul ? "swipe des plats" : "quand vous êtes au moins deux à dire « Miam »"}, leurs ingrédients arrivent ici. </>
        )}
        {/* py-3 : la zone d'appui fait 44 px de haut sans changer la ligne */}
        <Link href={ROUTES.menu} className="py-3 font-semibold whitespace-nowrap text-violet underline underline-offset-4">
          Voir Ce soir
        </Link>
      </p>

      {/* Quelqu'un d'autre est parti : une dernière demande, d'un appui. */}
      {qui && <DerniereDemande qui={qui} choix={[...prep.reportes, ...prep.habituels].slice(0, 4).map((s) => s.nom)} versCaddie={false} />}
      {qui && !seul && (
        <p className="mb-6">
          <PrendreLeRelais />
        </p>
      )}

      {/* Après « Je pars », l'écran se met à jour : la confirmation reste, le bouton disparaît ; on peut encore y renoncer. */}
      {enCourse === me.id && !seul ? (
        <div className="mb-6">
          <p className="font-semibold">La famille est prévenue : une dernière envie peut encore arriver sur la liste.</p>
          <JeNePartsPlus />
        </div>
      ) : (
        !enCourse && !seul && <JePars />
      )}

      <AVerifier
        key={[...prep.aVerifier, ...prep.reportes.map((s) => s.cle), ...prep.habituels.map((s) => s.cle), ...prep.derniere.map((s) => s.cle)].join("|")}
        noms={prep.aVerifier}
        reportes={prep.reportes}
        habituels={prep.habituels}
        derniere={prep.derniere}
      />

      <ShoppingList tripId={trip.id} items={trip.shopping_list_items} requests={[]} appris={appris} />

      {famille && <InstallerKaddie code={famille.join_code} />}
      <NoterEtape etape="liste_ouverte" />
    </>
  );
}
