import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo, Scene } from "@/design-system/components/Kaddie";
import { getSession } from "@/lib/auth";
import { familleInvitee, lienDeMaFamille } from "@/lib/acces";
import { noterEtape } from "@/lib/etapes";
import { apercuInvitation } from "@/lib/apercu";
import { texteApercu, titreApercu } from "@/lib/domain/apercu";
import { origineDuSite } from "@/lib/origine";
import { rejoindreAvecPrenom } from "@/app/actions/auth";
import { Rejoindre } from "./Rejoindre";

/** Ce que montre le lien dans le groupe de la famille, avant même de l'ouvrir : le plat de ce soir, ou qui invite. */
export async function generateMetadata({ params }: { params: Promise<{ jeton: string }> }): Promise<Metadata> {
  const [{ jeton }, h] = await Promise.all([params, headers()]);
  const apercu = await apercuInvitation(jeton);
  const titre = titreApercu(apercu);
  const texte = texteApercu(apercu);
  // L'image d'aperçu est donnée en chemin relatif : elle se résout sur le site qui sert le lien.
  let metadataBase: URL | undefined;
  try {
    metadataBase = new URL(origineDuSite(h));
  } catch {}
  return { metadataBase, title: apercu ? `${titre} — Kaddie` : "Invitation — Kaddie", description: texte, openGraph: { title: titre, description: texte, siteName: "Kaddie", locale: "fr_FR" } };
}
export const dynamic = "force-dynamic";

/**
 * Un lien d'invitation, reçu dans le groupe de la famille : son prénom, un appui, et on voit
 * ce qu'on mange ce soir. Expiré ou annulé : on le dit, et le code reste possible. Un membre de la famille, lui, arrive
 * toujours sur « Ce soir », quel que soit l'âge du lien.
 */
export default async function InvitationPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const [famille, session] = await Promise.all([familleInvitee(jeton), getSession()]);
  // Déjà dans cette famille sur ce téléphone : rien à faire, même si le lien a plus de 7 jours (un message rouvert le lendemain,
  // la semaine suivante) : on arrive sur « Ce soir ». Le lien expiré ne sert qu'à celles et ceux qui n'y sont pas encore.
  if (session && (famille ? famille.id === session.familyId : await lienDeMaFamille(jeton, session.familyId))) {
    await noterEtape("ouverture_lien");
    redirect(session.profileId ? "/" : "/profil");
  }

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
            <p className="kd-etiquette text-blanc">{famille.par ? `${famille.par} t'invite` : "Tu es invité·e"}</p>
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
