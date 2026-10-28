import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo, Scene } from "@/design-system/components/Kaddie";
import { getSession } from "@/lib/auth";
import { familleInvitee } from "@/lib/acces";
import { rejoindreAvecPrenom } from "@/app/actions/auth";
import { Rejoindre } from "./Rejoindre";

export const metadata = { title: "Invitation — Kaddie" };
export const dynamic = "force-dynamic";

/**
 * Un lien d'invitation, reçu dans le groupe de la famille : son prénom, un appui, et on voit
 * ce qu'on mange ce soir. Expiré ou annulé : on le dit, et le code reste possible.
 */
export default async function InvitationPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const [famille, session] = await Promise.all([familleInvitee(jeton), getSession()]);
  // Déjà dans cette famille sur ce téléphone : rien à faire.
  if (famille && session?.familyId === famille.id) redirect(session.profileId ? "/" : "/profil");

  return (
    <Scene
      as="main"
      duo="aubergine"
      seed={9}
      className="pb-safe flex min-h-dvh flex-col justify-between gap-8 px-6 pt-[max(env(safe-area-inset-top),1rem)]"
    >
      <div className="kd-monte mx-auto flex max-w-md flex-col items-center gap-5 pt-16 text-center">
        <Logo width={240} />
        {famille ? (
          <>
            <p className="kd-etiquette text-blanc">Tu es invité·e</p>
            <h1 className="kd-titre-1">{famille.name}</h1>
            <p>Dis-nous ton prénom : tu vois tout de suite ce qu&apos;on mange ce soir.</p>
          </>
        ) : (
          <>
            <h1 className="kd-titre-2">Ce lien a expiré</h1>
            <p>Demande un nouveau lien à ta famille, ou tape le code famille.</p>
          </>
        )}
      </div>
      <div className="mx-auto w-full max-w-md pb-4">
        {famille ? (
          <Rejoindre action={rejoindreAvecPrenom.bind(null, jeton)} nom={famille.name} autreFamille={Boolean(session)} />
        ) : (
          <Link href="/bienvenue" className="kd-btn kd-btn--secondaire kd-btn--large">
            J&apos;ai un code famille
          </Link>
        )}
      </div>
    </Scene>
  );
}
