import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getProfiles } from "@/lib/data";
import { getTripOverview } from "@/lib/views";
import { departureChoices, formatTime } from "@/lib/domain/trip";
import { cancelTrip, validateTrip } from "@/app/actions/trips";
import { PageHeader } from "@/components/PageHeader";
import { Countdown } from "@/components/Countdown";
import { SubmitButton } from "@/components/SubmitButton";
import { StartTrip } from "@/components/parent/StartTrip";
import { RecipeChecklist } from "@/components/parent/RecipeChecklist";
import { ConfirmButton } from "@/components/parent/ConfirmButton";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";

export default async function ParentHome() {
  const [me, overview] = await Promise.all([requireProfile("parent"), getTripOverview()]);

  if (!overview) {
    const kids = (await getProfiles()).filter((p) => p.role === "child").map((p) => p.name);
    return (
      <>
        <PageHeader title={`Bonjour ${me.name} 👋`} big />
        <NotificationsCard variant="banner" />
        <StartTrip choices={departureChoices()} kids={kids.join(" et ")} />
      </>
    );
  }

  const { trip, responses, candidates, pastDeadline, nobodyAnswered } = overview;
  const validated = trip.status === "validated";
  const checkedCount = candidates.filter((c) => c.checked).length;

  return (
    <>
      <PageHeader title="Les courses" />
      <NotificationsCard variant="banner" />

      {/* Compte à rebours ou liste prête */}
      {validated ? (
        <Link
          href="/maman/liste"
          className="mb-6 flex items-center gap-4 rounded-[2rem] bg-basil-500 px-6 py-6 text-white shadow-lg active:scale-[0.98]"
        >
          <span className="text-5xl">📝</span>
          <span className="text-2xl leading-tight font-extrabold">Ma liste de courses est prête</span>
        </Link>
      ) : (
        <section className="mb-6 rounded-[2rem] bg-tomato-500 px-6 py-6 text-center text-white shadow-lg">
          <p className="text-lg opacity-90">{pastDeadline ? "Départ prévu à" : "Départ dans"}</p>
          <p className="text-5xl font-extrabold">
            {pastDeadline ? formatTime(trip.deadline_at) : <Countdown deadline={trip.deadline_at} />}
          </p>
          {!pastDeadline && <p className="mt-1 text-lg opacity-90">à {formatTime(trip.deadline_at)}</p>}
        </section>
      )}

      {/* Réponses des fils */}
      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold">Vos fils</h2>
        <ul className="space-y-3">
          {responses.map(({ child, request, recipes }) => (
            <li key={child.id} className="rounded-3xl bg-white p-4 shadow-sm">
              <p className="flex items-center gap-3 text-xl font-bold">
                <span className="text-3xl">{child.emoji}</span>
                {child.name}
                <span className={`ml-auto text-base font-semibold ${request ? "text-basil-600" : "text-stone-400"}`}>
                  {request ? "a répondu ✓" : "pas encore répondu"}
                </span>
              </p>
              {request?.free_text && (
                <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xl">« {request.free_text} »</p>
              )}
              {recipes.length > 0 && (
                <p className="mt-2 text-lg text-stone-600">
                  Veut : <strong>{recipes.map((r) => r.title).join(", ")}</strong>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Plats à cocher */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold">Les plats</h2>
        <p className="mb-3 text-stone-500">
          {pastDeadline && nobodyAnswered
            ? "Personne n'a répondu ? Pas de souci : voici les plats qu'ils aiment tous les deux. Touchez pour choisir."
            : "Touchez un plat pour le choisir."}
        </p>
        {candidates.length > 0 ? (
          <RecipeChecklist recipes={candidates} />
        ) : (
          <p className="rounded-3xl bg-white p-5 text-stone-500">
            Pas encore de plat proposé. Vous pouvez quand même faire votre liste.
          </p>
        )}
      </section>

      <form action={validateTrip} className="sticky bottom-28 z-20">
        <SubmitButton
          pendingLabel="Je prépare la liste…"
          className="w-full rounded-[2rem] bg-basil-500 py-6 text-2xl font-extrabold text-white shadow-xl shadow-basil-500/30 active:scale-[0.98]"
        >
          {validated ? "Mettre à jour ma liste" : `✅ Faire ma liste${checkedCount ? ` (${checkedCount} plat${checkedCount > 1 ? "s" : ""})` : ""}`}
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
