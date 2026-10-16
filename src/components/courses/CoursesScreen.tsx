import Link from "next/link";
import type { Profile } from "@/lib/data";
import { forFamily, getMatches, getMyLikes, getProfiles, getRecipes } from "@/lib/data";
import { getTripOverview, type TripOverview } from "@/lib/views";
import { departureChoices, formatTime } from "@/lib/domain/trip";
import { ROUTES } from "@/lib/routes";
import { cancelTrip, takeOverTrip, validateTrip } from "@/app/actions/trips";
import { Logo, Scene } from "@/design-system/components/Kaddie";
import { Countdown } from "@/components/Countdown";
import { SubmitButton } from "@/components/SubmitButton";
import { BandeauScene, FondCourses, LienReglages } from "@/components/ui";
import { StartTrip } from "./StartTrip";
import { RecipeChecklist } from "./RecipeChecklist";
import { ConfirmButton } from "./ConfirmButton";
import { RequestForm } from "./RequestForm";
import { ListScreen } from "./ListScreen";

/**
 * L'écran « Courses » change avec le moment, pas avec la personne :
 * - personne n'y va → « Je pars dans… » (un appui et c'est moi qui les fais) ;
 * - j'y vais, je prépare → qui mange quoi, puis « Faire ma liste » ;
 * - j'y vais, la liste est faite → le magasin : rien que la liste ;
 * - quelqu'un d'autre y va → je dis ce que je veux, ou je prends le relais.
 */
export async function CoursesScreen({ me, vue, notifications }: { me: Profile; vue?: string; notifications?: React.ReactNode }) {
  const overview = await getTripOverview(me.family_id, me.id);

  if (!overview) {
    const others = (await getProfiles(me.family_id)).filter((p) => p.id !== me.id).map((p) => p.name);
    return (
      <Scene duo="aubergine" seed={4} className="ecran-scene justify-between gap-6">
        <FondCourses />
        <div className="flex flex-col gap-4 pt-6">
          {/* La cloche des notifs rejoint les réglages : rien entre le titre et le grand bouton. */}
          <div className="flex items-start justify-between">
            <Logo width={120} />
            <span className="flex gap-2">
              {notifications}
              <LienReglages surScene />
            </span>
          </div>
          <h1 className="kd-titre-1">Salut {me.name}&nbsp;!</h1>
        </div>
        <StartTrip choices={departureChoices()} others={others} />
      </Scene>
    );
  }
  const validated = overview.trip.status === "validated";
  if (overview.iAmShopper) {
    // Liste faite : au magasin, on ne voit qu'elle (les plats restent à un appui).
    if (validated && vue !== "plats") {
      return <ListScreen me={me} retour={{ href: "/courses?vue=plats", label: "Revoir les plats" }} />;
    }
    return <PreparerView me={me} overview={overview} />;
  }
  if (validated && vue === "liste") return <ListScreen me={me} retour={{ href: "/courses", label: "Mes envies" }} />;
  return <ResponderView me={me} overview={overview} />;
}

function Depart({ overview, qui }: { overview: TripOverview; qui?: string }) {
  const { trip, pastDeadline } = overview;
  if (pastDeadline) return <>{qui ? `${qui} devait partir` : "Départ prévu"} à {formatTime(trip.deadline_at)}</>;
  return (
    <>
      {qui ? `${qui} part dans` : "Départ dans"} <Countdown deadline={trip.deadline_at} /> · {formatTime(trip.deadline_at)}
    </>
  );
}

