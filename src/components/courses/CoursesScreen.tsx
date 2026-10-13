import Link from "next/link";
import type { Profile } from "@/lib/data";
import { getMatches, getProfiles, getRecipes } from "@/lib/data";
import { getTripOverview, type TripOverview } from "@/lib/views";
import { departureChoices, formatTime } from "@/lib/domain/trip";
import { ROUTES } from "@/lib/routes";
import { cancelTrip, validateTrip } from "@/app/actions/trips";
import { Countdown } from "@/components/Countdown";
import { SubmitButton } from "@/components/SubmitButton";
import { StartTrip } from "./StartTrip";
import { RecipeChecklist } from "./RecipeChecklist";
import { ConfirmButton } from "./ConfirmButton";
import { RequestForm } from "./RequestForm";

/**
 * L'écran « Courses », le même pour tout le monde, dans le style de chacun :
 * - personne ne fait les courses → gros bouton « Je pars… » ;
 * - c'est moi qui les fais → réponses de la famille, plats, liste ;
 * - quelqu'un d'autre les fait → je lui dis ce que je veux.
 */
export async function CoursesScreen({ me }: { me: Profile }) {
  const overview = await getTripOverview(me.family_id, me.id);

  if (!overview) {
    const others = (await getProfiles(me.family_id)).filter((p) => p.id !== me.id).map((p) => p.name);
    return <StartTrip choices={departureChoices()} others={others} variant={me.style} />;
  }
  return overview.iAmShopper ? <ShopperView me={me} overview={overview} /> : <ResponderView me={me} overview={overview} />;
}

