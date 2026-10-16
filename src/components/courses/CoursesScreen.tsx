import Link from "next/link";
import type { Profile } from "@/lib/data";
import { forFamily, getMatches, getMyLikes, getPlatsAimes, getProfiles, getRecipes } from "@/lib/data";
import { getTripOverview, type TripOverview } from "@/lib/views";
import { deadlineFor, departureChoices, formatTime } from "@/lib/domain/trip";
import { ROUTES } from "@/lib/routes";
import { cancelTrip, takeOverTrip, validateTrip } from "@/app/actions/trips";
import { Countdown } from "@/components/Countdown";
import { SubmitButton } from "@/components/SubmitButton";
import { BandeauScene } from "@/components/ui";
import { LigneRecette } from "@/components/LigneRecette";
import { StartTrip } from "./StartTrip";
import { RecipeChecklist } from "./RecipeChecklist";
import { listeDeNoms } from "@/lib/domain/convives";
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
    // Personne n'y va : le même langage que Recettes et la liste (bandeau, puis des lignes),
    // avec ce qui fait envie en ce moment, pour savoir à quoi s'attendre.
    const [profiles, matches] = await Promise.all([getProfiles(me.family_id), getMatches(me.family_id)]);
    const others = profiles.filter((p) => p.id !== me.id).map((p) => p.name);
    // Dans l'ordre des heures de départ (« ce soir » peut tomber avant « dans 2 heures »).
    const choices = departureChoices()
      .map((c) => ({ ...c, depart: deadlineFor(c.id) }))
      .sort((a, b) => a.depart.getTime() - b.depart.getTime())
      .map(({ depart, ...c }) => ({ ...c, heure: formatTime(depart) }));
    return (
      <>
        <BandeauScene fond="courses" illustration="courses" etiquette={`Salut ${me.name}`} titre="On y va ?" actions={notifications} />
        <StartTrip choices={choices} others={others} />
        <section className="mt-10">
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h2 className="kd-etiquette">Ce qui fait envie</h2>
            {matches.length > 3 && (
              <Link href={ROUTES.matchs} className="font-semibold text-violet underline underline-offset-4">
                Tout voir
              </Link>
            )}
          </div>
          {matches.length > 0 ? (
            <ul className="kd-liste border-t-2 border-trait">
              {matches.slice(0, 3).map((m) => (
                <LigneRecette
                  key={m.id}
                  recipe={m}
                  infos={`Envie de ${listeDeNoms(m.avec, me.name).replace(/^Toi\b/, "toi")}`}
                />
              ))}
            </ul>
          ) : (
            <p className="text-encre-douce">Rien en commun pour l&apos;instant. Swipe dans Envies : Kaddie préparera les plats d&apos;elle-même.</p>
          )}
        </section>
      </>
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

/**
 * J'y vais, je prépare : Kaddie a déjà retenu les plats (demandés, ou envie de plusieurs),
 * avec les prénoms de qui les mange. Dans le cas courant, il n'y a qu'à faire la liste.
 */
function PreparerView({ me, overview }: { me: Profile; overview: TripOverview }) {
  const { trip, responses, candidates } = overview;
  const validated = trip.status === "validated";
  const checkedCount = candidates.filter((c) => c.checked).length;
  const ontRepondu = responses.filter((r) => r.request).map((r) => r.member.name);
  const enAttente = responses.filter((r) => !r.request).map((r) => r.member.name);
  // Les demandes écrites vont sur la liste toutes seules (découpées en articles).
  const ecrites = responses.filter((r) => r.request?.free_text);
  // Déjà sur la liste avant de la faire : les articles pas pris la dernière fois, ou ajoutés à la main.
  const dejaSurLaListe = trip.shopping_list_items.filter((i) => i.source === "manual" || i.source === "request").map((i) => i.name);
  const reponses =
    responses.length === 0
      ? null
      : enAttente.length === 0
        ? `${listeDeNoms(ontRepondu)} ${ontRepondu.length > 1 ? "ont" : "a"} répondu`
        : ontRepondu.length === 0
          ? `Pas encore de réponse de ${listeDeNoms(enAttente)}`
          : `${listeDeNoms(ontRepondu)} ${ontRepondu.length > 1 ? "ont" : "a"} répondu · pas encore ${listeDeNoms(enAttente)}`;

  return (
    <>
      <BandeauScene fond="courses" illustration="table" etiquette={<Depart overview={overview} />} titre="Kaddie te propose" />

      {reponses && <p className="mb-4 font-semibold">{reponses}</p>}

      <section className="mb-6">
        <RecipeChecklist recipes={candidates} moi={{ id: me.id, name: me.name }} membres={overview.members.map((m) => ({ id: m.id, name: m.name }))} />
      </section>

      {(ecrites.length > 0 || (!validated && dejaSurLaListe.length > 0)) && (
        <ul className="kd-petit mb-8 flex flex-col gap-1">
          {ecrites.map(({ member, request }) => (
            <li key={member.id}>
              + {request!.free_text} ({member.name}) : va sur la liste
            </li>
          ))}
          {!validated && dejaSurLaListe.length > 0 && (
            <li>
              Déjà sur ta liste&nbsp;: {listeDeNoms(dejaSurLaListe.slice(0, 6))}
              {dejaSurLaListe.length > 6 ? "…" : ""}
            </li>
          )}
        </ul>
      )}

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
  const [matches, recipes, likes, aimes] = await Promise.all([
    getMatches(me.family_id),
    getRecipes(me.family_id),
    getMyLikes(me.family_id, me.id),
    getPlatsAimes(me.family_id, me.id),
  ]);
  const mine = responses.find((r) => r.member.id === me.id)?.request ?? null;
  const others = responses.filter((r) => r.member.id !== me.id && r.request);
  const matchIds = new Set(matches.map((m) => m.id));
  const likeIds = new Set(likes.map((r) => r.id));
  const [envies, partages] = await Promise.all([
    // Mes envies du moment, puis mes plats aimés (pour en redemander un sans le reswiper).
    forFamily(me.family_id, [
      ...likes.filter((r) => !matchIds.has(r.id)),
      ...aimes.filter((r) => !matchIds.has(r.id)).slice(0, 6),
      ...recipes.filter((r) => mine?.recipe_ids.includes(r.id) && !matchIds.has(r.id) && !likeIds.has(r.id) && !aimes.some((a) => a.id === r.id)),
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
