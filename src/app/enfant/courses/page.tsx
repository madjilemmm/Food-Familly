import { requireProfile } from "@/lib/auth";
import { getCurrentTrip, getMatches, getProfiles, getRecipes, getTripRequests } from "@/lib/data";
import { formatTime, isPastDeadline } from "@/lib/domain/trip";
import { PageHeader } from "@/components/PageHeader";
import { Countdown } from "@/components/Countdown";
import { RequestForm } from "@/components/child/RequestForm";

export default async function ChildTrip() {
  const me = await requireProfile("child");
  const trip = await getCurrentTrip();

  if (!trip) {
    return (
      <>
        <PageHeader title="Les courses" />
        <div className="rounded-[2rem] bg-white/80 p-8 text-center shadow-sm">
          <p className="text-6xl">😴</p>
          <p className="mt-4 text-xl font-bold">Pas de courses prévues</p>
          <p className="mt-2 text-stone-500">Tu recevras une notif quand maman partira. En attendant, va swiper !</p>
        </div>
      </>
    );
  }

  const [requests, matches, recipes, profiles] = await Promise.all([
    getTripRequests(trip.id),
    getMatches(),
    getRecipes(),
    getProfiles(),
  ]);
  const mine = requests.find((r) => r.profile_id === me.id) ?? null;
  const others = requests.filter((r) => r.profile_id !== me.id);
  const recipeTitle = new Map(recipes.map((r) => [r.id, r.title]));
  const name = new Map(profiles.map((p) => [p.id, p.name]));
  // Les matchs, plus les plats déjà choisis qui ne seraient plus des matchs
  const matchIds = new Set(matches.map((m) => m.id));
  const choices = [...matches, ...recipes.filter((r) => mine?.recipe_ids.includes(r.id) && !matchIds.has(r.id))];
  const past = isPastDeadline(trip.deadline_at);

  return (
    <>
      <PageHeader title="Les courses" />

      <section className="mb-5 rounded-[2rem] bg-gradient-to-r from-orange-500 to-fuchsia-500 p-5 text-center text-white shadow-lg">
        {trip.status === "validated" ? (
          <p className="text-xl font-bold">La liste est faite ✅ Tu peux encore ajouter une demande.</p>
        ) : past ? (
          <p className="text-xl font-bold">Maman devait partir à {formatTime(trip.deadline_at)}. Fais vite !</p>
        ) : (
          <>
            <p className="opacity-90">Maman part dans</p>
            <p className="text-5xl font-black">
              <Countdown deadline={trip.deadline_at} />
            </p>
          </>
        )}
      </section>

      {others.map((r) => (
        <p key={r.id} className="mb-4 rounded-2xl bg-white/80 px-4 py-3 text-stone-600">
          <strong>{name.get(r.profile_id)}</strong> a demandé{" "}
          {[r.free_text && `« ${r.free_text} »`, r.recipe_ids.map((id) => recipeTitle.get(id)).filter(Boolean).join(", ")]
            .filter(Boolean)
            .join(" + ")}
        </p>
      ))}

      <RequestForm
        choices={choices}
        initialText={mine?.free_text ?? ""}
        initialRecipeIds={mine?.recipe_ids ?? []}
        alreadySent={mine != null}
      />
    </>
  );
}
