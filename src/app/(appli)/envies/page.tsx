import Link from "next/link";
import { after } from "next/server";
import { requireProfile, requireUser } from "@/lib/auth";
import { remplirSiBesoin } from "@/lib/marmiton";
import { getCurrentTrip, getDeck, getMesSwipes, getProfiles, getRecipes, getTasteContext } from "@/lib/data";
import { momentDe } from "@/lib/domain/reco";
import { contientPhrase } from "@/lib/domain/foods";
import { SwipeDeck } from "@/components/SwipeDeck";
import { BandeauScene, IconePanier } from "@/components/ui";
import { CarteGouts, CarteInviter } from "@/components/Envies";

// Laisse le temps à l'import Marmiton (lancé après l'affichage) de finir.
export const maxDuration = 60;

const EN_COURSE_MS = 6 * 60 * 60 * 1000;
const jourDe = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "Europe/Paris" }).format(d);

export default async function Envies({ searchParams }: { searchParams: Promise<{ tout?: string }> }) {
  const user = await requireUser();
  // Soir de semaine : les plats rapides d'abord (on peut tout revoir d'un appui).
  const maintenant = new Date();
  const moment = (await searchParams).tout === "1" ? null : momentDe(maintenant);
  // Profil, paquet, course en cours et membres : tout part en même temps.
  const [me, deck, trip, members, mesSwipes] = await Promise.all([
    requireProfile(),
    getDeck(user.familyId, user.profileId, moment),
    getCurrentTrip(user.familyId),
    getProfiles(user.familyId),
    getMesSwipes(user.familyId, user.profileId),
  ]);
  // « Je pars faire les courses » : une dernière envie peut encore partir sur la liste.
  const enCourse = trip?.created_by && Date.now() - Date.parse(trip.departs_at) < EN_COURSE_MS ? trip.created_by : null;
  const iAmShopper = enCourse === me.id;
  const who = members.find((m) => m.id === enCourse)?.name ?? "Quelqu'un";
  const bandeauCourse = Boolean(enCourse);

  // Presque plus rien à découvrir : de nouvelles recettes arrivent de Marmiton, sans rien faire.
  // (Seules les cartes jamais vues comptent : les plats qui reviennent ne sont pas des nouveautés.)
  after(() => remplirSiBesoin(user.familyId, deck.filter((r) => !r.dejaVu).length));
  // Paquet vide alors que la famille a des recettes : ce sont les goûts qui cachent tout.
  const toutCache = deck.length === 0 && (await getRecipes(user.familyId)).length > 0;
  // Les allergènes courants, dits comme sur « Ce soir » : une carte dit la même chose partout.
  const gouts = await getTasteContext(user.familyId);

  return (
    // Comme Recettes : le bandeau illustré, puis la pile de cartes sur le lilas, jusqu'aux onglets.
    <div className="ecran-envies">
      <BandeauScene
        compact
        fond="courses"
        illustration="courses"
        etiquette="Idées"
        titre="Ça te dit ?"
        initiale={me.name}
      />
      {/* Un seul bandeau à la fois : la course en cours, sinon inviter la famille, sinon le questionnaire. */}
      {bandeauCourse && (
        <Link
          href="/courses"
          className="mb-4 flex min-h-14 items-center gap-3 rounded-bouton bg-blanc px-4 py-2 text-petit leading-snug font-semibold text-aubergine active:scale-[0.98]"
        >
          <IconePanier className="size-6 shrink-0 text-violet" />
          <span className="flex-1">
            {iAmShopper ? "Tu fais les courses : ta liste est prête." : `${who} fait les courses : une envie ? Un plat choisi va tout seul sur la liste.`}
          </span>
        </Link>
      )}
      {!bandeauCourse && members.length === 1 && <CarteInviter />}
      {!bandeauCourse && members.length > 1 && !me.tastes_done_at && <CarteGouts retour="/envies" />}
      <SwipeDeck
        initialDeck={deck.map((r) => ({ ...r, contient: contientPhrase(gouts.texts.get(r.id) ?? [r.title]) }))}
        toutCache={toutCache}
        dejaSwipes={mesSwipes}
        ensuite={
          moment === "rapide" && (
            <p className="kd-petit">
              {jourDe(maintenant).replace(/^./, (c) => c.toUpperCase())} soir : les plats rapides d&apos;abord.{" "}
              <Link href="/envies?tout=1" className="font-semibold text-violet underline underline-offset-4">
                Tout voir
              </Link>
            </p>
          )
        }
      />
    </div>
  );
}