function ShopperView({ me, overview }: { me: Profile; overview: TripOverview }) {
  const { trip, responses, candidates, pastDeadline, nobodyAnswered } = overview;
  const validated = trip.status === "validated";
  const checkedCount = candidates.filter((c) => c.checked).length;
  const fun = me.style === "fun";
  const accent = fun ? "bg-gradient-to-r from-orange-500 to-fuchsia-500" : "bg-tomato-500";

  return (
    <>
      {validated ? (
        <Link
          href={ROUTES[me.style].liste}
          className="mb-6 flex items-center gap-4 rounded-[2rem] bg-basil-500 px-6 py-6 text-white shadow-lg active:scale-[0.98]"
        >
          <span className="text-5xl">📝</span>
          <span className="text-2xl leading-tight font-extrabold">Ma liste de courses est prête</span>
        </Link>
      ) : (
        <section className={`mb-6 rounded-[2rem] px-6 py-6 text-center text-white shadow-lg ${accent}`}>
          <p className="text-lg opacity-90">{pastDeadline ? "Départ prévu à" : "Je pars dans"}</p>
          <p className="text-5xl font-extrabold">
            {pastDeadline ? formatTime(trip.deadline_at) : <Countdown deadline={trip.deadline_at} />}
          </p>
          {!pastDeadline && <p className="mt-1 text-lg opacity-90">à {formatTime(trip.deadline_at)}</p>}
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold">La famille</h2>
        {responses.length === 0 ? (
          <p className="rounded-3xl bg-white p-4 text-stone-500">Personne d&apos;autre dans la famille pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-3">
            {responses.map(({ member, request, recipes }) => (
              <li key={member.id} className="rounded-3xl bg-white p-4 shadow-sm">
                <p className="flex items-center gap-3 text-xl font-bold">
                  <span className="text-3xl">{member.emoji}</span>
                  {member.name}
                  <span className={`ml-auto text-base font-semibold ${request ? "text-basil-600" : "text-stone-400"}`}>
                    {request ? "a répondu ✓" : "pas encore répondu"}
                  </span>
                </p>
                {request?.free_text && <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xl">« {request.free_text} »</p>}
                {recipes.length > 0 && (
                  <p className="mt-2 text-lg text-stone-600">
                    Veut : <strong>{recipes.map((r) => r.title).join(", ")}</strong>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold">Les plats</h2>
        <p className="mb-3 text-stone-500">
          {pastDeadline && nobodyAnswered
            ? "Personne n'a répondu ? Pas de souci : voici les plats que la famille aime. Touchez pour choisir."
            : "Touchez un plat pour le choisir."}
        </p>
        {candidates.length > 0 ? (
          <RecipeChecklist recipes={candidates} />
        ) : (
          <p className="rounded-3xl bg-white p-5 text-stone-500">Pas encore de plat proposé. Vous pouvez quand même faire votre liste.</p>
        )}
      </section>

      <form action={validateTrip} className="sticky bottom-28 z-20">
        <SubmitButton
          pendingLabel="Je prépare la liste…"
          className="w-full rounded-[2rem] bg-basil-500 py-6 text-2xl font-extrabold text-white shadow-xl shadow-basil-500/30 active:scale-[0.98]"
        >
          {validated
            ? "Mettre à jour ma liste"
            : `✅ Faire ma liste${checkedCount ? ` (${checkedCount} plat${checkedCount > 1 ? "s" : ""})` : ""}`}
        </SubmitButton>
      </form>

      <div className="mt-6 text-center">
        <ConfirmButton
          action={cancelTrip}
          question="Annuler ces courses ? Les réponses et la liste seront effacées."
          className="py-3 text-base text-stone-400 underline"
        >
          Annuler ces courses
        </ConfirmButton>
      </div>
    </>
  );
}

async function ResponderView({ me, overview }: { me: Profile; overview: TripOverview }) {
  const { trip, shopper, responses, pastDeadline } = overview;
  const [matches, recipes] = await Promise.all([getMatches(me.family_id), getRecipes(me.family_id)]);
  const mine = responses.find((r) => r.member.id === me.id)?.request ?? null;
  const others = responses.filter((r) => r.member.id !== me.id && r.request);
  const matchIds = new Set(matches.map((m) => m.id));
  const choices = [...matches, ...recipes.filter((r) => mine?.recipe_ids.includes(r.id) && !matchIds.has(r.id))];
  const who = shopper?.name ?? "Quelqu'un";
  const accent = me.style === "fun" ? "bg-gradient-to-r from-orange-500 to-fuchsia-500" : "bg-tomato-500";

  return (
    <>
      <section className={`mb-5 rounded-[2rem] p-5 text-center text-white shadow-lg ${accent}`}>
        {trip.status === "validated" ? (
          <p className="text-xl font-bold">La liste de {who} est faite ✅ Tu peux encore ajouter une demande.</p>
        ) : pastDeadline ? (
          <p className="text-xl font-bold">
            {who} devait partir à {formatTime(trip.deadline_at)}. Fais vite !
          </p>
        ) : (
          <>
            <p className="opacity-90">
              {shopper?.emoji} {who} part dans
            </p>
            <p className="text-5xl font-black">
              <Countdown deadline={trip.deadline_at} />
            </p>
          </>
        )}
      </section>

      {others.map(({ member, request, recipes: wanted }) => (
        <p key={member.id} className="mb-4 rounded-2xl bg-white/80 px-4 py-3 text-stone-600">
          <strong>{member.name}</strong> a demandé{" "}
          {[request?.free_text && `« ${request.free_text} »`, wanted.map((r) => r.title).join(", ")].filter(Boolean).join(" + ")}
        </p>
      ))}

      <RequestForm
        choices={choices}
        initialText={mine?.free_text ?? ""}
        initialRecipeIds={mine?.recipe_ids ?? []}
        alreadySent={mine != null}
        shopperName={who}
      />

      {trip.status === "validated" && (
        <Link href={ROUTES[me.style].liste} className="mt-6 block py-3 text-center text-lg font-semibold text-stone-600 underline">
          📝 Voir la liste de courses
        </Link>
      )}
    </>
  );
}