/** J'y vais, je prépare : pour qui est chaque plat, ce qu'on m'a demandé en plus. */
function PreparerView({ me, overview }: { me: Profile; overview: TripOverview }) {
  const { trip, responses, candidates, pastDeadline, nobodyAnswered } = overview;
  const validated = trip.status === "validated";
  const checkedCount = candidates.filter((c) => c.checked).length;
  const answered = responses.filter((r) => r.request).length;
  const enAttente = responses.filter((r) => !r.request).map((r) => r.member.name);
  const enPlus = responses.filter((r) => r.request?.free_text);
  // Déjà sur la liste avant de la faire : les articles pas pris la dernière fois, ou ajoutés à la main.
  const dejaSurLaListe = trip.shopping_list_items.filter((i) => i.source === "manual" || i.source === "request").map((i) => i.name);
  const noms = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}` : l[0]);

  return (
    <>
      <BandeauScene
        fond="courses"
        illustration="table"
        etiquette={
          <>
            <Depart overview={overview} />
            {responses.length > 0 && ` · ${answered} sur ${responses.length} ont répondu`}
          </>
        }
        titre="Qui mange quoi ?"
      />

      <section className="mb-8">
        {pastDeadline && nobodyAnswered && (
          <p className="kd-petit mb-2">Personne n&apos;a répondu : voici les plats que la famille aime, et tes envies.</p>
        )}
        {candidates.length > 0 ? (
          <RecipeChecklist recipes={candidates} moi={me.name} />
        ) : (
          <p className="text-encre-douce">Pas encore de plat proposé. Swipe tes envies, ou fais ta liste quand même.</p>
        )}
      </section>

      {enPlus.length > 0 && (
        <section className="mb-8">
          <h2 className="kd-etiquette">Demandé en plus</h2>
          <ul className="kd-liste">
            {enPlus.map(({ member, request }) => (
              <li key={member.id} className="kd-liste__article">
                <span>
                  <strong>{member.name}</strong>&nbsp;: « {request!.free_text} »
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!validated && dejaSurLaListe.length > 0 && (
        <p className="kd-petit mb-4">Déjà sur ta liste&nbsp;: {noms(dejaSurLaListe.slice(0, 6))}{dejaSurLaListe.length > 6 ? "…" : ""}</p>
      )}

      {enAttente.length > 0 && <p className="kd-petit mb-8">Pas encore répondu : {noms(enAttente)}</p>}

      {/* Collé au-dessus des onglets, sur une bande lilas : le contenu passe dessous proprement. */}
      <form action={validateTrip} className="sticky bottom-[calc(4.25rem+max(env(safe-area-inset-bottom),0.75rem))] z-20 -mx-5 border-t-2 border-trait bg-fond px-5 pt-3 pb-3">
        <SubmitButton pendingLabel="Je prépare la liste…">
          {/* La liste faite suit déjà les demandes et les plats cochés : on l'ouvre, simplement. */}
          {validated
            ? "Ouvrir ma liste"
            : `Faire ma liste${checkedCount ? ` (${checkedCount} plat${checkedCount > 1 ? "s" : ""})` : ""}`}
        </SubmitButton>
      </form>

      <div className="mt-6 text-center">
        <ConfirmButton
          action={cancelTrip}
          question="Annuler ces courses ?"
          detail="Les réponses de la famille et la liste seront effacées."
          confirmLabel="Oui, annuler les courses"
          className="min-h-14 px-2 text-encre-douce underline underline-offset-4"
        >
          Annuler ces courses
        </ConfirmButton>
      </div>
    </>
  );
}

/** Quelqu'un d'autre y va : mes envies (pour moi), les matchs (pour tous), ou je prends le relais. */
async function ResponderView({ me, overview }: { me: Profile; overview: TripOverview }) {
  const { trip, shopper, responses } = overview;
  const [matches, recipes, likes] = await Promise.all([
    getMatches(me.family_id),
    getRecipes(me.family_id),
    getMyLikes(me.family_id, me.id),
  ]);
  const mine = responses.find((r) => r.member.id === me.id)?.request ?? null;
  const others = responses.filter((r) => r.member.id !== me.id && r.request);
  const matchIds = new Set(matches.map((m) => m.id));
  const likeIds = new Set(likes.map((r) => r.id));
  const [envies, partages] = await Promise.all([
    forFamily(me.family_id, [
      ...likes.filter((r) => !matchIds.has(r.id)),
      ...recipes.filter((r) => mine?.recipe_ids.includes(r.id) && !matchIds.has(r.id) && !likeIds.has(r.id)),
    ]),
    forFamily(me.family_id, matches),
  ]);
  const who = shopper?.name ?? "Quelqu'un";
  const validated = trip.status === "validated";

  return (
    <>
      <BandeauScene
        fond="courses"
        illustration="marche"
        etiquette={validated ? `La liste de ${who} est faite` : <Depart overview={overview} qui={who} />}
        titre={validated ? "Encore une envie ?" : "Tu veux quoi ?"}
      />

      {validated && (
        <Link href={ROUTES.liste} className="kd-btn kd-btn--secondaire kd-btn--large mb-6">
          Voir la liste de {who}
        </Link>
      )}

      {others.length > 0 && (
        <ul className="mb-6 flex flex-col gap-2">
          {others.map(({ member, request, recipes: wanted }) => (
            <li key={member.id} className="text-encre-douce">
              <strong className="text-encre">{member.name}</strong> a demandé{" "}
              {[request?.free_text && `« ${request.free_text} »`, wanted.map((r) => r.title).join(", ")].filter(Boolean).join(" + ")}
            </li>
          ))}
        </ul>
      )}

      <RequestForm
        envies={envies}
        matchs={partages}
        initialText={mine?.free_text ?? ""}
        initialRecipeIds={mine?.recipe_ids ?? []}
        alreadySent={mine != null}
        shopperName={who}
      />

      {/* Les rôles s'échangent : qui veut peut faire les courses à la place. */}
      <div className="mt-8 text-center">
        <ConfirmButton
          action={takeOverTrip}
          question={`Tu y vas à la place de ${who} ?`}
          detail={`Les demandes et la liste passent sur ton téléphone. On prévient ${who}.`}
          confirmLabel="Oui, j'y vais"
          className="min-h-14 px-2 text-encre-douce underline underline-offset-4"
        >
          {who} ne peut plus ? Je prends le relais
        </ConfirmButton>
      </div>
    </>
  );
}
