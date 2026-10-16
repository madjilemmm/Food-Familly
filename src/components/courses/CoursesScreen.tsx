import Link from "next/link";
import type { Profile } from "@/lib/data";
import { forFamily, getMatches, getProfiles, getRecipes } from "@/lib/data";
import { getTripOverview, type TripOverview } from "@/lib/views";
import { departureChoices, formatTime } from "@/lib/domain/trip";
import { ROUTES } from "@/lib/routes";
import { cancelTrip, validateTrip } from "@/app/actions/trips";
import { Logo, Scene } from "@/design-system/components/Kaddie";
import { Countdown } from "@/components/Countdown";
import { SubmitButton } from "@/components/SubmitButton";
import { BandeauScene, FondCourses, LienReglages } from "@/components/ui";
import { StartTrip } from "./StartTrip";
import { RecipeChecklist } from "./RecipeChecklist";
import { ConfirmButton } from "./ConfirmButton";
import { RequestForm } from "./RequestForm";
import { PourCombien } from "./PourCombien";

/**
 * L'écran « Courses », le même pour tout le monde :
 * - personne ne fait les courses → une scène, un seul grand bouton « Je pars… » ;
 * - c'est moi qui les fais → réponses de la famille, plats à valider, liste ;
 * - quelqu'un d'autre les fait → je lui dis ce que je veux.
 */
export async function CoursesScreen({ me, notifications }: { me: Profile; notifications?: React.ReactNode }) {
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
  return overview.iAmShopper ? <ShopperView me={me} overview={overview} /> : <ResponderView me={me} overview={overview} />;
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

function ShopperView({ me, overview }: { me: Profile; overview: TripOverview }) {
  const { trip, responses, candidates, pastDeadline, nobodyAnswered, members } = overview;
  const validated = trip.status === "validated";
  const checkedCount = candidates.filter((c) => c.checked).length;
  const answered = responses.filter((r) => r.request).length;

  return (
    <>
      <BandeauScene
        fond="courses"
        illustration="table"
        etiquette={<Depart overview={overview} />}
        titre={answered > 0 || candidates.length > 0 ? "Ce soir, la famille veut" : "Les courses"}
      />

      {validated && (
        <Link href={ROUTES[me.style].liste} className="kd-btn kd-btn--like kd-btn--large mb-6">
          Ma liste est prête, je l&apos;ouvre
        </Link>
      )}

      <section className="mb-8">
        <h2 className="kd-etiquette mb-2">La famille</h2>
        {responses.length === 0 ? (
          <p className="text-encre-douce">Personne d&apos;autre dans la famille pour l&apos;instant.</p>
        ) : (
          <ul className="kd-liste">
            {responses.map(({ member, request, recipes }) => (
              <li key={member.id} className="flex min-h-14 flex-col justify-center gap-0.5 border-b-2 border-trait py-2">
                <p className="flex items-baseline gap-3">
                  <span className="font-semibold">{member.name}</span>
                  <span className="kd-petit ml-auto">{request ? "a répondu" : "pas encore répondu"}</span>
                </p>
                {request?.free_text && <p>« {request.free_text} »</p>}
                {recipes.length > 0 && (
                  <p className="text-encre-douce">
                    Veut&nbsp;: <strong className="text-encre">{recipes.map((r) => r.title).join(", ")}</strong>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="kd-etiquette">Les plats</h2>
        {pastDeadline && nobodyAnswered && (
          <p className="kd-petit">Personne n&apos;a répondu : voici les plats que la famille aime.</p>
        )}
        {candidates.length > 0 ? (
          <RecipeChecklist recipes={candidates} />
        ) : (
          <p className="text-encre-douce">Pas encore de plat proposé. Tu peux quand même faire ta liste.</p>
        )}
      </section>

      <PourCombien people={trip.people ?? Math.max(1, members.length)} />

      {/* Collé au-dessus des onglets, sur une bande lilas : le contenu passe dessous proprement. */}
      <form action={validateTrip} className="sticky bottom-[calc(4.25rem+max(env(safe-area-inset-bottom),0.75rem))] z-20 -mx-5 border-t-2 border-trait bg-fond px-5 pt-3 pb-3">
        <SubmitButton pendingLabel="Je prépare la liste…">
          {validated
            ? "Mettre à jour ma liste"
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

async function ResponderView({ me, overview }: { me: Profile; overview: TripOverview }) {
  const { trip, shopper, responses } = overview;
  const [matches, recipes] = await Promise.all([getMatches(me.family_id), getRecipes(me.family_id)]);
  const mine = responses.find((r) => r.member.id === me.id)?.request ?? null;
  const others = responses.filter((r) => r.member.id !== me.id && r.request);
  const matchIds = new Set(matches.map((m) => m.id));
  const choices = await forFamily(me.family_id, [
    ...matches,
    ...recipes.filter((r) => mine?.recipe_ids.includes(r.id) && !matchIds.has(r.id)),
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
        choices={choices}
        initialText={mine?.free_text ?? ""}
        initialRecipeIds={mine?.recipe_ids ?? []}
        alreadySent={mine != null}
        shopperName={who}
      />

      {validated && (
        <Link href={ROUTES[me.style].liste} className="mt-4 flex min-h-14 items-center justify-center font-semibold text-violet underline underline-offset-4">
          Voir la liste de courses
        </Link>
      )}
    </>
  );
}
